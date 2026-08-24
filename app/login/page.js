'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('아이디(이메일)와 비밀번호를 입력해주세요.');

    setLoading(true);
    try {
      // 1. Supabase users 테이블에서 사용자 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim())
        .eq('password', password.trim())
        .single();

      if (error || !user) {
        alert('아이디 또는 비밀번호가 일치하지 않습니다.');
        setLoading(false);
        return;
      }

      // 2. localStorage에 유저 정보 저장
      localStorage.setItem('user', JSON.stringify(user));

      // 3. 역할(role)별 자동 분기 라우팅
      if (user.role === 'HEAD_TEACHER') {
        router.push('/admin/dashboard');
      } else if (user.role === 'TEACHER') {
        router.push('/teacher/dashboard');
      } else if (user.role === 'STUDENT') {
        router.push('/student/dashboard');
      } else {
        router.push('/');
      }
    } catch (err) {
      alert(`로그인 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl mx-auto shadow-md shadow-blue-500/20">
            품
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">품수학 학원 로그인</h1>
          <p className="text-xs text-slate-400 font-medium">원장님, 선생님, 학생 계정으로 로그인하세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">아이디 / 이메일</label>
            <input
              type="text"
              placeholder="예: teacher@test.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md transition disabled:bg-slate-300"
          >
            {loading ? '로그인 처리 중...' : '로그인하기'}
          </button>
        </form>
      </div>
    </div>
  );
}