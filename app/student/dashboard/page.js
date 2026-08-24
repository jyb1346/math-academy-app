'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (e) {
      router.push('/login');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              품수학 학원 학생 공간
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">
              <span className="text-blue-600 font-bold">{user?.name} 학생</span> 환영합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 🔒 학생 전용 비밀번호 변경 버튼 */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition border border-slate-200"
          >
            🔒 비밀번호 변경
          </button>

          <button
            onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-2 rounded-xl transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        
        {/* 안내 카드 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800">👋 안녕하세요, {user?.name} 학생!</h2>
            <p className="text-xs text-slate-400 mt-1">최초 비밀번호가 1234라면 안전한 나만의 비밀번호로 변경하세요.</p>
          </div>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs transition shadow-sm"
          >
            🔒 비밀번호 변경하기
          </button>
        </div>

        {/* 게시판 바로가기 */}
        <div
          onClick={() => router.push('/board')}
          className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-7 rounded-3xl shadow-xl cursor-pointer hover:scale-[1.01] transition"
        >
          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs px-3.5 py-1 rounded-full font-bold">
            📢 Notice Board
          </span>
          <h3 className="text-xl font-extrabold mt-4">우리 반 공지 및 숙제 확인하기</h3>
          <p className="text-xs text-slate-300 mt-1">선생님이 올려주신 공지사항과 숙제를 확인해 보세요.</p>
        </div>

      </main>

      {/* 🔒 비밀번호 변경 모달 */}
      {showPasswordModal && user && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowPasswordModal(false)}
          onPasswordUpdated={(updatedUser) => setUser(updatedUser)}
        />
      )}

    </div>
  );
}