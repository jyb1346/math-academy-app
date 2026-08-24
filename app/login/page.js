'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // HEAD_TEACHER와 TEACHER는 선생님 로그인 구성을 함께 사용할 수 있도록 처리
      let query = supabase
        .from('users')
        .select('*')
        .eq('email', email.trim())
        .eq('password', password.trim());

      if (role === 'STUDENT') {
        query = query.eq('role', 'STUDENT');
      } else {
        query = query.in('role', ['TEACHER', 'HEAD_TEACHER']);
      }

      const { data, error } = await query;

      if (error) {
        alert(`DB 에러: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        alert('일치하는 계정이 없거나 비밀번호가 틀렸습니다.');
        setLoading(false);
        return;
      }

      const userData = data[0];
      localStorage.setItem('user', JSON.stringify(userData));

      alert(`${userData.name}님 환영합니다!`);

      if (userData.role === 'HEAD_TEACHER' || userData.role === 'TEACHER') {
        router.push('/teacher/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    } catch (err) {
      console.error(err);
      alert('로그인 처리 중 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          품수학 학원 로그인
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`py-2.5 rounded-xl font-bold border transition text-sm ${
                  role === 'STUDENT'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                학생 로그인
              </button>
              <button
                type="button"
                onClick={() => setRole('TEACHER')}
                className={`py-2.5 rounded-xl font-bold border transition text-sm ${
                  role === 'TEACHER'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                선생님 / 원장님 로그인
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 계정 (아이디)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@test.com"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-400 text-sm shadow"
          >
            {loading ? '로그인 중...' : '로그인하기'}
          </button>
        </form>
      </div>
    </div>
  );
}