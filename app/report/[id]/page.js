'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

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
    return <div className="p-10 text-center text-gray-500">리포트를 불러오는 중입니다...</div>;
  }

  if (!evalData) {
    return <div className="p-10 text-center text-gray-500">등록된 피드백 정보를 찾을 수 없습니다.</div>;
  }

  const chartData = [
    { subject: '개념이해', A: evalData.concept_score ?? 8, fullMark: 10 },
    { subject: '연산정확', A: evalData.calc_score ?? 8, fullMark: 10 },
    { subject: '응용해결', A: evalData.app_score ?? 8, fullMark: 10 },
    { subject: '수업집중', A: evalData.attitude_score ?? 8, fullMark: 10 },
    { subject: '과제완성', A: evalData.homework_score ?? 8, fullMark: 10 },
    { subject: '오답끈기', A: evalData.perseverance_score ?? 8, fullMark: 10 },
  ];

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
    <div className="min-h-screen bg-blue-50 py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-blue-100 overflow-hidden space-y-2">
        
        {/* 상단 리포트 헤더 */}
        <div className="bg-blue-600 text-white p-6 text-center space-y-1.5">
          <span className="bg-blue-500/50 text-white text-xs px-3 py-1 rounded-full font-semibold">
            품수학 일일 학습 보고서
          </span>
          <h2 className="text-2xl font-extrabold pt-1">
            {(evalData.users?.name || '학생') + ' 피드백'}
          </h2>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-xs text-blue-100">
              {'📅 수업 일자: ' + evalData.eval_date}
            </span>
            <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {renderAttendanceText()}
            </span>
          </div>
        </div>

        {/* 육각형 그래프 영역 */}
        <div className="p-4 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-700 mt-2 mb-1 text-center">
            📊 6대 핵심 역량별 학습 분석
          </h3>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#cbd5e1" />
                <Radar
                  name="성취도"
                  dataKey="A"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 6대 역량 수치 그리드 */}
          <div className="w-full grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-700 mt-1">
            <div className="text-center">개념: <span className="text-blue-600 font-extrabold">{(evalData.concept_score ?? '-') + '점'}</span></div>
            <div className="text-center">연산: <span className="text-blue-600 font-extrabold">{(evalData.calc_score ?? '-') + '점'}</span></div>
            <div className="text-center">응용: <span className="text-blue-600 font-extrabold">{(evalData.app_score ?? '-') + '점'}</span></div>
            <div className="text-center">집중: <span className="text-blue-600 font-extrabold">{(evalData.attitude_score ?? '-') + '점'}</span></div>
            <div className="text-center">과제: <span className="text-blue-600 font-extrabold">{(evalData.homework_score ?? '-') + '점'}</span></div>
            <div className="text-center">끈기: <span className="text-blue-600 font-extrabold">{(evalData.perseverance_score ?? '-') + '점'}</span></div>
          </div>
        </div>

        {/* 선생님 피드백 */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-2">
          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Teacher's Feedback
          </h4>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border border-gray-200">
            {evalData.teacher_comment || '오늘도 열심히 참여했습니다!'}
          </p>
        </div>

        {/* 학부모 답장 작성 섹션 */}
        <div className="p-6 bg-white border-t border-gray-100 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            💬 선생님께 답장 남기기
          </h4>
          <form onSubmit={handleReplySubmit} className="space-y-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="선생님께 전달할 감사 인사나 문의사항을 입력해 주세요."
              rows={3}
              className="w-full p-3 border rounded-xl text-sm bg-slate-50 focus:outline-blue-500"
            />
            <button
              type="submit"
              disabled={submittingReply}
              className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {submittingReply ? '전송 중...' : '답장 전송하기'}
            </button>
          </form>
        </div>

        {/* 하단 이동 버튼 */}
        <div className="p-4 bg-white text-center">
          <button
            onClick={() => router.push('/')}
            className="text-xs font-bold text-gray-500 hover:text-blue-600 underline"
          >
            품수학 홈으로 이동
          </button>
        </div>

      </div>
    </div>
  );
}
