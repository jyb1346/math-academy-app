'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PushNotificationManager from '@/components/PushNotificationManager';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import StudentHomeworkTable from '@/components/StudentHomeworkTable';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loadingEvals, setLoadingEvals] = useState(true);
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
      fetchStudentEvaluations(parsedUser.id);
    } catch (e) {
      router.push('/login');
    }
  }, []);

  const fetchStudentEvaluations = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from('daily_evaluations')
        .select('*')
        .eq('student_id', studentId)
        .order('eval_date', { ascending: false });

      if (!error && data) {
        setEvaluations(data);
      }
    } catch (err) {
      console.error('fetchStudentEvaluations error:', err);
    } finally {
      setLoadingEvals(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-32 font-sans text-slate-800">
      
      {/* 📘 학생 헤더 (모바일 2단 분리형 - 글씨 꺾임 완전 해결) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3 sm:py-4 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          
          {/* 1층: 학원 로고 + 타이틀 (좌측) / 모바일 로그아웃 (우측) */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
                onClick={() => router.push('/')}
              >
                품
              </div>
              <div>
                <h1 onClick={() => router.push('/')} className="text-base sm:text-lg font-extrabold text-slate-800 cursor-pointer leading-tight">
                  품수학 학원 학생 공간
                </h1>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  <span className="text-blue-600 font-bold">{user?.name} 학생</span> 환영합니다.
                </p>
              </div>
            </div>

            {/* 모바일 전용 상단 우측 로그아웃 */}
            <button
              onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-xl transition sm:hidden"
            >
              로그아웃
            </button>
          </div>

          {/* 2층: 액션 버튼 그룹 (비밀번호 변경 및 데스크톱 로그아웃) */}
          <div className="flex items-center gap-2 justify-end pt-1 sm:pt-0">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200 whitespace-nowrap"
            >
              🔒 비밀번호 변경
            </button>

            {/* 데스크톱 전용 로그아웃 */}
            <button
              onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap hidden sm:inline-block"
            >
              로그아웃
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        <PushNotificationManager user={user} />

        {/* 📑 1. 최상단: 내 최근 진도 & 교재별 과제표 위젯 */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          {loadingEvals ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">과제표 불러오는 중...</div>
          ) : (
            <StudentHomeworkTable
              studentName={user?.name || '내'}
              evaluations={evaluations}
              isEditable={false}
            />
          )}
        </div>

        {/* 🎓 2. 학생 전용 2대 핵심 바로가기 메뉴 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* 1. 숙제 및 반별 공지사항 (복습영상, 수업자료 통합 게시판) */}
          <div
            onClick={() => router.push('/board?category=NOTICE_HOMEWORK')}
            className="group relative bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 rounded-3xl shadow-md cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-lg border border-indigo-800/40"
          >
            <div className="flex justify-between items-start">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] px-3 py-1 rounded-full font-black">
                📢 Notice & Materials
              </span>
              <span className="text-2xl text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">→</span>
            </div>
            <div className="mt-5">
              <h3 className="text-xl font-extrabold text-white">숙제 및 반별 공지사항</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                마감일별 숙제 공지, 수업 복습영상 및 교재 자료를 확인합니다.
              </p>
            </div>
          </div>

          {/* 2. 1:1 수학 질의응답 (Q&A) */}
          <div
            onClick={() => router.push('/qna')}
            className="group relative bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white p-6 rounded-3xl shadow-md cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-lg border border-blue-500/30"
          >
            <div className="flex justify-between items-start">
              <span className="bg-white/20 text-white border border-white/20 text-[11px] px-3 py-1 rounded-full font-black">
                ❓ Math Q&A
              </span>
              <span className="text-2xl text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
            </div>
            <div className="mt-5">
              <h3 className="text-xl font-extrabold text-white">1:1 수학 질의응답 (Q&A)</h3>
              <p className="text-xs text-blue-100 mt-1 leading-relaxed">
                모르는 문제 사진을 찍어 올리면 담당 선생님이 1:1로 풀이 답변을 남겨 드립니다.
              </p>
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