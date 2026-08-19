'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [latestEval, setLatestEval] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'STUDENT') {
      alert('학생 권한이 필요합니다.');
      router.push('/login');
      return;
    }
    setStudent(parsedUser);
    fetchAttendance(parsedUser.id);
    fetchLatestEvaluation(parsedUser.id);
  }, []);

  // 출결 기록 가져오기
  const fetchAttendance = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('check_in_time', { ascending: false });

      if (error) throw error;
      setAttendanceList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 최근 일일 학습 피드백 1건 가져오기
  const fetchLatestEvaluation = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from('daily_evaluations')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestEval(data);
    } catch (err) {
      console.error('피드백 조회 오류:', err);
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 상단 헤더 */}
      <header className="bg-blue-600 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{student?.name} 학생 강의실</h1>
            <p className="text-sm opacity-90">품수학 스마트 학습 대시보드</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('user');
              router.push('/login');
            }}
            className="bg-blue-700 hover:bg-blue-800 text-xs px-3 py-2 rounded-lg transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        
        {/* 🔥 최신 일일 학습 피드백 카드 (새로 추가) */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-md p-6 text-white">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              📊 최근 일일 학습 피드백 리포트
            </h2>
            {latestEval && (
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-semibold">
                수업일: {latestEval.eval_date}
              </span>
            )}
          </div>

          {latestEval ? (
            <div className="space-y-4">
              <p className="text-sm opacity-90 line-clamp-2 bg-white/10 p-3 rounded-xl">
                💬 선생님 총평: "{latestEval.comment || '오늘 수업도 수고 많았습니다!'}"
              </p>
              <button
                onClick={() => router.push(`/report/${latestEval.id}`)}
                className="w-full bg-white text-blue-600 font-bold py-3 rounded-xl shadow hover:bg-blue-50 transition text-sm flex items-center justify-center gap-1"
              >
                🎯 육각형 성취도 그래프 및 상세 리포트 보기 →
              </button>
            </div>
          ) : (
            <p className="text-sm opacity-80 py-2">
              아직 등록된 일일 피드백 리포트가 없습니다.
            </p>
          )}
        </section>

        {/* 출결 현황 카드 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📱</span> 나의 출석 기록
          </h2>
          {attendanceList.length === 0 ? (
            <p className="text-gray-500 text-center py-4">아직 기록된 출결 정보가 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {attendanceList.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <span className="text-gray-600">
                    {new Date(item.check_in_time).toLocaleString('ko-KR')}
                  </span>
                  <span
                    className={`font-bold px-3 py-1 rounded-full text-xs ${
                      item.status === 'PRESENT'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'LATE'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {item.status === 'PRESENT'
                      ? '출석'
                      : item.status === 'LATE'
                      ? '지각'
                      : '결석'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 게시판 메뉴 목록 */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">📢</span>
            <span>공지사항</span>
          </div>
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">📝</span>
            <span>숙제 확인/제출</span>
          </div>
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🎬</span>
            <span>복습 영상</span>
          </div>
          <div 
            onClick={() => router.push('/qna')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">❓</span>
            <span>1:1 Q&A 질문</span>
          </div>
        </section>

      </main>
    </div>
  );
}