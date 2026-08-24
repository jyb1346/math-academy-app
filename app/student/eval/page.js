'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
        .from('evaluations')
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

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
      피드백 내역 로딩 중...
    </div>
  );

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
              일일 학습 피드백 내역
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              선생님이 기록해 주신 날짜별 학습 리포트입니다.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200"
        >
          ← 이전 화면으로
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-4">
        {evaluations.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80">
            <p className="text-sm font-bold text-slate-400">등록된 일일 피드백이 없습니다.</p>
          </div>
        ) : (
          evaluations.map((ev) => (
            <div key={ev.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="font-extrabold text-slate-800 text-sm">📅 {ev.eval_date} 피드백 리포트</span>
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                  출결: {ev.attendance || '출석'}
                </span>
              </div>

              {/* 6대 영역 점수 요약 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 text-xs font-bold text-slate-700">
                <div>개념 이해: <span className="text-blue-600 font-black">{ev.score_concept || '-'}점</span></div>
                <div>연산 속도: <span className="text-blue-600 font-black">{ev.score_calc || '-'}점</span></div>
                <div>응용 문제: <span className="text-blue-600 font-black">{ev.score_app || '-'}점</span></div>
                <div>숙제 수행: <span className="text-blue-600 font-black">{ev.score_hw || '-'}점</span></div>
                <div>수업 태도: <span className="text-blue-600 font-black">{ev.score_attitude || '-'}점</span></div>
                <div>오답 정리: <span className="text-blue-600 font-black">{ev.score_review || '-'}점</span></div>
              </div>

              {ev.comment && (
                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-900 block mb-1">💬 선생님 코멘트:</span>
                  {ev.comment}
                </div>
              )}
            </div>
          ))
        )}
      </main>

    </div>
  );
}