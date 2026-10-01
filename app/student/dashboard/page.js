'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PushNotificationManager from '@/components/PushNotificationManager';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import StudentHomeworkTable from '@/components/StudentHomeworkTable';
import StudentClinicModal from '@/components/StudentClinicModal';
import { logout } from '@/lib/useSession';
import { getClientCache, setClientCache } from '@/lib/clientCache';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [qnaStats, setQnaStats] = useState({ pending: 0, answered: 0, resolved: 0, total: 0 });
  const [clinicInfo, setClinicInfo] = useState({ hasActive: false, activeDate: '', myBooking: null, bookingTimeLabel: '', activeScheduleId: null });
  const [loadingEvals, setLoadingEvals] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const router = useRouter();

  const applyCachedStudentData = (cached) => {
    if (cached.evaluations) setEvaluations(cached.evaluations);
    if (cached.clinicInfo) setClinicInfo(cached.clinicInfo);
    if (cached.qnaStats) setQnaStats(cached.qnaStats);
  };

  const fetchStudentData = async (studentId, showLoading = false) => {
    if (showLoading) setLoadingEvals(true);
    try {
      // ⚡ 과제표, 클리닉, QnA를 3개 동시 병렬 요청 (직렬 대기 완전 제거)
      const evalPromise = fetch(`/api/eval?studentId=${encodeURIComponent(studentId)}`)
        .then(async (res) => {
          if (!res.ok) return [];
          const json = await res.json();
          const list = json.evaluations || [];
          setEvaluations(list);
          setLoadingEvals(false); // ⚡ 과제표 데이터 도착 즉시 0.1초 만에 로딩 해제!
          return list;
        })
        .catch(() => []);

      // ⏰ 클리닉 일정 및 내 예약 상태 조회
      const clinicPromise = fetch('/api/clinic/schedules')
        .then(async (res) => {
          if (!res.ok) return { hasActive: false, activeDate: '', myBooking: null, bookingTimeLabel: '', activeScheduleId: null };
          const data = await res.json();
          const activeSchedules = (data.schedules || []).filter((s) => s.is_active);
          let cInfo = { hasActive: false, activeDate: '', myBooking: null, bookingTimeLabel: '', activeScheduleId: null };
          if (activeSchedules.length > 0) {
            // 학생이 이미 예약한 일정이 있다면 그 일정을 우선 표시!
            const bookedSched = activeSchedules.find(
              (s) => (s.myBookings && s.myBookings.length > 0) || s.myBooking
            );
            const target = bookedSched || activeSchedules[0];
            const myBookings = target.myBookings || (target.myBooking ? [target.myBooking] : []);
            let bookingLabel = '';
            if (myBookings.length > 0) {
              bookingLabel = myBookings.map((b) => `${b.start_time}~${b.end_time}`).join(', ');
            }

            cInfo = {
              hasActive: true,
              activeDate: target.date,
              myBooking: myBookings[0] || null,
              bookingTimeLabel: bookingLabel,
              activeScheduleId: target.id,
            };
          }
          setClinicInfo(cInfo);
          return cInfo;
        })
        .catch(() => ({ hasActive: false, activeDate: '', myBooking: null, bookingTimeLabel: '', activeScheduleId: null }));

      // 1:1 Q&A 질문 상태 조회
      const qnaPromise = fetch('/api/qna')
        .then(async (res) => {
          if (!res.ok) return { pending: 0, answered: 0, resolved: 0, total: 0 };
          const qJson = await res.json();
          const qData = qJson.questions || [];
          const parsedQna = (qData || []).map((q) => {
            let replies = [];
            if (Array.isArray(q.replies)) replies = q.replies;
            else if (typeof q.replies === 'string') {
              try {
                replies = JSON.parse(q.replies) || [];
              } catch {
                replies = [];
              }
            }
            const lastReply = replies.length > 0 ? replies[replies.length - 1] : null;
            let computedStatus = q.status;
            if (q.status === 'ANSWERED' && lastReply?.type === 'RESOLVED') {
              computedStatus = 'RESOLVED';
            }
            return { ...q, computedStatus };
          });
          const pending = parsedQna.filter((q) => q.computedStatus === 'PENDING').length;
          const answered = parsedQna.filter((q) => q.computedStatus === 'ANSWERED').length;
          const resolved = parsedQna.filter((q) => q.computedStatus === 'RESOLVED').length;
          const qStats = { pending, answered, resolved, total: parsedQna.length };
          setQnaStats(qStats);
          return qStats;
        })
        .catch(() => ({ pending: 0, answered: 0, resolved: 0, total: 0 }));

      const [evList, cInfo, qStats] = await Promise.all([evalPromise, clinicPromise, qnaPromise]);

      // 캐시 저장 (새로고침/재방문 시 0.0초 즉시 복원)
      setClientCache(`student_dashboard_${studentId}`, {
        evaluations: evList,
        clinicInfo: cInfo,
        qnaStats: qStats,
      });
    } catch (err) {
      console.error('fetchStudentData error:', err);
    } finally {
      setLoadingEvals(false);
    }
  };

  useEffect(() => {
    // ⚡ 전방위 사전 로드(Universal Prefetch)로 화면 이동 딜레이 0초 달성
    try {
      router.prefetch('/board?category=NOTICE_HOMEWORK');
      router.prefetch('/board');
      router.prefetch('/qna');
      router.prefetch('/student/eval');
    } catch (e) {}

    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // ⚡ 1. 캐시가 있으면 0초 만에 대시보드 즉시 복원
      const cached = getClientCache(`student_dashboard_${parsedUser.id}`);
      if (cached) {
        applyCachedStudentData(cached);
        setLoadingEvals(false);
        fetchStudentData(parsedUser.id, false);
      } else {
        fetchStudentData(parsedUser.id, true);
      }
    } catch (e) {
      router.push('/login');
    }
  }, []);

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
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                  <span>품수학 학생 대시보드</span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                    Student
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                  <span className="text-blue-600 font-bold">{user?.name} 학생</span> 환영합니다.
                </p>
              </div>
            </div>

            {/* 모바일 전용 상단 우측 로그아웃 */}
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-xl transition sm:hidden cursor-pointer"
            >
              로그아웃
            </button>
          </div>

          {/* 2층: 액션 버튼 그룹 (비밀번호 변경 및 데스크톱 로그아웃) */}
          <div className="flex items-center gap-2 justify-end pt-1 sm:pt-0">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200 whitespace-nowrap cursor-pointer"
            >
              🔒 비밀번호 변경
            </button>

            {/* 데스크톱 전용 로그아웃 */}
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap hidden sm:inline-block cursor-pointer"
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

        {/* ⏰ 주말 클리닉 시간 선택 배너 */}
        {clinicInfo.hasActive && (
          <div
            onClick={() => setShowClinicModal(true)}
            className="group relative bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-900 text-white p-6 rounded-3xl shadow-md cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-lg border border-purple-500/30"
          >
            <div className="flex justify-between items-start">
              {clinicInfo.myBooking ? (
                <span className="bg-emerald-400 text-slate-950 text-[11px] px-3.5 py-1 rounded-full font-black flex items-center gap-1.5 shadow-md">
                  <span>⭐ {clinicInfo.activeDate} ({clinicInfo.bookingTimeLabel || `${clinicInfo.myBooking.start_time}~${clinicInfo.myBooking.end_time}`}) 예약 확정</span>
                </span>
              ) : (
                <span className="bg-amber-300 text-slate-950 text-[11px] px-3.5 py-1 rounded-full font-black flex items-center gap-1.5 shadow-xs animate-pulse">
                  <span>⏰ 클리닉 시간 선택 오픈!</span>
                </span>
              )}
              <span className="text-2xl text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-extrabold text-white">
                {clinicInfo.myBooking ? '클리닉 예약 확인 및 시간 변경' : '클리닉 시간 선택하기'}
              </h3>
              <p className="text-xs text-purple-100 mt-1 leading-relaxed">
                {clinicInfo.myBooking
                  ? `신청 완료: ${clinicInfo.activeDate} ${clinicInfo.bookingTimeLabel || `${clinicInfo.myBooking.start_time} ~ ${clinicInfo.myBooking.end_time}`} (터치하여 시간 변경 또는 취소)`
                  : `${clinicInfo.activeDate} 원하는 시작 시간을 골라 개별 클리닉을 예약하세요.`}
              </p>
            </div>
          </div>
        )}

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
              {qnaStats.answered > 0 && qnaStats.pending > 0 ? (
                <span className="bg-amber-400 text-slate-950 text-[11px] px-3 py-1 rounded-full font-black flex items-center gap-1 shadow-md animate-pulse">
                  <span>💬 확인 중 {qnaStats.answered}건 · 🚨 대기 {qnaStats.pending}건</span>
                </span>
              ) : qnaStats.answered > 0 ? (
                <span className="bg-emerald-400 text-slate-950 text-[11px] px-3 py-1 rounded-full font-black flex items-center gap-1 shadow-md animate-pulse">
                  <span>💬 풀이 답변 도착 ({qnaStats.answered}건)</span>
                </span>
              ) : qnaStats.pending > 0 ? (
                <span className="bg-amber-300 text-slate-950 text-[11px] px-3 py-1 rounded-full font-black flex items-center gap-1 shadow-xs">
                  <span>🚨 답변 대기 중 {qnaStats.pending}건</span>
                </span>
              ) : (
                <span className="bg-white/20 text-white border border-white/20 text-[11px] px-3 py-1 rounded-full font-black">
                  ❓ Math Q&A
                </span>
              )}
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

      {/* ⏰ 주말 클리닉 예약 모달 */}
      {showClinicModal && user && (
        <StudentClinicModal
          user={user}
          initialScheduleId={clinicInfo.activeScheduleId}
          onClose={() => setShowClinicModal(false)}
          onBookingUpdated={() => fetchStudentData(user.id)}
        />
      )}

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