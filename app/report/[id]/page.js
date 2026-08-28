'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import HexagonRadarChart from '@/components/HexagonRadarChart';

export default function StudentReportPage() {
  const { id } = useParams();
  const [evalData, setEvalData] = useState(null);
  const [twoWeekAvg, setTwoWeekAvg] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 학부모 답장 상태
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (id) fetchEvaluation();
  }, [id]);

  const fetchEvaluation = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setEvalData(data);
      if (data?.parent_reply) {
        setReplyText(data.parent_reply);
      }

      // 🎯 학생의 최근 2주 평균 데이터 조회 및 계산
      if (data?.student_id && data?.eval_date) {
        const { data: allEvals } = await supabase
          .from('daily_evaluations')
          .select('*')
          .eq('student_id', data.student_id)
          .order('eval_date', { ascending: false });

        if (allEvals && allEvals.length > 0) {
          const targetDate = new Date(data.eval_date);
          const twoWeeksAgo = new Date(targetDate);
          twoWeeksAgo.setDate(targetDate.getDate() - 14);

          const studentTwoWeekEvals = allEvals.filter((e) => {
            const evalDateObj = new Date(e.eval_date);
            return evalDateObj >= twoWeeksAgo && evalDateObj <= targetDate;
          });

          if (studentTwoWeekEvals.length > 0) {
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
            setTwoWeekAvg({
              concept: Number((total.concept / count).toFixed(1)),
              calc: Number((total.calc / count).toFixed(1)),
              app: Number((total.app / count).toFixed(1)),
              attitude: Number((total.attitude / count).toFixed(1)),
              homework: Number((total.homework / count).toFixed(1)),
              perseverance: Number((total.perseverance / count).toFixed(1)),
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 학부모 답장 제출 함수
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return alert('답장 내용을 입력해 주세요.');

    setSubmittingReply(true);

    try {
      const { error } = await supabase
        .from('daily_evaluations')
        .update({
          parent_reply: replyText,
          parent_reply_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('담당 선생님께 답장이 성공적으로 전달되었습니다!');
      fetchEvaluation();
    } catch (err) {
      console.error(err);
      alert('답장 전송에 실패했습니다.');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-bold">리포트를 불러오는 중입니다...</div>;
  }

  if (!evalData) {
    return <div className="p-10 text-center text-gray-500 font-bold">등록된 피드백 정보를 찾을 수 없습니다.</div>;
  }

  const renderAttendanceText = () => {
    if (evalData.attendance_status === 'LATE') {
      const mins = evalData.lateness_minutes >= 30 ? '30분 이상 지각' : (evalData.lateness_minutes || 5) + '분 지각';
      return '⏰ ' + mins;
    }
    if (evalData.attendance_status === 'ABSENT') {
      return '🔴 결석';
    }
    return '🟢 정상 출석';
  };

  return (
    <div className="min-h-screen bg-slate-100/80 py-6 px-4 flex flex-col items-center justify-center font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden space-y-4">
        
        {/* 상단 리포트 헤더 */}
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-700 text-white p-6 text-center space-y-2 shadow-md shadow-blue-500/10">
          <span className="bg-white/20 text-white text-xs px-3.5 py-1 rounded-full font-bold">
            품수학 일일 학습 보고서
          </span>
          <h2 className="text-2xl font-black pt-1">
            {(evalData.users?.name || '학생') + ' 피드백'}
          </h2>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-xs text-blue-100 font-semibold">
              {'📅 수업 일자: ' + evalData.eval_date}
            </span>
            <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {renderAttendanceText()}
            </span>
          </div>
        </div>

        {/* 🎯 육각형 그래프 영역 (당일 성취도 + 최근 2주 평균 동시 표기) */}
        <div className="px-5 py-2 flex flex-col items-center space-y-3">
          <h3 className="text-sm font-black text-slate-800 text-center flex items-center gap-1.5">
            <span>📊</span>
            <span>6대 핵심 역량별 학습 분석</span>
          </h3>

          <div className="w-full flex justify-center">
            <HexagonRadarChart
              scores={{
                concept: evalData.concept_score,
                calc: evalData.calc_score,
                app: evalData.app_score,
                attitude: evalData.attitude_score,
                homework: evalData.homework_score,
                perseverance: evalData.perseverance_score,
              }}
              twoWeekAvgScores={twoWeekAvg}
            />
          </div>

          {/* 6대 역량 수치 그리드 */}
          <div className="w-full grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-700">
            <div className="text-center">개념: <span className="text-blue-600 font-black">{(evalData.concept_score ?? '-') + '점'}</span></div>
            <div className="text-center">연산: <span className="text-blue-600 font-black">{(evalData.calc_score ?? '-') + '점'}</span></div>
            <div className="text-center">응용: <span className="text-blue-600 font-black">{(evalData.app_score ?? '-') + '점'}</span></div>
            <div className="text-center">집중: <span className="text-blue-600 font-black">{(evalData.attitude_score ?? '-') + '점'}</span></div>
            <div className="text-center">과제: <span className="text-blue-600 font-black">{(evalData.homework_score ?? '-') + '점'}</span></div>
            <div className="text-center">끈기: <span className="text-blue-600 font-black">{(evalData.perseverance_score ?? '-') + '점'}</span></div>
          </div>
        </div>

        {/* 선생님 피드백 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-2">
          <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <span>✍️</span> 선생님 피드백 코멘트
          </h4>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            {evalData.teacher_comment || '오늘도 집중력 있게 성실히 학습에 임했습니다!'}
          </p>
        </div>

        {/* 학부모 답장 작성 섹션 */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <span>💬</span> 담당 선생님께 답장 남기기
          </h4>
          <form onSubmit={handleReplySubmit} className="space-y-2.5">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="선생님께 전달할 감사 인사나 문의사항을 입력해 주세요."
              rows={3}
              className="w-full p-3.5 border border-slate-200/80 rounded-2xl text-xs font-semibold bg-slate-50 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={submittingReply}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl text-xs transition shadow-md shadow-indigo-600/10 disabled:bg-slate-300"
            >
              {submittingReply ? '전송 중...' : '✉️ 답장 전송하기'}
            </button>
          </form>
        </div>

        {/* 하단 이동 버튼 */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 underline"
          >
            품수학 홈으로 이동
          </button>
        </div>

      </div>
    </div>
  );
}
