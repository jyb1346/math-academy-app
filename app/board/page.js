'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function BoardPage() {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState('NOTICE');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const { error } = await supabase.from('posts').insert([
        {
          title,
          content,
          category: newCategory,
          author_id: user.id,
        },
      ]);

      if (error) throw error;

      setTitle('');
      setContent('');
      fetchPosts();
      alert('게시글이 등록되었습니다!');
    } catch (err) {
      console.error(err);
      alert('글 작성에 실패했습니다.');
    }
  };

  const filteredPosts =
    category === 'ALL' ? posts : posts.filter((p) => p.category === category);

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1
          onClick={() => router.push('/')}
          className="text-xl font-bold text-blue-600 cursor-pointer"
        >
          품수학 학원 게시판
        </h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:underline"
        >
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {/* 선생님 전용 글쓰기 폼 */}
        {user?.role === 'TEACHER' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800">새 게시글 작성</h2>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="p-2 border rounded-lg text-sm"
                >
                  <option value="NOTICE">📢 공지사항</option>
                  <option value="HOMEWORK">📝 숙제 알림</option>
                  <option value="VIDEO">🎬 복습 영상</option>
                  <option value="MATERIAL">📄 강의 자료</option>
                </select>
                <input
                  type="text"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 p-2 border rounded-lg text-sm"
                />
              </div>
              <textarea
                placeholder="내용을 입력하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm h-24"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700"
                >
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
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
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
        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              등록된 게시글이 없습니다.
            </p>
          ) : (
            filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2"
              >
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="font-bold text-blue-600">
                    {post.category === 'NOTICE' && '📢 공지사항'}
                    {post.category === 'HOMEWORK' && '📝 숙제 알림'}
                    {post.category === 'VIDEO' && '🎬 복습 영상'}
                    {post.category === 'MATERIAL' && '📄 강의 자료'}
                  </span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-base text-gray-800">{post.title}</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {post.content}
                </p>
                <div className="text-xs text-gray-400 text-right">
                  작성자: {post.users?.name || '선생님'}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}