'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// 🎯 학생용 육각형 성취도 레이더 차트 컴포넌트
function StudentHexagonChart({ scores, twoWeekAvgScores }) {
  const { concept = 8, calc = 8, app = 8, attitude = 8, homework = 8, perseverance = 8 } = scores;
  const labels = ['개념이해', '연산정확', '응용해결', '수업집중', '과제완성', '오답끈기'];
  const values = [concept, calc, app, attitude, homework, perseverance];

  const center = 100;
  const radius = 65;

  const getCoordinates = (valArray, maxVal = 10) => {
    return valArray.map((val, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const r = (val / maxVal) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
      <svg width="220" height="220" viewBox="0 0 200 200" className="overflow-visible">
        {gridLevels.map((level, idx) => (
          <polygon
            key={idx}
            points={getCoordinates([10, 10, 10, 10, 10, 10].map(v => v * level))}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray={idx === 4 ? "none" : "2 2"}
          />
        ))}

        {labels.map((_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
        })}

        {/* 학생 본인의 최근 2주 평균 오버랩 (오렌지 점선) */}
        {twoWeekAvgScores && (
          <polygon
            points={getCoordinates([
              twoWeekAvgScores.concept,
              twoWeekAvgScores.calc,
              twoWeekAvgScores.app,
              twoWeekAvgScores.attitude,
              twoWeekAvgScores.homework,
              twoWeekAvgScores.perseverance,
            ])}
            fill="rgba(249, 115, 22, 0.15)"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* 선택한 수업일 당일 성취도 (파란 영역) */}
        <polygon
          points={getCoordinates(values)}
          fill="rgba(37, 99, 235, 0.3)"
          stroke="#2563eb"
          strokeWidth="2.5"
        />

        {values.map((val, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const r = (val / 10) * radius;
          const cx = center + r * Math.cos(angle);
          const cy = center + r * Math.sin(angle);
          return <circle key={i} cx={cx} cy={cy} r="3.5" fill="#2563eb" />;
        })}

        {labels.map((label, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const labelRadius = radius + 18;
          const lx = center + labelRadius * Math.cos(angle);
          const ly = center + labelRadius * Math.sin(angle);
          return (
            <text
              key={i} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              className="text-[10px] font-black fill-slate-700"
            >
              {label} ({values[i]})
            </text>
          );
        })}
      </svg>

      <div className="flex items-center justify-center gap-4 text-[11px] font-bold pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
          <span className="text-blue-900">당일 성취도</span>
        </div>
        {twoWeekAvgScores && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block border border-dashed"></span>
            <span className="text-orange-900">나의 최근 2주 평균</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(''); // 🎯 날짜 선택 필터
  const [myTeacher, setMyTeacher] = useState(null);
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
      if (parsedUser.role !== 'STUDENT') {
        router.push('/');
        return;
      }
      setUser(parsedUser);
      fetchStudentData(parsedUser);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const fetchStudentData = async (studentUser) => {
    try {
      // 1. 피드백 이력 가져오기
      const { data: evalData, error } = await supabase
        .from('daily_evaluations')
        .select('*')
        .eq('student_id', studentUser.id)
        .order('eval_date', { ascending: false });

      if (!error) {
        setEvaluations(evalData || []);
      }

      // 2. 담당 선생님 정보 가져오기
      if (studentUser.teacher_id) {
        const { data: tcData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', studentUser.teacher_id)
          .single();
        if (tcData) setMyTeacher(tcData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 최근 2주간 본인 평균 성취도 계산
  const getTwoWeekAvgScores = (currentEvalDate) => {
    if (!currentEvalDate || evaluations.length === 0) return null;

    const targetDate = new Date(currentEvalDate);
    const twoWeeksAgo = new Date(targetDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const twoWeekEvals = evaluations.filter((e) => {
      const evalDateObj = new Date(e.eval_date);
      return evalDateObj >= twoWeeksAgo && evalDateObj <= targetDate;
    });

    if (twoWeekEvals.length === 0) return null;

    const total = twoWeekEvals.reduce(
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

    const count = twoWeekEvals.length;
    return {
      concept: Number((total.concept / count).toFixed(1)),
      calc: Number((total.calc / count).toFixed(1)),
      app: Number((total.app / count).toFixed(1)),
      attitude: Number((total.attitude / count).toFixed(1)),
      homework: Number((total.homework / count).toFixed(1)),
      perseverance: Number((total.perseverance / count).toFixed(1)),
    };
  };

  // 🎯 날짜 필터링된 피드백 데이터
  const filteredEvals = evaluations.filter((item) => {
    if (!selectedDate) return true;
    return item.eval_date === selectedDate;
  });

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-600">품수학 학원 학생 강의실</h1>
          <p className="text-xs text-slate-400 font-medium">
            {user?.name} 학생 환영합니다! {myTeacher && `(담당: ${myTeacher.name} 선생님)`}
          </p>
        </div>
        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        {/* 상단 핵심 메뉴 이동 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/board')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-5 rounded-2xl font-bold text-left shadow transition flex justify-between items-center"
          >
            <div>
              <span className="block text-base">📢 반별 공지 및 숙제 확인</span>
              <span className="text-xs text-indigo-100 font-normal">선생님이 올리신 공지사항과 숙제를 확인합니다.</span>
            </div>
            <span className="text-xl">→</span>
          </button>

          <button
            onClick={() => router.push('/qna')}
            className="bg-slate-800 hover:bg-slate-900 text-white p-5 rounded-2xl font-bold text-left shadow transition flex justify-between items-center"
          >
            <div>
              <span className="block text-base">❓ 선생님께 질문하기 (Q&A)</span>
              <span className="text-xs text-slate-300 font-normal">모르는 문제나 궁금한 점을 질문합니다.</span>
            </div>
              <span className="text-xl">→</span>
          </button>
        </section>

        {/* 학습 성취도 피드백 리포트 */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📊</span> 나의 일일 학습 피드백 리포트
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">선생님께서 기록해주신 일일 성취도 그래프와 총평입니다.</p>
            </div>

            {/* 🎯 날짜 선택 필터 */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600">📅 날짜 선택:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-1.5 border rounded-lg text-xs bg-white font-bold text-slate-800"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="text-xs text-rose-500 font-bold hover:underline px-1"
                >
                  전체보기
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {filteredEvals.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">
                {selectedDate ? `${selectedDate}에 등록된 피드백이 없습니다.` : '아직 작성된 학습 피드백이 없습니다.'}
              </p>
            ) : (
              filteredEvals.map((item) => {
                const twoWeekAvgScores = getTwoWeekAvgScores(item.eval_date);

                return (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    
                    <div className="flex justify-between items-center border-b pb-3 text-xs">
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold border border-blue-200">
                        📅 수업일: {item.eval_date}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      
                      {/* 육각형 그래프 연동 */}
                      <div className="md:col-span-1 flex justify-center">
                        <StudentHexagonChart
                          scores={{
                            concept: item.concept_score,
                            calc: item.calc_score,
                            app: item.app_score,
                            attitude: item.attitude_score,
                            homework: item.homework_score,
                            perseverance: item.perseverance_score,
                          }}
                          twoWeekAvgScores={twoWeekAvgScores}
                        />
                      </div>

                      {/* 코멘트 및 학부모 수신 답장 */}
                      <div className="md:col-span-2 space-y-3">
                        <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-1">
                          <span className="text-xs font-bold text-blue-800 block">✍️ 선생님 학습 총평</span>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                            {item.teacher_comment || '작성된 코멘트가 없습니다.'}
                          </p>
                        </div>

                        {item.parent_reply && (
                          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
                              <span>💌 학부모님 수신 답장</span>
                              <span className="text-emerald-600 text-[10px]">
                                {item.parent_reply_at ? new Date(item.parent_reply_at).toLocaleDateString() : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 font-bold">"{item.parent_reply}"</p>
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>
    </div>
  );
}