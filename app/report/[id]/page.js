'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import EvaluationBarChart from '@/components/EvaluationBarChart';
import { parseEvaluationRecord } from '@/lib/evalUtils';

export default function StudentReportPage() {
  const { id } = useParams();
  const [evalData, setEvalData] = useState(null);
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

  const parsed = parseEvaluationRecord(evalData);

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

        {/* 🎯 학습 성취도 분석 영역 (가로 막대 게이지 바 차트) */}
        <div className="px-5 py-2">
          <EvaluationBarChart items={parsed.items} />
        </div>

        {/* 📝 시험 성적 결과 카드 (입력된 경우에만 렌더링, 미입력 시 숨김) */}
        {parsed.testScore && (
          <div className="mx-5 my-1 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-4 text-white shadow-lg shadow-indigo-600/15 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg shadow-inner">
                  {parsed.testType === '단원평가' ? '📘' : parsed.testType === '일일테스트' ? '⚡' : parsed.testType === '모의고사' ? '🎯' : parsed.testType === '주간테스트' ? '📝' : '✍️'}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-200 block uppercase tracking-wide">
                    {parsed.testType === '단원평가'
                      ? 'Unit Test'
                      : parsed.testType === '일일테스트'
                      ? 'Daily Test'
                      : parsed.testType === '모의고사'
                      ? 'Mock Exam'
                      : parsed.testType === '주간테스트'
                      ? 'Weekly Test'
                      : 'Evaluation Result'}
                  </span>
                  <h4 className="text-sm font-black text-white">{parsed.testType} 결과</h4>
                </div>
              </div>
              <div className="bg-white text-indigo-950 px-3.5 py-1.5 rounded-xl shadow-md text-right border border-indigo-100 flex items-baseline gap-1">
                <span className="text-[11px] font-bold text-slate-500">점수:</span>
                <span className="text-base sm:text-lg font-black text-indigo-600">
                  {parsed.testScore.endsWith('점') || parsed.testScore.includes('/') || parsed.testScore.includes('등급') ? parsed.testScore : `${parsed.testScore}점`}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-indigo-100/90 font-medium pt-0.5">
              {parsed.testType === '단원평가'
                ? '💡 해당 단원의 핵심 개념 이해도 및 심화 문제 해결력을 점검한 단원평가 결과입니다.'
                : parsed.testType === '일일테스트'
                ? '💡 오늘 수업 내용의 당일 이해도와 기본 계산 정확도를 점검한 일일 테스트 결과입니다.'
                : parsed.testType === '모의고사'
                ? '💡 실전 시험 대비 모의고사 성취도 및 성적 평가 결과입니다.'
                : parsed.testType === '주간테스트'
                ? '💡 이번 주 학습 단원 이해도 점검 및 주간 성취도 평가 점수입니다.'
                : `💡 ${parsed.testType} 성취도 평가 결과입니다.`}
            </p>
          </div>
        )}

        {/* 선생님 피드백 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-2">
          <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <span>✍️</span> 선생님 피드백 코멘트
          </h4>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            {parsed.comment || '오늘도 집중력 있게 성실히 학습에 임했습니다!'}
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
              className="w-full p-3.5 border border-slate-300 rounded-2xl text-xs font-semibold bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
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
