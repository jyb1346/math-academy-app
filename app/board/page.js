'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function BoardContent() {
  const [posts, setPosts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myClassIds, setMyClassIds] = useState([]);
  
  const [studentScope, setStudentScope] = useState('MY_STUDENTS');
  const [selectedClassId, setSelectedClassId] = useState('ALL');

  // 신규 작성 폼 상태
  const [category, setCategory] = useState('ALL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState('HOMEWORK');
  const [targetClassId, setTargetClassId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [homeworkList, setHomeworkList] = useState([
    { bookTitle: '', range: '' },
  ]);

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
  
  // 🎯 학생 숙제 공지 확인 상태 저장 (post_id -> Set of student_id)
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

  // 🎯 학생들의 공지 확인 내역 가져오기
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

  // 🎯 학생이 직접 [공지 및 숙제 확인 완료] 버튼 클릭 시 토글 처리
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
      let finalContent = content;
      if (newCategory === 'HOMEWORK') {
        const bookDetails = homeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');
        
        const formLinkText = googleFormUrl.trim() ? `\n\n🔗 구글 폼 링크: ${googleFormUrl.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}\n\n📝 메모:\n${content}`;
      }

      const postData = {
        title,
        content: finalContent,
        category: newCategory,
        author_id: user.id,
        class_id: targetClassId === 'ALL_STUDENTS' ? null : parseInt(targetClassId),
        due_date: newCategory === 'HOMEWORK' ? dueDate : null,
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      setTitle('');
      setContent('');
      setGoogleFormUrl('');
      setHomeworkList([{ bookTitle: '', range: '' }]);
      fetchPosts();
      alert('등록되었습니다.');
    } catch (err) {
      console.error(err);
      alert('등록 실패');
    }
  };

  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditTitle(post.title || '');
    setEditCategory(post.category || 'NOTICE');
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

  const activeStudents = studentScope === 'MY_STUDENTS' ? myStudents : allStudents;
  const myClassIdList = myClasses.map((c) => c.id);

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

    if (selectedClassId !== 'ALL') {
      if (selectedClassId === 'PUBLIC') return post.class_id === null;
      return post.class_id === parseInt(selectedClassId);
    }
    if (category !== 'ALL') {
      return post.category === category;
    }
    return true;
  });

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 onClick={() => router.push('/')} className="text-xl font-bold text-blue-600 cursor-pointer">
          품수학 학원 게시판
        </h1>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline font-bold">
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        {/* 선생님/원장님용 공지 작성 */}
        {user?.role !== 'STUDENT' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800">✍️ 반별 공지 및 숙제 작성 ({user?.name || ''} 선생님)</h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="p-2.5 border rounded-xl text-sm bg-indigo-50 border-indigo-200 font-bold text-indigo-900"
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
                  className="p-2.5 border rounded-xl text-sm bg-gray-50 font-semibold"
                >
                  <option value="HOMEWORK">📝 숙제 알림</option>
                  <option value="NOTICE">📢 공지사항</option>
                  <option value="VIDEO">🎬 복습 영상</option>
                  <option value="MATERIAL">📄 강의 자료</option>
                </select>

                {newCategory === 'HOMEWORK' && (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="p-2.5 border rounded-xl text-sm bg-blue-50 border-blue-200 font-bold text-blue-700"
                  />
                )}
              </div>

              <input
                type="text"
                placeholder="제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-sm font-medium"
              />

              {newCategory === 'HOMEWORK' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록</span>
                    <button
                      type="button"
                      onClick={handleAddBook}
                      className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
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
                        className="w-1/3 p-2 border rounded-lg text-sm bg-white font-medium"
                      />
                      <input
                        type="text"
                        placeholder="범위 (예: p.45 ~ p.50)"
                        value={item.range}
                        onChange={(e) => handleBookChange(index, 'range', e.target.value)}
                        className="flex-1 p-2 border rounded-lg text-sm bg-white font-medium"
                      />
                      {homeworkList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBook(index)}
                          className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      📋 구글 설문지 제출 링크 (선택)
                    </label>
                    <input
                      type="url"
                      placeholder="https://forms.gle/..."
                      value={googleFormUrl}
                      onChange={(e) => setGoogleFormUrl(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <textarea
                placeholder="내용을 적어주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm h-20"
              />

              <div className="flex justify-end">
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow transition">
                  등록하기
                </button>
              </div>
            </form>
          </div>
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

        {/* 반별 필터 버튼 */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedClassId('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedClassId === 'ALL' ? 'bg-slate-900 text-white shadow' : 'bg-white border text-slate-600'}`}
            >
              전체 공지 보기
            </button>

            {myClasses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id.toString())}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedClassId === c.id.toString() ? 'bg-indigo-600 text-white shadow' : 'bg-white border text-indigo-800'}`}
              >
                🎯 [{c.name}] 내 반 공지
              </button>
            ))}

            <button
              onClick={() => setSelectedClassId('PUBLIC')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedClassId === 'PUBLIC' ? 'bg-slate-700 text-white shadow' : 'bg-slate-100 border text-slate-500'}`}
            >
              🌐 학원 전체 공지
            </button>
          </div>
        </div>

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {visiblePosts.length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-xs font-bold">등록된 공지글이 없습니다.</p>
          ) : (
            visiblePosts.map((post) => {
              const postContent = post.content || '';
              const formMatch = postContent.match(/🔗 구글 폼 링크: (https?:\/\/[^\s]+)/);
              const formUrl = formMatch ? formMatch[1] : null;

              const isMyPost = user?.id === post.author_id;
              const isConfirmedByMe = postConfirmations[post.id]?.has(user?.id);

              return (
                <div key={post.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">
                        {post.category === 'HOMEWORK' && '📝 숙제 알림'}
                        {post.category === 'NOTICE' && '📢 공지사항'}
                        {post.category === 'VIDEO' && '🎬 복습 영상'}
                        {post.category === 'MATERIAL' && '📄 강의 자료'}
                      </span>
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
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>

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

                  {/* 🎯 [학생 전용] 숙제/공지 확인 완료 버튼 */}
                  {user?.role === 'STUDENT' && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
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
              <h3 className="text-lg font-bold text-slate-800">✏️ 공지/숙제 게시글 수정</h3>
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
                  <option value="MATERIAL">📄 강의 자료</option>
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