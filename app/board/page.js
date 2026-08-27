'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import CategoryTabs from './components/CategoryTabs';
import PostCreateForm from './components/PostCreateForm';
import PostEditModal from './components/PostEditModal';

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
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

function CategoryQuerySync({ setCategory }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams) {
      const cat = searchParams.get('category');
      if (cat) {
        if (cat === 'HOMEWORK') {
          setCategory('NOTICE_HOMEWORK');
        } else {
          setCategory(cat);
        }
      }
    }
  }, [searchParams, setCategory]);
  return null;
}

function BoardMain() {
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myClassIds, setMyClassIds] = useState([]);
  const [targetClassId, setTargetClassId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [newCategory, setNewCategory] = useState('HOMEWORK');
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState([]);
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [homeworkList, setHomeworkList] = useState([{ bookTitle: '', range: '' }]);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 수정 모달 상태
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('HOMEWORK');
  const [editTargetClassId, setEditTargetClassId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editGoogleFormUrl, setEditGoogleFormUrl] = useState('');
  const [editHomeworkList, setEditHomeworkList] = useState([]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    setDueDate(new Date().toISOString().split('T')[0]);

    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      initData(parsedUser);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const initData = async (currentUser) => {
    try {
      const { data: cData } = await supabase.from('classes').select('*');
      const allC = cData || [];
      setClasses(allC);

      if (currentUser.role !== 'STUDENT') {
        // 원장님은 모든 반 관리 가능, 일반 강사는 본인 담당 반
        const myC = (currentUser.role === 'HEAD_TEACHER')
          ? allC
          : allC.filter((c) => c.teacher_id === currentUser.id);

        setMyClasses(myC.length > 0 ? myC : allC);

        if (myC.length > 0) {
          setTargetClassId(String(myC[0].id));
        } else if (allC.length > 0) {
          setTargetClassId(String(allC[0].id));
        } else {
          setTargetClassId('ALL_STUDENTS');
        }
      } else {
        const { data: csData } = await supabase
          .from('class_students')
          .select('class_id')
          .eq('student_id', currentUser.id);

        const myCIds = csData ? csData.map((cs) => cs.class_id) : [];
        setMyClassIds(myCIds);

        const studentMyClasses = allC.filter((c) => myCIds.includes(c.id));
        setMyClasses(studentMyClasses.length > 0 ? studentMyClasses : allC);
      }

      await fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users!posts_author_id_fkey(name), classes(name, teacher_id)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Post join fetch error, fallbacking:', error);
        const { data: fallbackData } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        setPosts(fallbackData || []);
      } else {
        setPosts(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBook = () => setHomeworkList([...homeworkList, { bookTitle: '', range: '' }]);
  const handleRemoveBook = (index) => setHomeworkList(homeworkList.filter((_, i) => i !== index));
  const handleBookChange = (index, field, value) => {
    const updated = [...homeworkList];
    updated[index][field] = value;
    setHomeworkList(updated);
  };

  const handleEditAddBook = () => setEditHomeworkList([...editHomeworkList, { bookTitle: '', range: '' }]);
  const handleEditRemoveBook = (index) => setEditHomeworkList(editHomeworkList.filter((_, i) => i !== index));
  const handleEditBookChange = (index, field, value) => {
    const updated = [...editHomeworkList];
    updated[index][field] = value;
    setEditHomeworkList(updated);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('제목을 입력해 주세요.');

    try {
      setUploading(true);
      let filePublicUrl = null;

      if (attachedFile) {
        try {
          const fileExt = attachedFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `board_files/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, attachedFile);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('attachments')
              .getPublicUrl(filePath);
            filePublicUrl = urlData?.publicUrl;
          }
        } catch (storageErr) {
          console.warn('Storage upload warning:', storageErr);
        }
      }

      const targetCategory = category === 'QNA' ? 'QNA' : newCategory;

      let finalContent = content;
      if (targetCategory === 'HOMEWORK') {
        const bookDetails = homeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');

        const formLinkText = googleFormUrl.trim() ? `\n\n📋 구글 폼 링크: ${googleFormUrl.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}\n\n📝 메모:\n${content}`;
      }

      if (filePublicUrl) {
        finalContent += `\n\n📎 첨부파일: ${filePublicUrl}`;
      }

      // 💡 UUID 외래키 안전 매핑: classes 목록에 존재하는 ID만 class_id로 전달 (parseInt 절대 사용 금지!)
      const matchedClass = myClasses.find((c) => String(c.id) === String(targetClassId)) ||
                           classes.find((c) => String(c.id) === String(targetClassId));
      const validClassId = (targetClassId === 'ALL_STUDENTS' || !matchedClass) ? null : matchedClass.id;

      const postData = {
        title: title.trim(),
        content: finalContent,
        category: targetCategory,
        author_id: user.id,
        class_id: validClassId,
        due_date: targetCategory === 'HOMEWORK' ? dueDate : null,
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      setTitle('');
      setContent('');
      setGoogleFormUrl('');
      setAttachedFile(null);
      setHomeworkList([{ bookTitle: '', range: '' }]);
      fetchPosts();
      alert(`${matchedClass ? `[${matchedClass.name}] 반` : '학원 전체'} 게시글이 성공적으로 등록되었습니다!`);
    } catch (err) {
      console.error(err);
      alert('등록 실패: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditTitle(post.title || '');
    setEditCategory(post.category || 'HOMEWORK');
    setEditTargetClassId(post.class_id ? String(post.class_id) : 'ALL_STUDENTS');
    setEditDueDate(post.due_date || new Date().toISOString().split('T')[0]);

    const postContent = post.content || '';
    const formMatch = postContent.match(/📋 구글 폼 링크:\s*(\S+)/);
    setEditGoogleFormUrl(formMatch ? formMatch[1] : '');

    const lines = postContent.split('\n');
    const parsedBooks = [];
    lines.forEach((line) => {
      if (line.startsWith('📘 [')) {
        const match = line.match(/📘 \[(.*?)\] (.*)/);
        if (match) {
          parsedBooks.push({ bookTitle: match[1], range: match[2] });
        }
      }
    });

    setEditHomeworkList(parsedBooks.length > 0 ? parsedBooks : [{ bookTitle: '', range: '' }]);

    const memoIndex = postContent.indexOf('📝 메모:\n');
    if (memoIndex !== -1) {
      setEditContent(postContent.substring(memoIndex + 7));
    } else if (parsedBooks.length > 0) {
      setEditContent('');
    } else {
      setEditContent(postContent);
    }
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return alert('제목을 입력해 주세요.');

    try {
      let finalContent = editContent;
      if (editCategory === 'HOMEWORK') {
        const bookDetails = editHomeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');

        const formLinkText = editGoogleFormUrl.trim() ? `\n\n📋 구글 폼 링크: ${editGoogleFormUrl.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}\n\n📝 메모:\n${editContent}`;
      }

      const matchedClass = classes.find((c) => String(c.id) === String(editTargetClassId));
      const validClassId = (editTargetClassId === 'ALL_STUDENTS' || !matchedClass) ? null : matchedClass.id;

      const updateData = {
        title: editTitle.trim(),
        content: finalContent,
        category: editCategory,
        class_id: validClassId,
        due_date: editCategory === 'HOMEWORK' ? editDueDate : null,
      };

      const { error } = await supabase.from('posts').update(updateData).eq('id', editingPost.id);
      if (error) throw error;

      alert('게시글이 성공적으로 수정되었습니다.');
      setEditingPost(null);
      fetchPosts();
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  const handleDeletePost = async (postId, postTitle) => {
    if (!confirm(`[${postTitle}] 게시글을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      fetchPosts();
      alert('삭제되었습니다.');
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const handleHeaderTitleClick = () => {
    if (user?.role === 'STUDENT') {
      router.push('/student/dashboard');
    } else {
      router.push('/teacher/dashboard');
    }
  };

  // 🎯 카테고리 & 반별 정밀 필터링
  const visiblePosts = posts.filter((post) => {
    // 1. 반별 선택 필터
    if (selectedClassId !== 'ALL') {
      if (selectedClassId === 'PUBLIC') {
        if (post.class_id !== null) return false;
      } else {
        if (String(post.class_id) !== String(selectedClassId)) return false;
      }
    }

    // 2. 4대 카테고리 필터
    if (category === 'NOTICE_HOMEWORK') {
      return post.category === 'HOMEWORK' || post.category === 'NOTICE';
    } else if (category === 'VIDEO') {
      return post.category === 'VIDEO';
    } else if (category === 'MATERIAL') {
      return post.category === 'MATERIAL';
    } else if (category === 'QNA') {
      return post.category === 'QNA';
    }

    return true;
  });

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">게시판 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-16 font-sans text-slate-800">
      <header className="bg-white border-b py-4 px-6 shadow-xs flex justify-between items-center sticky top-0 z-30">
        <h1
          onClick={handleHeaderTitleClick}
          className="text-xl font-black text-blue-600 cursor-pointer hover:opacity-80 transition flex items-center gap-2"
        >
          <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-black">품</span>
          <span>품수학 학원 게시판</span>
        </h1>
        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition border border-slate-200"
        >
          ← 이전 화면
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        {/* 상단 카테고리 탭 & 반 필터 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <CategoryTabs
            category={category}
            setCategory={setCategory}
            selectedClassId={selectedClassId}
            setSelectedClassId={(clsId) => {
              setSelectedClassId(clsId);
              if (clsId !== 'ALL' && clsId !== 'PUBLIC') {
                setTargetClassId(clsId);
              }
            }}
            myClasses={myClasses}
          />
        </div>

        {/* 선생님용 인라인 작성 폼 (교재 목록, 구글 폼, 첨부파일 지원) */}
        {user?.role !== 'STUDENT' && (
          <PostCreateForm
            user={user}
            myClasses={myClasses}
            targetClassId={targetClassId}
            setTargetClassId={setTargetClassId}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            dueDate={dueDate}
            setDueDate={setDueDate}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            googleFormUrl={googleFormUrl}
            setGoogleFormUrl={setGoogleFormUrl}
            homeworkList={homeworkList}
            handleAddBook={handleAddBook}
            handleRemoveBook={handleRemoveBook}
            handleBookChange={handleBookChange}
            setAttachedFile={setAttachedFile}
            handleCreatePost={handleCreatePost}
            uploading={uploading}
          />
        )}

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {visiblePosts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-xs space-y-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-bold text-slate-700">해당 조건의 게시글이 없습니다.</p>
              <p className="text-xs text-slate-400">새로운 공지나 숙제가 등록되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            visiblePosts.map((post) => {
              const matchedClassName = post.classes?.name || classes.find((c) => String(c.id) === String(post.class_id))?.name || '학원 전체 공지';
              const isPublic = !post.class_id;
              const authorName = post.users?.name || '선생님';
              const rawContent = post.content || '';
              const ytId = getYouTubeId(rawContent);
              const fileUrl = extractFileUrl(rawContent);

              return (
                <div key={post.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={isPublic ? 'text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200' : 'text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100'}>
                          {isPublic ? '🌐 학원 전체 공지' : ('🎯 [' + matchedClassName + ']')}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                          {post.category === 'NOTICE' && '📢 일반 공지'}
                          {post.category === 'HOMEWORK' && '📝 숙제 공지'}
                          {post.category === 'VIDEO' && '🎥 복습 영상'}
                          {post.category === 'MATERIAL' && '📁 수업 자료'}
                          {post.category === 'QNA' && '💬 질의응답'}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold ml-1">
                          작성자: {authorName} • {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 pt-1">{post.title}</h3>
                    </div>

                    {user?.role !== 'STUDENT' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(post)}
                          className="text-xs text-slate-500 hover:text-indigo-600 font-bold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200"
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

                  {rawContent && (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                      {rawContent}
                    </p>
                  )}

                  {/* 🎬 유튜브 영상 자동 임베드 */}
                  {ytId && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-black">
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
                        <span>📁 첨부 파일 / 다운로드</span>
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

      {/* 수정 모달 */}
      <PostEditModal
        editingPost={editingPost}
        setEditingPost={setEditingPost}
        myClasses={myClasses}
        editTargetClassId={editTargetClassId}
        setEditTargetClassId={setEditTargetClassId}
        editCategory={editCategory}
        setEditCategory={setEditCategory}
        editDueDate={editDueDate}
        setEditDueDate={setEditDueDate}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editContent={editContent}
        setEditContent={setEditContent}
        editGoogleFormUrl={editGoogleFormUrl}
        setEditGoogleFormUrl={setEditGoogleFormUrl}
        editHomeworkList={editHomeworkList}
        handleEditAddBook={handleEditAddBook}
        handleEditRemoveBook={handleEditRemoveBook}
        handleEditBookChange={handleEditBookChange}
        handleUpdatePost={handleUpdatePost}
      />
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-slate-500">게시판 로딩 중...</div>}>
      <CategoryQuerySync setCategory={() => {}} />
      <BoardMain />
    </Suspense>
  );
}
