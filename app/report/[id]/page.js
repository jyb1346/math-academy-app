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
  const { id } = useParams(); // evaluation id 또는 student_id
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500">리포트를 불러오는 중입니다...</div>;
  }

  if (!evalData) {
    return <div className="p-10 text-center text-gray-500">등록된 피드백 정보를 찾을 수 없습니다.</div>;
  }

  // 육각형 레이더 차트용 데이터 파싱 (10점 만점 기준)
  const chartData = [
    { subject: '출석/지각', A: evalData.score_tardiness, fullMark: 10 },
    { subject: '숙제완성도', A: evalData.score_homework, fullMark: 10 },
    { subject: '수업몰입도', A: evalData.score_focus, fullMark: 10 },
    { subject: '개념이해도', A: evalData.score_concept, fullMark: 10 },
    { subject: '수업난이도', A: evalData.score_difficulty, fullMark: 10 },
    { subject: '테스트점수', A: evalData.score_test, fullMark: 10 },
  ];

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-blue-100 overflow-hidden">
        
        {/* 상단 리포트 헤더 */}
        <div className="bg-blue-600 text-white p-6 text-center space-y-1">
          <span className="bg-blue-500/50 text-white text-xs px-3 py-1 rounded-full font-semibold">
            품수학 일일 학습 보고서
          </span>
          <h2 className="text-2xl font-extrabold pt-2">
            {evalData.users?.name || '학생'} 피드백
          </h2>
          <p className="text-xs text-blue-100">
            수업 일자: {evalData.eval_date}
          </p>
        </div>

        {/* 육각형 그래프 영역 */}
        <div className="p-4 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-700 mt-2 mb-1 text-center">
            📈 6가지 영역별 학습 분석
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
        </div>

        {/* 선생님 한 줄 피드백 */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-2">
          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Teacher's Feedback
          </h4>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border border-gray-200">
            {evalData.comment || '오늘도 수고 많았습니다!'}
          </p>
        </div>

        {/* 하단 닫기/홈으로 버튼 */}
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