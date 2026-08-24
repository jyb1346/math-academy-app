'use client';

import { useState, useEffect } from 'react';
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
        
        {/* 학생 환영 인사 카드 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">👋 안녕하세요, {user?.name} 학생!</h2>
            <p className="text-xs text-slate-400 mt-1">오늘의 학습 피드백, 숙제, 수업 자료 및 복습 영상을 확인해 보세요.</p>
          </div>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2.5 rounded-2xl text-xs transition border border-indigo-200 whitespace-nowrap"
          >
            🔒 비밀번호 변경
          </button>
        </div>

        {/* 🎓 학생 전용 5대 메뉴 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 1. 피드백 날짜별 확인 게시판 */}
          <div
            onClick={() => router.push('/student/eval')}
            className="group relative bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-lg cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
          >
            <div className="flex justify-between items-start">
              <span className="bg-white/20 border border-white/20 text-white text-[11px] px-3 py-1 rounded-full font-bold">
                📊 Daily Report
              </span>
              <span className="text-2xl text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-extrabold">일일 학습 피드백 리포트</h3>
              <p className="text-xs text-blue-100 mt-1">선생님이 기록해 주신 날짜별 학습 성취도와 평가를 확인하세요.</p>
            </div>
          </div>

          {/* 2. 숙제 및 공지사항 확인게시판 */}
          <div
            onClick={() => router.push('/board')}
            className="group relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
          >
            <div className="flex justify-between items-start">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] px-3 py-1 rounded-full font-bold">
                📢 Notice & HW
              </span>
              <span className="text-2xl text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">→</span>
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-extrabold">숙제 및 반별 공지사항</h3>
              <p className="text-xs text-slate-300 mt-1">마감일별 숙제와 우리 반의 중요한 공지사항을 확인합니다.</p>
            </div>
          </div>

          {/* 3. 복습영상게시판 */}
          <div
            onClick={() => router.push('/board/video')}
            className="group relative bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs cursor-pointer hover:border-red-300 transition-all duration-300"
          >
            <div className="flex justify-between items-start">
              <span className="bg-red-50 text-red-600 border border-red-100 text-[11px] px-3 py-1 rounded-full font-bold">
                🎥 Video Lesson
              </span>
              <span className="text-xl text-slate-300 group-hover:text-red-500 transition-all">→</span>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-extrabold text-slate-800">복습 영상 게시판</h3>
              <p className="text-xs text-slate-400 mt-1">수업 시간 놓친 개념 및 문제풀이 영상 강의를 다시 시청합니다.</p>
            </div>
          </div>

          {/* 4. 수업자료게시판 */}
          <div
            onClick={() => router.push('/board/material')}
            className="group relative bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs cursor-pointer hover:border-emerald-300 transition-all duration-300"
          >
            <div className="flex justify-between items-start">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] px-3 py-1 rounded-full font-bold">
                📁 Class Materials
              </span>
              <span className="text-xl text-slate-300 group-hover:text-emerald-600 transition-all">→</span>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-extrabold text-slate-800">수업 자료 게시판</h3>
              <p className="text-xs text-slate-400 mt-1">수업 교재, 유인물 PDF 및 테스트 모의고사 자료를 다운로드합니다.</p>
            </div>
          </div>

          {/* 5. Q&A게시판 */}
          <div
            onClick={() => router.push('/board/qna')}
            className="group relative bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs cursor-pointer hover:border-amber-300 transition-all duration-300 col-span-1 md:col-span-2"
          >
            <div className="flex justify-between items-start">
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] px-3 py-1 rounded-full font-bold">
                ❓ Math Q&A
              </span>
              <span className="text-xl text-slate-300 group-hover:text-amber-600 transition-all">→</span>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-extrabold text-slate-800">수학 질의응답 (Q&A) 게시판</h3>
              <p className="text-xs text-slate-400 mt-1">모르는 문제 사진을 찍거나 질문을 남기면 담당 선생님이 친절하게 답변해 드립니다.</p>
            </div>
          </div>

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