'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function BoardContent() {
  const [posts, setPosts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myClassIds, setMyClassIds] = useState([]);
  
  // 학생 필터링 탭 상태 ('MY_STUDENTS' = 내 담당 학생, 'ALL_STUDENTS' = 학원 전체 학생)
  const [studentScope, setStudentScope] = useState('MY_STUDENTS');
  const [selectedClassId, setSelectedClassId] = useState('ALL');

  // 신규 작성 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState('NOTICE');
  const [targetClassId, setTargetClassId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [homeworkList, setHomeworkList] = useState([
    { bookTitle: '', range: '' },
  ]);

  // 🎯 글 수정 모달 상태
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('NOTICE');
  const [editTargetClassId, setEditTargetClassId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editGoogleFormUrl, setEditGoogleFormUrl] = useState('');
  const [editHomeworkList, setEditHomeworkList] = useState([]);

  const [allStudents, setAllStudents] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    initData(parsedUser);
  }, [searchParams]);

  const initData = async (currentUser) => {
    try {
      const { data: cData } = await supabase.from('classes').select('*');
      const allC = cData || [];
      const myC = allC.filter((c) => c.teacher_id === currentUser.id);
      
      setClasses(allC);
      setMyClasses(myC);

      if (myC.length > 0) {
        setTargetClassId(myC[0].id.toString());
      } else {
        setTargetClassId('ALL_STUDENTS');
      }

      if (currentUser.role !== 'STUDENT') {
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
        setMyClassIds(csData ? csData.map((cs) => cs.class_id) : []);
      }

      fetchPosts();
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
      fetchSubmissions();
    }
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase.from('homework_submissions').select('*');
    if (data) {
      const subMap = {};
      data.forEach((sub) => {
        subMap[`${sub.post_id}_${sub.student_id}_${sub.book_title}`] = sub.is_completed;
      });
      setSubmissions(subMap);
    }
  };

  // 교재 항목 추가/삭제 (신규)
  const handleAddBook = () => setHomeworkList([...homeworkList, { bookTitle: '', range: '' }]);
  const handleRemoveBook = (index) => setHomeworkList(homeworkList.filter((_, i) => i !== index));
  const handleBookChange = (index, field, value) => {
    const updated = [...homeworkList];
    updated[index][field] = value;
    setHomeworkList(updated);
  };

  // 교재 항목 추가/삭제 (수정용)
  const handleEditAddBook = () => setEditHomeworkList([...editHomeworkList, { bookTitle: '', range: '' }]);
  const handleEditRemoveBook = (index) => setEditHomeworkList(editHomeworkList.filter((_, i) => i !== index));
  const handleEditBookChange = (index, field, value) => {
    const updated = [...editHomeworkList];
    updated[index][field] = value;
    setEditHomeworkList(updated);
  };

  // 신규 글 등록
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

  // 🎯 글 수정 열기 모달 세팅
  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditCategory(post.category);
    setEditTargetClassId(post.class_id ? post.class_id.toString() : 'ALL_STUDENTS');
    setEditDueDate(post.due_date || new Date().toISOString().split('T')[0]);

    // 기존 본문 파싱 (교재, 구글 폼 링크, 메모 파싱)
    const formMatch = post.content.match(/🔗 구글 폼 링크: (https?:\/\/[^\s]+)/);
    setEditGoogleFormUrl(formMatch ? formMatch[1] : '');

    const lines = post.content.split('\n');
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

    // 메모 추출
    const memoIndex = post.content.indexOf('📝 메모:\n');
    if (memoIndex !== -1) {
      setEditContent(post.content.substring(memoIndex + 7));
    } else if (parsedBooks.length > 0) {
      setEditContent('');
    } else {
      setEditContent(post.content);
    }
  };

  // 🎯 수정사항 저장 처리
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

  // 글 삭제
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

  const toggleHomeworkStatus = async (postId, studentId, bookTitle) => {
    const key = `${postId}_${studentId}_${bookTitle}`;
    const currentStatus = submissions[key] || false;
    const nextStatus = !currentStatus;

    const { error } = await supabase
      .from('homework_submissions')
      .upsert(
        { post_id: postId, student_id: studentId, book_title: bookTitle, is_completed: nextStatus },
        { onConflict: 'post_id,student_id,book_title' }
      );

    if (!error) {
      setSubmissions((prev) => ({ ...prev, [key]: nextStatus }));
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
            <h2 className="font-bold text-lg text-gray-800">✍️ 반별 공지 및 숙제 작성 ({user.name} 선생님)</h2>
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
                  <option value="NOTICE">📢 공지사항</option>
                  <option value="HOMEWORK">📝 숙제 알림</option>
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

        {/* 숙제 검사 대상 범위 설정 */}
        {user?.role !== 'STUDENT' && (
          <div className="flex items-center justify-between bg-white p-3 px-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">👥 숙제 검사 학생 범위:</span>
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

        {/* 내 반 전용 필터 버튼 상단 표시 */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedClassId('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedClassId === 'ALL' ? 'bg-slate-900 text-white shadow' : 'bg-white border text-slate-600'}`}
            >
              전체 보기
            </button>

            {myClasses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id.toString())}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedClassId === c.id.toString() ? 'bg-indigo-600 text-white shadow' : 'bg-white border text-indigo-800'}`}
              >
                🎯 {c.name}
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
              const bookLines = post.content
                .split('\n')
                .filter((line) => line.startsWith('📘 ['));

              const formMatch = post.content.match(/🔗 구글 폼 링크: (https?:\/\/[^\s]+)/);
              const formUrl = formMatch ? formMatch[1] : null;

              const isMyPost = user?.id === post.author_id;

              return (
                <div key={post.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">
                        {post.category === 'NOTICE' && '📢 공지사항'}
                        {post.category === 'HOMEWORK' && '📝 숙제 알림'}
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
                    
                    {/* 🎯 [추가] 내가 작성한 글일 때만 수정/삭제 버튼 표시 */}
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

                  {user?.role !== 'STUDENT' && post.category === 'HOMEWORK' && bookLines.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 bg-slate-50 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-700">✅ 교재별 숙제 제출 검사표</p>
                        <span className="text-[10px] font-bold text-blue-600">
                          {studentScope === 'MY_STUDENTS' ? '👤 내 담당 학생만 보기' : '🌐 학원 전체 학생 보기'}
                        </span>
                      </div>

                      {bookLines.map((line, idx) => {
                        const bookTitle = line.match(/\[(.*?)\]/)?.[1] || `교재${idx + 1}`;
                        return (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-xs font-bold text-blue-700 block">📘 {bookTitle}</span>
                            <div className="flex flex-wrap gap-2">
                              {activeStudents.length === 0 ? (
                                <span className="text-xs text-slate-400">해당 범위의 학생이 없습니다.</span>
                              ) : (
                                activeStudents.map((st) => {
                                  const key = `${post.id}_${st.id}_${bookTitle}`;
                                  const isDone = submissions[key];
                                  return (
                                    <button
                                      key={st.id}
                                      onClick={() => toggleHomeworkStatus(post.id, st.id, bookTitle)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                        isDone
                                          ? 'bg-emerald-600 text-white shadow'
                                          : 'bg-slate-100 border text-slate-500 hover:bg-slate-200'
                                      }`}
                                    >
                                      {st.name} {isDone ? '✓ 완료' : '미제출'}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 🎯 [추가] 글 수정 모달 팝업 */}
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
                  <option value="NOTICE">📢 공지사항</option>
                  <option value="HOMEWORK">📝 숙제 알림</option>
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
                      📋 구글 설문지 제출 링크 (선택)
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