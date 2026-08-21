'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function BoardContent() {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState('NOTICE');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 교재별 다중 숙제 목록 상태
  const [homeworkList, setHomeworkList] = useState([
    { bookTitle: '', range: '' },
  ]);

  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const paramCategory = searchParams ? searchParams.get('category') : null;
    if (paramCategory) setCategory(paramCategory);

    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    if (parsedUser.role === 'TEACHER') fetchStudents();
    fetchPosts();
  }, [searchParams]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('users').select('id, name').eq('role', 'STUDENT');
    setStudents(data || []);
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
      fetchSubmissions();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  // 교재 입력 항목 추가/삭제/변경 함수
  const handleAddBook = () => {
    setHomeworkList([...homeworkList, { bookTitle: '', range: '' }]);
  };

  const handleRemoveBook = (index) => {
    setHomeworkList(homeworkList.filter((_, i) => i !== index));
  };

  const handleBookChange = (index, field, value) => {
    const updated = [...homeworkList];
    updated[index][field] = value;
    setHomeworkList(updated);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('제목을 입력해주세요.');

    try {
      // 숙제 카테고리일 경우 교재별 숙제 목록을 본문 텍스트에 조합하여 저장
      let finalContent = content;
      if (newCategory === 'HOMEWORK') {
        const bookDetails = homeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');
        
        finalContent = `${bookDetails}\n\n📝 메모:\n${content}`;
      }

      const postData = {
        title,
        content: finalContent,
        category: newCategory,
        author_id: user.id,
        due_date: newCategory === 'HOMEWORK' ? dueDate : null,
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      setTitle('');
      setContent('');
      setHomeworkList([{ bookTitle: '', range: '' }]);
      fetchPosts();
      alert('성공적으로 등록되었습니다.');
    } catch (err) {
      console.error(err);
      alert('등록 실패');
    }
  };

  // 교재별/학생별 숙제 토글
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

  const filteredPosts = category === 'ALL' ? posts : posts.filter((p) => p.category === category);

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 onClick={() => router.push('/')} className="text-xl font-bold text-blue-600 cursor-pointer">
          품수학 학원 게시판
        </h1>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {user?.role === 'TEACHER' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800">✍️ 게시글 / 숙제 작성</h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
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

                <input
                  type="text"
                  placeholder="제목 (예: 8/21(금) 수학I 과제 안내)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 p-2.5 border rounded-xl text-sm"
                />
              </div>

              {/* 숙제 선택 시 교재별 다중 숙제 입력 UI */}
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
                        className="w-1/3 p-2 border rounded-lg text-sm bg-white"
                      />
                      <input
                        type="text"
                        placeholder="범위 (예: p.45 ~ p.50 및 채점)"
                        value={item.range}
                        onChange={(e) => handleBookChange(index, 'range', e.target.value)}
                        className="flex-1 p-2 border rounded-lg text-sm bg-white"
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
                </div>
              )}

              <textarea
                placeholder="추가 안내사항이나 전달사항을 적어주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm h-20"
              />

              <div className="flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 shadow">
                  등록하기
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['ALL', 'NOTICE', 'HOMEWORK', 'VIDEO', 'MATERIAL'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                category === cat ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat === 'ALL' && '전체'}
              {cat === 'NOTICE' && '📢 공지사항'}
              {cat === 'HOMEWORK' && '📝 숙제 알림'}
              {cat === 'VIDEO' && '🎬 복습 영상'}
              {cat === 'MATERIAL' && '📄 강의 자료'}
            </button>
          ))}
        </div>

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <p className="text-center py-8 text-gray-500">등록된 게시글이 없습니다.</p>
          ) : (
            filteredPosts.map((post) => {
              // 본문 텍스트에서 교재목록 추출
              const bookLines = post.content
                .split('\n')
                .filter((line) => line.startsWith('📘 ['));

              return (
                <div key={post.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">
                        {post.category === 'NOTICE' && '📢 공지사항'}
                        {post.category === 'HOMEWORK' && '📝 숙제 알림'}
                        {post.category === 'VIDEO' && '🎬 복습 영상'}
                        {post.category === 'MATERIAL' && '📄 강의 자료'}
                      </span>
                      {post.due_date && (
                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">
                          📅 마감일: {post.due_date}
                        </span>
                      )}
                    </div>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>

                  <h3 className="font-bold text-base text-gray-800">{post.title}</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {/* 선생님용 교재별/학생별 숙제 검사표 */}
                  {user?.role === 'TEACHER' && post.category === 'HOMEWORK' && bookLines.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 bg-slate-50 p-4 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-slate-700">✅ 교재별 숙제 제출 검사표</p>
                      {bookLines.map((line, idx) => {
                        const bookTitle = line.match(/\[(.*?)\]/)?.[1] || `교재${idx + 1}`;
                        return (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                            <span className="text-xs font-bold text-blue-700 block">📘 {bookTitle}</span>
                            <div className="flex flex-wrap gap-2">
                              {students.map((st) => {
                                const key = `${post.id}_${st.id}_${bookTitle}`;
                                const isDone = submissions[key];
                                return (
                                  <button
                                    key={st.id}
                                    onClick={() => toggleHomeworkStatus(post.id, st.id, bookTitle)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                                      isDone
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 border text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {st.name} {isDone ? '✓ 완료' : '미제출'}
                                  </button>
                                );
                              })}
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
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <BoardContent />
    </Suspense>
  );
}