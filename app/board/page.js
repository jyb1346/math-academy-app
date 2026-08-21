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
        subMap[`${sub.post_id}_${sub.student_id}`] = sub.is_completed;
      });
      setSubmissions(subMap);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const postData = {
        title,
        content,
        category: newCategory,
        author_id: user.id,
        due_date: newCategory === 'HOMEWORK' ? dueDate : null,
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      setTitle('');
      setContent('');
      fetchPosts();
      alert('게시글이 성공적으로 등록되었습니다.');
    } catch (err) {
      console.error(err);
      alert('글 작성에 실패했습니다.');
    }
  };

  // 학생 숙제 검사 토글 함수
  const toggleHomeworkStatus = async (postId, studentId) => {
    const currentStatus = submissions[`${postId}_${studentId}`] || false;
    const nextStatus = !currentStatus;

    const { error } = await supabase
      .from('homework_submissions')
      .upsert(
        { post_id: postId, student_id: studentId, is_completed: nextStatus },
        { onConflict: 'post_id,student_id' }
      );

    if (!error) {
      setSubmissions((prev) => ({
        ...prev,
        [`${postId}_${studentId}`]: nextStatus,
      }));
    }
  };

  const filteredPosts =
    category === 'ALL' ? posts : posts.filter((p) => p.category === category);

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
        {/* 선생님 글쓰기 폼 */}
        {user?.role === 'TEACHER' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800">✍️ 게시글 / 숙제 작성</h2>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="p-2 border rounded-lg text-sm bg-gray-50"
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
                    className="p-2 border rounded-lg text-sm bg-blue-50 border-blue-200 font-bold text-blue-700"
                  />
                )}

                <input
                  type="text"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 p-2 border rounded-lg text-sm"
                />
              </div>

              <textarea
                placeholder="상세 숙제 내용 및 교재 페이지를 적어주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm h-24"
              />

              <div className="flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-700">
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
            filteredPosts.map((post) => (
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
                  <span>작성일: {new Date(post.created_at).toLocaleDateString()}</span>
                </div>

                <h3 className="font-bold text-base text-gray-800">{post.title}</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                {/* 선생님용 학생 숙제 검사란 */}
                {user?.role === 'TEACHER' && post.category === 'HOMEWORK' && (
                  <div className="mt-4 pt-3 border-t border-gray-100 bg-slate-50 p-3 rounded-lg space-y-2">
                    <p className="text-xs font-bold text-slate-700">✅ 날짜별 학생 숙제 검사 현황</p>
                    <div className="flex flex-wrap gap-2">
                      {students.map((st) => {
                        const isDone = submissions[`${post.id}_${st.id}`];
                        return (
                          <button
                            key={st.id}
                            onClick={() => toggleHomeworkStatus(post.id, st.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                              isDone
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white border border-gray-300 text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <span>{st.name}</span>
                            <span>{isDone ? '✓ 완료' : '미제출'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
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