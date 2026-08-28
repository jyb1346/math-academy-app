'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import HexagonRadarChart from '@/components/HexagonRadarChart';

export default function StudentEvalPage() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
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

      if (error) throw error;
      setEvaluations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 학생 본인의 최근 2주 평균 점수 계산 함수
  const getTwoWeekAvgScores = (targetDateStr) => {
    const targetDate = new Date(targetDateStr);
    const twoWeeksAgo = new Date(targetDate);
    twoWeeksAgo.setDate(targetDate.getDate() - 14);

    const studentTwoWeekEvals = evaluations.filter((e) => {
      const evalDateObj = new Date(e.eval_date);
      return evalDateObj >= twoWeeksAgo && evalDateObj <= targetDate;
    });

    if (studentTwoWeekEvals.length === 0) return null;

    const total = studentTwoWeekEvals.reduce(
      (acc, curr) => ({
        concept: acc.concept + (curr.concept_score || 0),
        calc: acc.calc + (curr.calc_score || 0),
        app: acc.app + (curr.app_score || 0),
        attitude: acc.attitude + (curr.attitude_score || 0),
        homework: acc.homework + (curr.homework_score || 0),
        perseverance: acc.perseverance + (curr.perseverance_score || 0),
      }),
      { concept: 0, calc: 0, app: 0, attitude: 0, homework: 0, perseverance: 0 }
    );

    const count = studentTwoWeekEvals.length;
    return {
      concept: Number((total.concept / count).toFixed(1)),
      calc: Number((total.calc / count).toFixed(1)),
      app: Number((total.app / count).toFixed(1)),
      attitude: Number((total.attitude / count).toFixed(1)),
      homework: Number((total.homework / count).toFixed(1)),
      perseverance: Number((total.perseverance / count).toFixed(1)),
    };
  };

  const renderAttendanceBadge = (status, latenessMins) => {
    if (status === 'LATE') {
      const minsText = latenessMins >= 30 ? '30분 이상 지각' : `${latenessMins || 5}분 이내 지각`;
      return (
        <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">
          ⏰ {minsText}
        </span>
      );
    }
    if (status === 'ABSENT') {
      return (
        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1 rounded-full">
          🔴 결석
        </span>
      );
    }
    return (
      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
        🟢 정상 출석
      </span>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
      피드백 내역 로딩 중...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100/70 pb-32 font-sans text-slate-800">
      
      {/* 헤더 */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer shrink-0" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base sm:text-lg font-extrabold text-slate-800 cursor-pointer leading-tight">
              일일 학습 피드백 내역
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              일일 6대 역량 육각형 성취도 그래프 및 피드백
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200 whitespace-nowrap shrink-0"
        >
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {evaluations.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80">
            <p className="text-sm font-bold text-slate-400">등록된 일일 피드백이 없습니다.</p>
          </div>
        ) : (
          evaluations.map((ev) => {
            const twoWeekAvg = getTwoWeekAvgScores(ev.eval_date);

            return (
              <div key={ev.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 text-base">📅 {ev.eval_date} 학습 리포트</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderAttendanceBadge(ev.attendance_status, ev.lateness_minutes)}
                    <button
                      onClick={() => router.push(`/report/${ev.id}`)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3.5 py-1.5 rounded-full border border-indigo-200 transition"
                    >
                      📊 상세 웹 리포트 보기 ↗
                    </button>
                  </div>
                </div>

                {/* 🎯 육각형 그래프 및 영역별 상세 점수 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* 좌측: 육각형 레이더 차트 */}
                  <div className="md:col-span-5 flex justify-center">
                    <HexagonRadarChart
                      scores={{
                        concept: ev.concept_score,
                        calc: ev.calc_score,
                        app: ev.app_score,
                        attitude: ev.attitude_score,
                        homework: ev.homework_score,
                        perseverance: ev.perseverance_score,
                      }}
                      twoWeekAvgScores={twoWeekAvg}
                    />
                  </div>

                  {/* 우측: 6대 지표 수치 그리드 & 코멘트 */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 text-xs font-bold text-slate-700">
                      <div className="text-center">개념: <span className="text-blue-600 font-black">{ev.concept_score ?? '-'}점</span></div>
                      <div className="text-center">연산: <span className="text-blue-600 font-black">{ev.calc_score ?? '-'}점</span></div>
                      <div className="text-center">응용: <span className="text-blue-600 font-black">{ev.app_score ?? '-'}점</span></div>
                      <div className="text-center">집중: <span className="text-blue-600 font-black">{ev.attitude_score ?? '-'}점</span></div>
                      <div className="text-center">과제: <span className="text-blue-600 font-black">{ev.homework_score ?? '-'}점</span></div>
                      <div className="text-center">끈기: <span className="text-blue-600 font-black">{ev.perseverance_score ?? '-'}점</span></div>
                    </div>

                    {ev.teacher_comment && (
                      <div className="text-xs text-slate-700 leading-relaxed bg-blue-50/50 p-4 rounded-2xl border border-blue-100/80 space-y-1">
                        <span className="font-bold text-blue-900 block">✍️ 선생님 코멘트:</span>
                        <p className="whitespace-pre-wrap">{ev.teacher_comment}</p>
                      </div>
                    )}

                    {ev.parent_reply && (
                      <div className="text-xs text-emerald-800 leading-relaxed bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-1">
                        <span className="font-bold text-emerald-950 block">✉️ 학부모 답장:</span>
                        <p className="whitespace-pre-wrap">{ev.parent_reply}</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
