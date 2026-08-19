'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STUDENT'); // 기본값: 학생
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 입력받은 정보로 DB에서 사용자 조회
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim())
        .eq('role', role);

      if (error) {
        alert(`DB 에러 발생: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        alert(`일치하는 회원 정보가 없습니다.\n입력 이메일: [${email.trim()}]\n선택 권한: [${role}]`);
        setLoading(false);
        return;
      }

      const userData = data[0];
      // 로그인 성공 시 로컬 스토리지에 사용자 정보 저장
      localStorage.setItem('user', JSON.stringify(userData));

      alert(`${userData.name}님 환영합니다!`);

      if (userData.role === 'TEACHER') {
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
          학원 관리 시스템 로그인
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`py-2 rounded-lg font-medium border transition ${
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
                className={`py-2 rounded-lg font-medium border transition ${
                  role === 'TEACHER'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                선생님 로그인
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 계정</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@test.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? '로그인 중...' : '로그인하기'}
          </button>
        </form>
      </div>
    </div>
  );
}