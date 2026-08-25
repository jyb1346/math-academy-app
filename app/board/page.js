'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import CategoryTabs from './components/CategoryTabs';
import PostCreateForm from './components/PostCreateForm';
import PostEditModal from './components/PostEditModal';
import PostItem from './components/PostItem';

function BoardContent() {
  const [posts, setPosts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myClassIds, setMyClassIds] = useState([]);
  
  const [studentScope, setStudentScope] = useState('MY_STUDENTS');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [category, setCategory] = useState('ALL');

  // 작성 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState('HOMEWORK');
  const [targetClassId, setTargetClassId] = useState('');
  const [dueDate, setDueDate] = useState('');
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

  const [allStudents, setAllStudents] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [postConfirmations, setPostConfirmations] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setDueDate(new Date().toISOString().split('T')[0]);

    if (searchParams) {
      const paramCategory = searchParams.get('category');
      if (paramCategory) setCategory(paramCategory);
    }

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
        const myC = allC.filter((c) => c.teacher_id === currentUser.id);
        setMyClasses(myC);
        setTargetClassId(myC.length > 0 ? myC[0].id.toString() : 'ALL_STUDENTS');

        const { data: stData } = await supabase.from('users').select('*').eq('role', 'STUDENT');
        const allSt = stData || [];
        setAllStudents(allSt);
        setMyStudents(allSt.filter((s) => s.teacher_id === currentUser.id));
      } else {
        const { data: csData } = await supabase.from('class_students').select('class_id').eq('student_id', currentUser.id);
        const myCIds = csData ? csData.map((cs) => cs.class_id) : [];
        setMyClassIds(myCIds);
        setMyClasses(allC.filter((c) => myCIds.includes(c.id)));
      }

      await fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, users(name), classes(name, teacher_id)')
      .order('created_at', { ascending: false });

    if (!error) {
      setPosts(data || []);
      fetchConfirmations();
    }
  };

  const fetchConfirmations = async () => {
    const { data, error } = await supabase.from('post_confirmations').select('*');
    if (!error && data) {
      const confirmMap = {};
      data.forEach((item) => {
        if (!confirmMap[item.post_id]) confirmMap[item.post_id] = new Set();
        confirmMap[item.post_id].add(item.student_id);
      });
      setPostConfirmations(confirmMap);
    }
  };

  const togglePostConfirmation = async (postId) => {
    if (!user || user.role !== 'STUDENT') return;
    const isConfirmed = postConfirmations[postId]?.has(user.id);

    if (isConfirmed) {
      const { error } = await supabase.from('post_confirmations').delete().eq('post_id', postId).eq('student_id', user.id);
      if (!error) {
        setPostConfirmations((prev) => {
          const updated = { ...prev };
          if (updated[postId]) updated[postId].delete(user.id);
          return { ...updated };
        });
      }
    } else {
      const { error } = await supabase.from('post_confirmations').insert([{ post_id: postId, student_id: user.id }]);
      if (!error) {
        setPostConfirmations((prev) => {
          const updated = { ...prev };
          if (!updated[postId]) updated[postId] = new Set();
          updated[postId].add(user.id);
          return { ...updated };
        });
      }
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
    if (!title.trim()) return alert('제목을 입력해주세요.');

    try {
      setUploading(true);
      let filePublicUrl = null;

      if (attachedFile) {
        const fileExt = attachedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `board_files/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, attachedFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);
          filePublicUrl = urlData?.publicUrl;
        }
      }

      let finalContent = content;
      if (newCategory === 'HOMEWORK') {
        const bookDetails = homeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');
        const formLinkText = googleFormUrl.trim() ? `\n\n🔗 구글 폼 링크: ${googleFormUrl.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}\n\n📝 메모:\n${content}`;
      }

      if (filePublicUrl) {
        finalContent += `\n\n📎 첨부파일: ${filePublicUrl}`;
      }

      const postData = {
        title,
        content: finalContent,
        category: newCategory,
        author_id: user.id,
        class_id: targetClassId === 'ALL_STUDENTS' || !targetClassId ? null : parseInt(targetClassId),
        due_date: newCategory === 'HOMEWORK' ? dueDate : null,
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      setTitle('');
      setContent('');
      setGoogleFormUrl('');
      setAttachedFile(null);
      setHomeworkList([{ bookTitle: '', range: '' }]);
      fetchPosts();
      alert('등록되었습니다.');
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
    setEditTargetClassId(post.class_id ? post.class_id.toString() : 'ALL_STUDENTS');
    setEditDueDate(post.due_date || new Date().toISOString().split('T')[0]);

    const postContent = post.content || '';
    const formMatch = postContent.match(/🔗 구글 폼 링크: (https?:\/\/[^\s]+)/);
    setEditGoogleFormUrl(formMatch ? formMatch[1] : '');

    const lines = postContent.split('\n');
    const parsedBooks = [];
    lines.forEach((line) => {
      if (line.startsWith('📘 [')) {
        const match = line.match(/📘 \[(.*?)\] (.*)/);
        if (match) parsedBooks.push({ bookTitle: match[1], range: match[2] });
      }
    });

    setEditHomeworkList(parsedBooks.length > 0 ? parsedBooks : [{ bookTitle: '', range: '' }]);
    const memoIndex = postContent.indexOf('📝 메모:\n');
    setEditContent(memoIndex !== -1 ? postContent.substring(memoIndex + 7) : (parsedBooks.length > 0 ? '' : postContent));
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return alert('제목을 입력해주세요.');

    try {
      let finalContent = editContent;
      if (editCategory === 'HOMEWORK') {
        const bookDetails = editHomeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');
        const formLinkText = editGoogleFormUrl.trim() ? `\n\n🔗 구글 폼 링크: ${editGoogleFormUrl.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}\n\n📝 메모:\n${editContent}`;
      }

      const updateData = {
        title: editTitle,
        content: finalContent,
        category: editCategory,
        class_id: editTargetClassId === 'ALL_STUDENTS' ? null : parseInt(editTargetClassId),
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
    router.push(user?.role === 'STUDENT' ? '/student/dashboard' : '/teacher/dashboard');
  };

  const activeStudents = studentScope === 'MY_STUDENTS' ? myStudents : allStudents;
  const myClassIdList = myClasses.map((c) => c.id);

  const visiblePosts = posts.filter((post) => {
    if (user?.role === 'STUDENT') {
      if (post.class_id !== null && !myClassIds.includes(post.class_id)) return false;
    } else {
      if (post.class_id !== null && !myClassIdList.includes(post.class_id)) return false;
    }

    if (selectedClassId !== 'ALL') {
      if (selectedClassId === 'PUBLIC') {
        if (post.class_id !== null) return false;
      } else {
        if (post.class_id !== parseInt(selectedClassId)) return false;
      }
    }

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

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12 font-sans">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 
          onClick={handleHeaderTitleClick} 
          className="text-xl font-bold text-blue-600 cursor-pointer hover:opacity-80 transition"
        >
          품수학 학원 게시판
        </h1>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline font-bold">
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {/* 작성 폼 */}
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

        {/* 선생님 전용: 확인 학생 범위 옵션 */}
        {user?.role !== 'STUDENT' && (
          <div className="flex items-center justify-between bg-white p-3 px-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">👥 학생 확인 상태 표시 범위:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setStudentScope('MY_STUDENTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  studentScope === 'MY_STUDENTS'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                👤 내 담당 학생만 ({myStudents.length}명)
              </button>
              <button
                onClick={() => setStudentScope('ALL_STUDENTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  studentScope === 'ALL_STUDENTS'
                    ? 'bg-slate-800 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🌐 학원 전체 학생 ({allStudents.length}명)
              </button>
            </div>
          </div>
        )}

        {/* 4개 카테고리 & 반별 필터 탭 */}
        <CategoryTabs
          category={category}
          setCategory={setCategory}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          myClasses={myClasses}
        />

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {visiblePosts.length === 0 ? (
            <p className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs font-bold">
              선택한 게시판에 등록된 공지글이 없습니다.
            </p>
          ) : (
            visiblePosts.map((post) => (
              <PostItem
                key={post.id}
                post={post}
                user={user}
                postConfirmations={postConfirmations}
                handleOpenEdit={handleOpenEdit}
                handleDeletePost={handleDeletePost}
                togglePostConfirmation={togglePostConfirmation}
                studentScope={studentScope}
                activeStudents={activeStudents}
              />
            ))
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
    <Suspense fallback={<div className="p-8 text-center font-bold">로딩 중...</div>}>
      <BoardContent />
    </Suspense>
  );
}