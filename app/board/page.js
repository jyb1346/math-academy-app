'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function CategoryHandler({ setCategory }) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  useEffect(() => {
    if (categoryParam) {
      setCategory(categoryParam);
    }
  }, [categoryParam, setCategory]);

  return null;
}

function BoardContent() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 작성/수정 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [targetClassId, setTargetClassId] = useState('');
  const [category, setCategory] = useState('HOMEWORK');
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
          .single();

        if (stInfo?.teacher_id) {
          teacherId = stInfo.teacher_id;
        }
      }

      // 1. 반 목록 전체 불러오기
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacherId);

      const fetchedClasses = cData || [];
      setClasses(fetchedClasses);

      if (fetchedClasses.length > 0 && !targetClassId) {
        setTargetClassId(String(fetchedClasses[0].id));
      }

      // 2. 외래키 오류 방지를 위해 posts 단독 수집
      const { data: pData, error: pErr } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (pErr) throw pErr;
      setPosts(pData || []);

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
    if (classes.length > 0) setTargetClassId(String(classes[0].id));
    setShowModal(true);
  };

  const handleOpenEditModal = (post) => {
    setEditingPost(post);
    setTargetClassId(String(post.class_id));
    setCategory(post.category || 'HOMEWORK');
    setTitle(post.title || '');
    setContent(post.content || '');
    setDueDate(post.due_date || '');
    setVideoUrl(post.video_url || '');
    setFileUrl(post.file_url || '');
    setShowModal(true);
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return alert('제목과 내용을 입력해 주세요.');
    if (!targetClassId) return alert('대상 반을 선택해 주세요.');

    try {
      const payload = {
        teacher_id: user.id,
        class_id: targetClassId,
        category,
        title: title.trim(),
        content: content.trim(),
        due_date: dueDate || null,
        video_url: videoUrl.trim() || null,
        file_url: fileUrl.trim() || null,
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
        alert('게시글이 성공적으로 등록되었습니다!');
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

  // 반 선택 필터링 (전체 보기 시 무조건 다 출력)
  const filteredPosts = posts.filter((post) => {
    if (selectedClassId === 'ALL') return true;
    return String(post.class_id) === String(selectedClassId);
  });

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">게시판 로딩 중...</div>;

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'HEAD_TEACHER';

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      <Suspense fallback={null}>
        <CategoryHandler setCategory={setCategory} />
      </Suspense>

      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              품수학 학원 게시판
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              숙제 공지, 복습 영상, 수업 자료를 확인하고 활용하세요.
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

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        
        {/* 필터 및 글쓰기 버튼 상단바 */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">🏫 반 선택:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition w-full sm:w-48"
            >
              <option value="ALL">전체 반 게시글 보기</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
              ))}
            </select>
          </div>

          {isTeacher && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-md shadow-indigo-600/20 transition whitespace-nowrap"
            >
              + 새 게시글 작성
            </button>
          )}
        </div>

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80">
              <p className="text-sm font-bold text-slate-400">등록된 게시글이 없습니다.</p>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const matchedClass = classes.find((c) => String(c.id) === String(post.class_id));

              return (
                <div key={post.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                          📘 {matchedClass?.name || '기타/전체 반'}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {post.category === 'HOMEWORK' && '📝 숙제 공지'}
                          {post.category === 'VIDEO' && '🎥 복습 영상'}
                          {post.category === 'MATERIAL' && '📁 수업 자료'}
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-slate-800 pt-1">{post.title}</h2>
                    </div>

                    {isTeacher && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(post)}
                          className="text-xs text-slate-500 hover:text-indigo-600 font-bold"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className="text-xs text-rose-500 hover:underline font-bold"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    {post.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                    {post.due_date && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-xl font-bold">
                        ⏰ 제출 마감일: {post.due_date}
                      </span>
                    )}

                    {post.video_url && (
                      <a
                        href={post.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-xl font-bold hover:underline"
                      >
                        🎥 영상 보기 ↗
                      </a>
                    )}

                    {post.file_url && (
                      <a
                        href={post.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-xl font-bold hover:underline"
                      >
                        📁 자료 다운로드 ↗
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
                  <label className="block text-xs font-bold text-slate-600 mb-1">대상 반</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="HOMEWORK">📝 숙제 공지</option>
                    <option value="VIDEO">🎥 복습 영상</option>
                    <option value="MATERIAL">📁 수업 자료</option>
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
                <label className="block text-xs font-bold text-slate-600 mb-1">내용</label>
                <textarea
                  placeholder="내용을 입력하세요"
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
                <label className="block text-xs font-bold text-slate-600 mb-1">복습 영상 링크 URL (선택)</label>
                <input
                  type="url"
                  placeholder="https://youtube.com/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">수업 자료 링크/구글드라이브 URL (선택)</label>
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