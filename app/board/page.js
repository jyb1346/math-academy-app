'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

// 🎯 유튜브 URL에서 Video ID 추출 함수
function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// 🎯 본문 텍스트 내 URL을 파란색 클릭 가능한 링크로 변환하는 렌더링 컴포넌트
function FormattedContent({ text }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(urlRegex);

  return (
    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-bold hover:underline break-all inline-flex items-center gap-1 my-0.5"
            >
              🔗 {part} ↗
            </a>
          );
        }
        return part;
      })}
    </p>
  );
}

function BoardContent() {
  const [posts, setPosts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myClassIds, setMyClassIds] = useState([]);
  
  const [studentScope, setStudentScope] = useState('MY_STUDENTS');
  const [selectedClassId, setSelectedClassId] = useState('ALL');

  // 🎯 카테고리 필터 상태: ALL(전체), NOTICE_HOMEWORK(숙제 및 반별 공지사항), VIDEO(복습영상), MATERIAL(수업자료), QNA(질의응답)
  const [category, setCategory] = useState('ALL');

  // 신규 작성 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState('HOMEWORK');
  const [targetClassId, setTargetClassId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [homeworkList, setHomeworkList] = useState([
    { bookTitle: '', range: '' },
  ]);

  // 📄/🖼️ 파일 및 질문 사진 첨부 상태
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 💬 Q&A 답변 댓글 관련 상태
  const [replies, setReplies] = useState({});
  const [replyInput, setReplyInput] = useState({});
  const [openReplyBox, setOpenReplyBox] = useState({});

  // 글 수정 모달 상태
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

        if (myC.length > 0) {
          setTargetClassId(myC[0].id.toString());
        } else {
          setTargetClassId('ALL_STUDENTS');
        }

        const { data: stData } = await supabase.from('users').select('*').eq('role', 'STUDENT');
        const allSt = stData || [];
        setAllStudents(allSt);

        const mySt = allSt.filter((s) => s.teacher_id === currentUser.id);
        setMyStudents(mySt);
      } else {
        const { data: csData } = await supabase
          .from('class_students')
          .select('class_id')
          .eq('student_id', currentUser.id);
        
        const myCIds = csData ? csData.map((cs) => cs.class_id) : [];
        setMyClassIds(myCIds);

        const studentMyClasses = allC.filter((c) => myCIds.includes(c.id));
        setMyClasses(studentMyClasses);
      }

      await fetchPosts();
      await fetchReplies();
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
        if (!confirmMap[item.post_id]) {
          confirmMap[item.post_id] = new Set();
        }
        confirmMap[item.post_id].add(item.student_id);
      });
      setPostConfirmations(confirmMap);
    }
  };

  const fetchReplies = async () => {
    try {
      const { data, error } = await supabase
        .from('post_replies')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        const replyMap = {};
        data.forEach((r) => {
          if (!replyMap[r.post_id]) replyMap[r.post_id] = [];
          replyMap[r.post_id].push(r);
        });
        setReplies(replyMap);
      }
    } catch (e) {
      console.warn('post_replies table exception:', e);
    }
  };

  const handleAddReply = async (postId) => {
    const text = replyInput[postId];
    if (!text || !text.trim()) return alert('답변 내용을 입력해주세요.');

    try {
      const replyData = {
        post_id: postId,
        author_id: user.id,
        author_name: user.name || (user.role === 'STUDENT' ? '학생' : '선생님'),
        content: text.trim(),
      };

      const { error } = await supabase.from('post_replies').insert([replyData]);
      if (error) throw error;

      setReplyInput((prev) => ({ ...prev, [postId]: '' }));
      fetchReplies();
      alert('답변이 등록되었습니다.');
    } catch (err) {
      console.error(err);
      alert('답변 등록 실패: ' + err.message);
    }
  };

  const handleDeleteReply = async (replyId) => {
    if (!confirm('답변을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('post_replies').delete().eq('id', replyId);
      if (error) throw error;
      fetchReplies();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const togglePostConfirmation = async (postId) => {
    if (!user || user.role !== 'STUDENT') return;

    const isConfirmed = postConfirmations[postId]?.has(user.id);

    if (isConfirmed) {
      const { error } = await supabase
        .from('post_confirmations')
        .delete()
        .eq('post_id', postId)
        .eq('student_id', user.id);

      if (!error) {
        setPostConfirmations((prev) => {
          const updated = { ...prev };
          if (updated[postId]) {
            updated[postId].delete(user.id);
          }
          return { ...updated };
        });
      }
    } else {
      const { error } = await supabase
        .from('post_confirmations')
        .insert([{ post_id: postId, student_id: user.id }]);

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

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, attachedFile);

        if (uploadError) {
          console.warn('Storage upload error:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);
          filePublicUrl = urlData?.publicUrl;
        }
      }

      // 현재 선택된 카테고리 태그 상태(category)에 맞게 등록 카테고리 결정
      const targetCategory = category === 'QNA' ? 'QNA' : newCategory;

      let finalContent = content;
      if (targetCategory === 'HOMEWORK') {
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
        category: targetCategory,
        author_id: user.id,
        class_id: targetClassId === 'ALL_STUDENTS' || !targetClassId ? null : parseInt(targetClassId),
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
    if (user?.role === 'STUDENT') {
      router.push('/student/dashboard');
    } else {
      router.push('/teacher/dashboard');
    }
  };

  const activeStudents = studentScope === 'MY_STUDENTS' ? myStudents : allStudents;
  const myClassIdList = myClasses.map((c) => c.id);

  // 🎯 카테고리 필터링 적용된 게시글 목록
  const visiblePosts = posts.filter((post) => {
    if (user?.role === 'STUDENT') {
      if (post.class_id !== null && !myClassIds.includes(post.class_id)) {
        return false;
      }
    } else {
      if (post.class_id !== null && !myClassIdList.includes(post.class_id)) {
        return false;
      }
    }

    // 반별 선택 필터
    if (selectedClassId !== 'ALL') {
      if (selectedClassId === 'PUBLIC') {
        if (post.class_id !== null) return false;
      } else {
        if (post.class_id !== parseInt(selectedClassId)) return false;
      }
    }

    // 🎯 4대 카테고리 필터
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
        
        {/* 🎯 [주요 개편] 4개 카테고리 분류 탭 (최상단 배치) */}
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
            <button
              onClick={() => setCategory('ALL')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap ${
                category === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              🌐 전체보기
            </button>
            <button
              onClick={() => setCategory('NOTICE_HOMEWORK')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap ${
                category === 'NOTICE_HOMEWORK'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              1️⃣ 📝 숙제 및 반별 공지사항
            </button>
            <button
              onClick={() => setCategory('VIDEO')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap ${
                category === 'VIDEO'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              2️⃣ 🎬 복습영상 게시판
            </button>
            <button
              onClick={() => setCategory('MATERIAL')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap ${
                category === 'MATERIAL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              3️⃣ 📄 수업자료 게시판
            </button>
            <button
              onClick={() => setCategory('QNA')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap ${
                category === 'QNA'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              4️⃣ 💬 질의응답 (Q&A 질문)
            </button>
          </div>

          {/* 반별 서브 필터 버튼 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedClassId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedClassId === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              전체 반
            </button>

            {myClasses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id.toString())}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  selectedClassId === c.id.toString() ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                🎯 [{c.name}]
              </button>
            ))}

            <button
              onClick={() => setSelectedClassId('PUBLIC')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedClassId === 'PUBLIC' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              🌐 학원 전체 공지
            </button>
          </div>
        </div>

        {/* 🎯 카테고리에 맞춰 독립적으로 노출되는 스마트 작성 폼 */}
        {category === 'QNA' ? (
          /* 💬 질의응답 (Q&A) 전용 질문 작성 폼 */
          <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 shadow-xs space-y-3">
            <h2 className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
              <span>❓ 선생님께 질문 작성하기</span>
              <span className="text-xs font-normal text-amber-700">({user?.name} 학생)</span>
            </h2>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="p-2 border rounded-xl text-xs bg-white font-bold text-slate-700"
                >
                  <optgroup label="📘 내 반 선택">
                    {myClasses.map((c) => (
                      <option key={c.id} value={c.id}>🎯 [{c.name}] 반 질문</option>
                    ))}
                  </optgroup>
                  <optgroup label="──────">
                    <option value="ALL_STUDENTS">🌐 학원 전체 질문</option>
                  </optgroup>
                </select>

                <input
                  type="text"
                  placeholder="질문 제목 (예: 개념쎈 45페이지 3번 문제 질문입니다)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 p-2 border rounded-xl text-xs font-medium bg-white"
                />
              </div>

              {/* 📸 문제 사진 첨부 전용 영역 */}
              <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700">📸 모르는 문제 사진 첨부 (선택)</label>
                  <p className="text-[10px] text-slate-400">교재나 시험지 사진을 찍어서 올려주시면 선생님이 답변해 드립니다.</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAttachedFile(e.target.files[0] || null)}
                  className="text-xs font-semibold text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                />
              </div>

              <textarea
                placeholder="궁금한 문제나 개념 질문을 적어주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs h-20 bg-white"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-xs transition"
                >
                  {uploading ? '사진 질문 등록 중...' : '💬 질문 등록하기'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ✍️ 선생님 전용 일반 공지/숙제 작성 폼 (선생님 로그인 시에만 노출) */
          user?.role !== 'STUDENT' && (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <h2 className="font-bold text-sm text-gray-800">✍️ 반별 공지 및 게시글 작성 ({user?.name || ''} 선생님)</h2>
              <form onSubmit={handleCreatePost} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="p-2 border rounded-xl text-xs bg-indigo-50 border-indigo-200 font-bold text-indigo-900"
                  >
                    <optgroup label="📘 내 담당 반 목록">
                      {myClasses.length === 0 ? (
                        <option value="" disabled>개설된 내 반이 없습니다</option>
                      ) : (
                        myClasses.map((c) => (
                          <option key={c.id} value={c.id}>🎯 [{c.name}] 전용 공지</option>
                        ))
                      )}
                    </optgroup>
                    <optgroup label="──────────────────">
                      <option value="ALL_STUDENTS">📢 학원 전체 학생 공지</option>
                    </optgroup>
                  </select>

                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="p-2 border rounded-xl text-xs bg-gray-50 font-semibold"
                  >
                    <option value="HOMEWORK">📝 숙제 알림</option>
                    <option value="NOTICE">📢 공지사항</option>
                    <option value="VIDEO">🎬 복습 영상</option>
                    <option value="MATERIAL">📄 수업자료 (JPG/PDF)</option>
                  </select>

                  {newCategory === 'HOMEWORK' && (
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="p-2 border rounded-xl text-xs bg-blue-50 border-blue-200 font-bold text-blue-700"
                    />
                  )}
                </div>

                <input
                  type="text"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-medium"
                />

                {newCategory === 'HOMEWORK' && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록</span>
                      <button
                        type="button"
                        onClick={handleAddBook}
                        className="text-[11px] bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-blue-700 transition"
                      >
                        + 교재 추가
                      </button>
                    </div>

                    {homeworkList.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="교재명 (예: 개념쎈)"
                          value={item.bookTitle}
                          onChange={(e) => handleBookChange(index, 'bookTitle', e.target.value)}
                          className="w-1/3 p-2 border rounded-lg text-xs bg-white font-medium"
                        />
                        <input
                          type="text"
                          placeholder="범위 (예: p.45 ~ p.50)"
                          value={item.range}
                          onChange={(e) => handleBookChange(index, 'range', e.target.value)}
                          className="flex-1 p-2 border rounded-lg text-xs bg-white font-medium"
                        />
                        {homeworkList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBook(index)}
                            className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-1.5 rounded-lg"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        📋 구글 설문지 제출 링크 (선택)
                      </label>
                      <input
                        type="url"
                        placeholder="https://forms.gle/..."
                        value={googleFormUrl}
                        onChange={(e) => setGoogleFormUrl(e.target.value)}
                        className="w-full p-2 border rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200/80 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-emerald-900">
                      📎 첨부파일 등록 (JPG, PNG, PDF 지원)
                    </label>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setAttachedFile(e.target.files[0] || null)}
                    className="text-xs font-semibold text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                </div>

                <textarea
                  placeholder="내용을 적어주세요. (유튜브 링크 입력 시 재생 플레이어가 생성됩니다)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs h-20"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-xs transition"
                  >
                    {uploading ? '등록 중...' : '등록하기'}
                  </button>
                </div>
              </form>
            </div>
          )
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
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                👤 내 담당 학생만 ({myStudents.length}명)
              </button>
              <button
                onClick={() => setStudentScope('ALL_STUDENTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  studentScope === 'ALL_STUDENTS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🌐 학원 전체 학생 ({allStudents.length}명)
              </button>
            </div>
          </div>
        )}

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {visiblePosts.length === 0 ? (
            <p className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs font-bold">
              선택한 게시판에 등록된 공지글이나 질문이 없습니다.
            </p>
          ) : (
            visiblePosts.map((post) => {
              const postContent = post.content || '';
              const formMatch = postContent.match(/🔗 구글 폼 링크: (https?:\/\/[^\s]+)/);
              const formUrl = formMatch ? formMatch[1] : null;

              const fileMatch = postContent.match(/📎 첨부파일: (https?:\/\/[^\s]+)/);
              const fileUrl = fileMatch ? fileMatch[1] : null;
              const isImage = fileUrl && (fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || fileUrl.includes('image'));

              const ytId = getYouTubeId(postContent);

              const isMyPost = user?.id === post.author_id;
              const isConfirmedByMe = postConfirmations[post.id]?.has(user?.id);
              const postReplies = replies[post.id] || [];
              const isReplied = postReplies.length > 0;

              return (
                <div key={post.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-blue-600">
                        {post.category === 'HOMEWORK' && '📝 숙제 알림'}
                        {post.category === 'NOTICE' && '📢 공지사항'}
                        {post.category === 'VIDEO' && '🎬 복습 영상'}
                        {post.category === 'MATERIAL' && '📄 수업 자료'}
                        {post.category === 'QNA' && '💬 질의응답'}
                      </span>

                      {/* 🎯 Q&A 답변 여부 상태 배지 */}
                      {post.category === 'QNA' && (
                        isReplied ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            ✅ 답변 완료 ({postReplies.length})
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                            ⏳ 답변 대기중
                          </span>
                        )
                      )}

                      {post.classes ? (
                        <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
                          🎯 {post.classes.name}
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                          🌐 학원 전체 공지
                        </span>
                      )}
                      {post.due_date && (
                        <span className="bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-bold">
                          📅 마감일: {post.due_date}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isMyPost && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(post)}
                            className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1 rounded-lg font-bold border border-amber-200 transition"
                          >
                            ✏️ 수정
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id, post.title)}
                            className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-2.5 py-1 rounded-lg font-bold border border-rose-200 transition"
                          >
                            삭제
                          </button>
                        </>
                      )}
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-gray-800">{post.title}</h3>
                  
                  {/* 🎯 자동 링크 연결 텍스트 */}
                  <FormattedContent text={post.content.replace(/📎 첨부파일: https?:\/\/[^\s]+/, '')} />

                  {/* 📸 문제 사진 / 이미지 미리보기 */}
                  {isImage && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2">
                      <img
                        src={fileUrl}
                        alt="질문 문제 사진"
                        className="w-full max-h-96 object-contain rounded-xl"
                      />
                    </div>
                  )}

                  {/* 📄 PDF 및 기타 첨부파일 다운로드 버튼 */}
                  {fileUrl && !isImage && (
                    <div className="pt-2">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition"
                      >
                        <span>📄 첨부 파일 받기</span>
                        <span>⬇️</span>
                      </a>
                    </div>
                  )}

                  {/* 🎬 유튜브 영상 자동 플레이어 임베드 */}
                  {ytId && (
                    <div className="mt-3 aspect-video w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title="YouTube video player"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  {formUrl && (
                    <div className="pt-2">
                      <a
                        href={formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition"
                      >
                        <span>📋 구글 폼 숙제 제출하기</span>
                        <span>↗</span>
                      </a>
                    </div>
                  )}

                  {/* 💬 Q&A / 댓글 영역 토글 버튼 및 답변 수 */}
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <button
                      onClick={() => setOpenReplyBox((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                    >
                      <span>💬 선생님 답변 / 댓글 ({postReplies.length})</span>
                      <span>{openReplyBox[post.id] ? '▲' : '▼'}</span>
                    </button>

                    {/* 🎯 [학생 전용] 숙제/공지 확인 완료 버튼 */}
                    {user?.role === 'STUDENT' && (
                      <button
                        onClick={() => togglePostConfirmation(post.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 ${
                          isConfirmedByMe
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>{isConfirmedByMe ? '✓ 숙제 및 공지 확인 완료' : '☐ 공지 확인하기'}</span>
                      </button>
                    )}
                  </div>

                  {/* 💬 Q&A 답변 댓글 목록 및 입력 창 */}
                  {openReplyBox[post.id] && (
                    <div className="mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-slate-700">💬 질문 답변 및 댓글 목록</p>

                      {postReplies.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium py-2">등록된 선생님 답변이나 댓글이 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {postReplies.map((r) => (
                            <div key={r.id} className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                              <div className="flex justify-between items-center text-[11px] text-slate-500 font-bold">
                                <span className="text-indigo-600 font-extrabold">👨‍🏫 {r.author_name || '선생님'}</span>
                                <div className="flex items-center gap-2">
                                  <span>{new Date(r.created_at).toLocaleString()}</span>
                                  {(user?.id === r.author_id || user?.role !== 'STUDENT') && (
                                    <button
                                      onClick={() => handleDeleteReply(r.id)}
                                      className="text-rose-500 hover:underline"
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 💬 답변 입력 폼 */}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder={user?.role !== 'STUDENT' ? "학생 질문에 답변을 입력하세요..." : "추가 문의사항을 적어주세요..."}
                          value={replyInput[post.id] || ''}
                          onChange={(e) => setReplyInput({ ...replyInput, [post.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddReply(post.id);
                          }}
                          className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleAddReply(post.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition whitespace-nowrap shadow-xs"
                        >
                          답변 등록
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 🎯 [선생님 전용] 학생 공지/숙제 확인 현황 표 */}
                  {user?.role !== 'STUDENT' && (
                    <div className="mt-4 pt-3 border-t border-gray-100 bg-slate-50 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-700">👀 학생 공지/숙제 확인 현황</p>
                        <span className="text-[10px] font-bold text-blue-600">
                          {studentScope === 'MY_STUDENTS' ? '👤 내 담당 학생만 보기' : '🌐 학원 전체 학생 보기'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {activeStudents.length === 0 ? (
                          <span className="text-xs text-slate-400">해당 범위의 학생이 없습니다.</span>
                        ) : (
                          activeStudents.map((st) => {
                            const isConfirmed = postConfirmations[post.id]?.has(st.id);
                            return (
                              <span
                                key={st.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                  isConfirmed
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-white text-slate-400 border-slate-200'
                                }`}
                              >
                                {st.name} {isConfirmed ? '✓ 확인완료' : '미확인'}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 글 수정 모달 */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">✏️ 게시글 수정</h3>
              <button onClick={() => setEditingPost(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">닫기</button>
            </div>

            <form onSubmit={handleUpdatePost} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={editTargetClassId}
                  onChange={(e) => setEditTargetClassId(e.target.value)}
                  className="p-2.5 border rounded-xl text-sm bg-indigo-50 border-indigo-200 font-bold text-indigo-900"
                >
                  <optgroup label="📘 내 담당 반 목록">
                    {myClasses.map((c) => (
                      <option key={c.id} value={c.id}>🎯 [{c.name}] 전용 공지</option>
                    ))}
                  </optgroup>
                  <optgroup label="──────────────────">
                    <option value="ALL_STUDENTS">📢 학원 전체 학생 공지</option>
                  </optgroup>
                </select>

                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="p-2.5 border rounded-xl text-sm bg-gray-50 font-semibold"
                >
                  <option value="HOMEWORK">📝 숙제 알림</option>
                  <option value="NOTICE">📢 공지사항</option>
                  <option value="VIDEO">🎬 복습 영상</option>
                  <option value="MATERIAL">📄 수업 자료</option>
                  <option value="QNA">💬 질의응답</option>
                </select>

                {editCategory === 'HOMEWORK' && (
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="p-2.5 border rounded-xl text-sm bg-blue-50 border-blue-200 font-bold text-blue-700"
                  />
                )}
              </div>

              <input
                type="text"
                placeholder="제목을 입력하세요"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-sm font-medium"
              />

              {editCategory === 'HOMEWORK' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록 수정</span>
                    <button
                      type="button"
                      onClick={handleEditAddBook}
                      className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                    >
                      + 교재 추가
                    </button>
                  </div>

                  {editHomeworkList.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="교재명"
                        value={item.bookTitle}
                        onChange={(e) => handleEditBookChange(index, 'bookTitle', e.target.value)}
                        className="w-1/3 p-2 border rounded-lg text-sm bg-white font-medium"
                      />
                      <input
                        type="text"
                        placeholder="범위"
                        value={item.range}
                        onChange={(e) => handleEditBookChange(index, 'range', e.target.value)}
                        className="flex-1 p-2 border rounded-lg text-sm bg-white font-medium"
                      />
                      {editHomeworkList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEditRemoveBook(index)}
                          className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      📋 숙제 제출 링크 (선택)
                    </label>
                    <input
                      type="url"
                      placeholder="https://forms.gle/..."
                      value={editGoogleFormUrl}
                      onChange={(e) => setEditGoogleFormUrl(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <textarea
                placeholder="내용을 적어주세요."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm h-28"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="w-1/2 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs shadow hover:bg-indigo-700 transition"
                >
                  수정사항 저장하기
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
    <Suspense fallback={<div className="p-8 text-center font-bold">로딩 중...</div>}>
      <BoardContent />
    </Suspense>
  );
}