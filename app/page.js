'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  // 페이지 접속 시 자동 로그인 체크
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.role === 'TEACHER') {
          router.push('/teacher/dashboard');
        } else if (user.role === 'STUDENT') {
          router.push('/student/dashboard');
        }
      } catch (err) {
        console.error('자동 로그인 처리 실패:', err);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 py-4 px-4 shadow-sm text-center">
        <div className="max-w-5xl mx-auto">
          <h1 
            onClick={() => router.push('/')}
            className="text-xl sm:text-2xl font-bold text-blue-600 cursor-pointer inline-block"
          >
            품수학 학원 관리 시스템
          </h1>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section className="bg-blue-600 text-white py-12 sm:py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold leading-snug">
            체계적인 수학 학습 관리의 시작
          </h2>
          <p className="text-sm sm:text-base opacity-90 leading-relaxed">
            개별 맞춤 숙제 관리, 출결 알림, 일일 성취도 피드백까지 스마트하게 관리하세요.
          </p>
          <div className="pt-3">
            <button
              onClick={() => router.push('/login')}
              className="bg-white text-blue-600 font-bold px-8 py-3.5 rounded-xl shadow-lg hover:bg-gray-100 transition text-base active:scale-95"
            >
              로그인 / 강의실 접속하기
            </button>
          </div>
        </div>
      </section>

      {/* 학원 핵심 시스템 소개 */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6 flex-1 w-full">
        <h3 className="text-lg font-bold text-gray-800 text-center">학원 핵심 시스템</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 text-center space-y-2 shadow-sm">
            <span className="text-3xl">📱</span>
            <h4 className="font-bold text-gray-800">실시간 출결 관리</h4>
            <p className="text-xs text-gray-500">수업 시작 시 등원 체크 및 부모님 알림 지원</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 text-center space-y-2 shadow-sm">
            <span className="text-3xl">📊</span>
            <h4 className="font-bold text-gray-800">일일 성취도 피드백</h4>
            <p className="text-xs text-gray-500">6가지 영역 레이더 차트 및 카카오 알림톡 전송</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 text-center space-y-2 shadow-sm">
            <span className="text-3xl">❓</span>
            <h4 className="font-bold text-gray-800">1:1 Q&A 질문</h4>
            <p className="text-xs text-gray-500">문제 사진 촬영 업로드 및 선생님의 친절한 해설</p>
          </div>
        </div>
      </main>
    </div>
  );
}