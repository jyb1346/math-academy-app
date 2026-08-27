'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import CategoryTabs from './components/CategoryTabs';

function getYouTubeId(text) {
  if (!text) return null;
  const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

function extractFileUrl(text) {
  if (!text) return null;
  const match = text.match(/📎 첨부파일(?: 링크)?:\s*(\S+)/);
  if (match) return match[1];
  const driveMatch = text.match(/(https?:\/\/drive\.google\.com\/\S+)/);
  if (driveMatch) return driveMatch[1];
  return null;
}

function CategoryHandler({ setCategory }) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  useEffect(() => {
    if (categoryParam) {
      if (categoryParam === 'HOMEWORK') {
        setCategory('NOTICE_HOMEWORK');
      } else {
        setCategory(categoryParam);
      }
    }
  }, [categoryParam, setCategory]);

  return null;
}

function BoardContent() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 작성/수정 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [targetClassId, setTargetClassId] = useState('');
  const [modalCategory, setModalCategory] = useState('HOMEWORK');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchBoardData(parsedUser);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const fetchBoardData = async (currentUser) => {
    try {
      let teacherId = currentUser.id;

      if (currentUser.role === 'STUDENT') {
        const { data: stInfo } = await supabase
          .from('users')
          .select('teacher_id')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (stInfo?.teacher_id) {
          teacherId = stInfo.teacher_id;
        }
      }

      // 1. 반 목록 가져오기 (원장님은 전체 반 조회 가능, 일반 강사는 본인 담당 반)
      let classQuery = supabase.from('classes').select('*');
      if (currentUser.role === 'TEACHER') {
        classQuery = classQuery.eq('teacher_id', teacherId);
      }

      const { data: cData } = await classQuery;
      const fetchedClasses = cData || [];
      setClasses(fetchedClasses);

      // 2. 게시글 목록 조회
      const { data: pData, error: pErr } = await supabase
        .from('posts')
        .select('*, classes(name), users!posts_author_id_fkey(name)')
        .order('created_at', { ascending: false });

      if (pErr) {
        console.error('게시글 상세 조회 에러, 기본 조회 실행:', pErr);
        const { data: fbData } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        setPosts(fbData || []);
      } else {
        setPosts(pData || []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPost(null);
    setTitle('');
    setContent('');
    setDueDate('');
    setVideoUrl('');
    setFileUrl('');

    // 🎯 현재 보고 있는 반 탭이 있으면 해당 반을 기본값으로, 없으면 첫 번째 반 또는 전체 공지
    let defaultClass = '';
    if (selectedClassId && selectedClassId !== 'ALL' && selectedClassId !== 'PUBLIC') {
      defaultClass = selectedClassId;
    } else if (classes.length > 0) {
      defaultClass = String(classes[0].id);
    }

    setTargetClassId(defaultClass);
    setModalCategory(category === 'ALL' || category === 'NOTICE_HOMEWORK' ? 'HOMEWORK' : category);
    setShowModal(true);
  };

  const handleOpenEditModal = (post) => {
    setEditingPost(post);
    setTargetClassId(post.class_id ? String(post.class_id) : '');
    setModalCategory(post.category || 'HOMEWORK');
    setTitle(post.title || '');
    
    // 내용에서 첨부 링크 분리 파싱
    let bodyText = post.content || '';
    const extractedFile = extractFileUrl(bodyText);
    const ytId = getYouTubeId(bodyText);
    
    if (extractedFile) {
      bodyText = bodyText.replace(/📎 첨부파일(?: 링크)?:\s*\S+/g, '').trim();
    }
    if (ytId) {
      bodyText = bodyText.replace(/🎬 (?:복습)?영상 링크:\s*\S+/g, '').trim();
    }

    setContent(bodyText);
    setDueDate(post.due_date || '');
    setVideoUrl(ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
    setFileUrl(extractedFile || '');
    setShowModal(true);
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('제목을 입력해 주세요.');

    try {
      let combinedContent = content.trim();
      if (videoUrl.trim() && !combinedContent.includes(videoUrl.trim())) {
        combinedContent += `\n\n🎬 영상 링크: ${videoUrl.trim()}`;
      }
      if (fileUrl.trim() && !combinedContent.includes(fileUrl.trim())) {
        combinedContent += `\n\n📎 첨부파일 링크: ${fileUrl.trim()}`;
      }

      // 💡 외래키 안전 처리: 선택한 반 ID가 실제 classes 목록에 존재하는 UUID일 때만 전달, 아니면 null(전체 공지)
      const matchedClass = classes.find((c) => String(c.id) === String(targetClassId));
      const validClassId = matchedClass ? matchedClass.id : null;

      const payload = {
        author_id: user.id,
        class_id: validClassId,
        category: modalCategory,
        title: title.trim(),
        content: combinedContent,
        due_date: dueDate || null,
      };

      if (editingPost) {
        const { error } = await supabase
          .from('posts')
          .update(payload)
          .eq('id', editingPost.id);

        if (error) throw error;
        alert('게시글이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('posts')
          .insert([payload]);

        if (error) throw error;
        alert(`${matchedClass ? `[${matchedClass.name}] 반` : '학원 전체'} 게시글이 성공적으로 등록되었습니다!`);
      }

      setShowModal(false);
      fetchBoardData(user);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    }
  };

  const handleDeletePost = async (postId, postTitle) => {
    if (!confirm(`[${postTitle}] 게시글을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      alert('삭제되었습니다.');
      fetchBoardData(user);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 🎯 카테고리 및 반별 정밀 필터링 로직
  const filteredPosts = posts.filter((post) => {
    // 1. 카테고리 필터
    if (category !== 'ALL') {
      if (category === 'NOTICE_HOMEWORK') {
        if (post.category !== 'NOTICE' && post.category !== 'HOMEWORK') return false;
      } else if (post.category !== category) {
        return false;
      }
    }

    // 2. 반 필터
    if (selectedClassId === 'ALL') return true;
    if (selectedClassId === 'PUBLIC') return !post.class_id;
    return String(post.class_id) === String(selectedClassId);
  });

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">게시판 로딩 중...</div>;

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'HEAD_TEACHER';

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      <Suspense fallback={null}>
        <CategoryHandler setCategory={setCategory} />
      </Suspense>

      {/* 상단 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer" 
            onClick={() => router.push('/')}
          >
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              품수학 학원 게시판
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              숙제 공지, 복습 영상, 수업 자료 및 질의응답을 확인하세요.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200"
        >
          ← 이전 화면으로
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        
        {/* 탭 네비게이션 & 반 필터 */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <span>📋</span>
              <span>게시판 카테고리</span>
            </h2>
            {isTeacher && (
              <button
                onClick={handleOpenCreateModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-2xl text-xs shadow-md shadow-indigo-600/20 transition whitespace-nowrap"
              >
                + 새 게시글 작성
              </button>
            )}
          </div>

          <CategoryTabs
            category={category}
            setCategory={setCategory}
            selectedClassId={selectedClassId}
            setSelectedClassId={setSelectedClassId}
            myClasses={classes}
          />
        </div>

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80 space-y-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-bold text-slate-700">해당 조건의 게시글이 없습니다.</p>
              <p className="text-xs text-slate-400">새로운 공지사항이나 자료가 등록되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const matchedClassName = post.classes?.name || classes.find((c) => String(c.id) === String(post.class_id))?.name || '학원 전체 공지';
              const isPublic = !post.class_id;
              const authorName = post.users?.name || '선생님';
              const rawContent = post.content || '';
              const ytId = getYouTubeId(rawContent);
              const fileUrl = extractFileUrl(rawContent);
              const cleanContent = rawContent
                .replace(/🎬 (?:복습)?영상 링크:\s*\S+/g, '')
                .replace(/📎 첨부파일(?: 링크)?:\s*\S+/g, '')
                .trim();

              return (
                <div key={post.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={isPublic ? 'text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200' : 'text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100'}>
                          {isPublic ? '🌐 학원 전체 공지' : ('🎯 [' + matchedClassName + ']')}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {post.category === 'NOTICE' && '📢 일반 공지'}
                          {post.category === 'HOMEWORK' && '📝 숙제 공지'}
                          {post.category === 'VIDEO' && '🎥 복습 영상'}
                          {post.category === 'MATERIAL' && '📁 수업 자료'}
                          {post.category === 'QNA' && '💬 질의응답'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold ml-1">
                          작성자: {authorName} • {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 pt-1">{post.title}</h3>
                    </div>

                    {isTeacher && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(post)}
                          className="text-xs text-slate-500 hover:text-indigo-600 font-bold px-2 py-1 rounded-lg bg-slate-50"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className="text-xs text-rose-500 hover:underline font-bold px-2 py-1"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>

                  {cleanContent && (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      {cleanContent}
                    </p>
                  )}

                  {/* 🎬 유튜브 영상 자동 임베드 */}
                  {ytId && (
                    <div className="mt-3 aspect-video w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-black">
                      <iframe
                        src={'https://www.youtube.com/embed/' + ytId}
                        title="수업 복습 영상"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  {/* 마감일 & 자료 다운로드 링크 */}
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                    {post.due_date && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-xl font-bold">
                        ⏰ 제출 마감일: {post.due_date}
                      </span>
                    )}

                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl font-bold transition"
                      >
                        <span>📁 첨부 자료 / PDF 다운로드</span>
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* 작성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">
                {editingPost ? '✏️ 게시글 수정' : '📝 새 게시글 작성'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>

            <form onSubmit={handleSubmitPost} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">게시 대상 반</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        🎯 [{cls.name}] 전용 게시글
                      </option>
                    ))}
                    <option value="">🌐 학원 전체 학생 공지</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">카테고리</label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="HOMEWORK">📝 숙제 공지</option>
                    <option value="NOTICE">📢 일반 공지</option>
                    <option value="VIDEO">🎥 복습 영상</option>
                    <option value="MATERIAL">📁 수업 자료</option>
                    <option value="QNA">💬 질의응답</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">제목</label>
                <input
                  type="text"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">본문 내용</label>
                <textarea
                  placeholder="공지나 전달 사항을 입력하세요"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-800 h-28 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">제출 마감일 (선택)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">복습 영상 유튜브 URL (선택)</label>
                <input
                  type="url"
                  placeholder="https://youtube.com/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">수업 자료 / 구글드라이브 URL (선택)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 bg-slate-100 text-slate-600 py-3 rounded-2xl text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-bold shadow-md transition"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">게시판 로딩 중...</div>}>
      <BoardContent />
    </Suspense>
  );
}
