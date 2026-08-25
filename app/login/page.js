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
    if (!email.trim() || !password.trim()) {
      return alert('아이디와 비밀번호를 모두 입력해 주세요.');
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim())
        .eq('password', password.trim())
        .single();

      if (error || !data) {
        alert('아이디 또는 비밀번호가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      // 로그인 상태 저장
      localStorage.setItem('user', JSON.stringify(data));

      // 🎯 역할별 시작 페이지 리다이렉트 설정
      if (data.role === 'HEAD_TEACHER' || data.role === 'TEACHER') {
        // 원장님(HEAD_TEACHER)과 일반 강사 모두 [내 수업 대시보드]로 우선 이동
        router.push('/teacher/dashboard');
      } else if (data.role === 'STUDENT') {
        router.push('/student/dashboard');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error(err);
      alert('로그인 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/80 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200/80 space-y-6">
        
        {/* 로고 & 타이틀 */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-blue-500/30">
            품
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight pt-2">품수학 학원 로그인</h1>
          <p className="text-xs text-slate-400 font-semibold">선생님 및 학생 로그인 공간입니다.</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">아이디 / 이메일</label>
            <input
              type="text"
              placeholder="아이디를 입력해 주세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호를 입력해 주세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md transition pt-3"
          >
            {loading ? '로그인 중...' : '로그인 하기'}
          </button>
        </form>

      </div>
    </div>
  );
}