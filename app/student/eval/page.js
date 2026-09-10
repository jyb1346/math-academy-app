'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import EvaluationBarChart from '@/components/EvaluationBarChart';
import { parseEvaluationRecord } from '@/lib/evalUtils';

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
              일일 학습 영역별 성취도 막대 그래프 및 피드백
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
            const parsed = parseEvaluationRecord(ev);

            return (
              <div key={ev.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-800 text-base">📅 {ev.eval_date} 학습 리포트</span>
                    {parsed.testScore && (
                      <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                        📝 {parsed.testType}: {parsed.testScore.endsWith('점') || parsed.testScore.includes('/') || parsed.testScore.includes('등급') ? parsed.testScore : `${parsed.testScore}점`}
                      </span>
                    )}
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

                {/* 🎯 가로 막대 성취도 차트 */}
                <EvaluationBarChart items={parsed.items} />

                {/* 코멘트 & 답장 */}
                <div className="space-y-3">
                  {parsed.comment && (
                    <div className="text-xs text-slate-700 leading-relaxed bg-blue-50/50 p-4 rounded-2xl border border-blue-100/80 space-y-1">
                      <span className="font-bold text-blue-900 block">✍️ 선생님 코멘트:</span>
                      <p className="whitespace-pre-wrap">{parsed.comment}</p>
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
            );
          })
        )}
      </main>
    </div>
  );
}
