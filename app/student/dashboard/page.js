'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
    <div className="flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
      <svg width="230" height="230" viewBox="0 0 200 200" className="overflow-visible">
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
            fill="rgba(249, 115, 22, 0.12)"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        <polygon
          points={getCoordinates(values)}
          fill="rgba(37, 99, 235, 0.28)"
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
          const labelRadius = radius + 19;
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

      <div className="flex items-center justify-center gap-4 text-xs font-bold pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shadow-sm"></span>
          <span className="text-blue-900">당일 성취도</span>
        </div>
        {twoWeekAvgScores && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block border border-dashed"></span>
            <span className="text-orange-900">최근 2주 평균</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [myTeacher, setMyTeacher] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeEvalModal, setActiveEvalModal] = useState(null);

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
      const { data: evalData, error } = await supabase
        .from('daily_evaluations')
        .select('*')
        .eq('student_id', studentUser.id)
        .order('eval_date', { ascending: false });

      if (!error) {
        setEvaluations(evalData || []);
      }

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

  // 🎯 출결/지각 뱃지 렌더링 함수
  const renderAttendanceBadge = (status, latenessMins) => {
    if (status === 'LATE') {
      return (
        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full">
          ⏰ {latenessMins || 10}분 지각
        </span>
      );
    }
    if (status === 'ABSENT') {
      return (
        <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-2.5 py-0.5 rounded-full">
          🔴 결석
        </span>
      );
    }
    return (
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-2.5 py-0.5 rounded-full">
        🟢 정시 출석
      </span>
    );
  };

  const filteredEvals = evaluations.filter((item) => {
    if (!selectedDate) return true;
    return item.eval_date === selectedDate;
  });

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20">
      
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-base shadow-md shadow-blue-500/20">
            품
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 leading-tight">품수학 스마트 강의실</h1>
            <p className="text-[11px] text-slate-400 font-semibold">
              {user?.name} 학생 {myTeacher && <span className="text-indigo-600 font-bold">• 담당: {myTeacher.name}T</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">

        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-indigo-950/10 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] px-3 py-1 rounded-full font-bold">
              🎓 POOM MATH STUDENT
            </span>
            <span className="text-xs text-slate-400 font-medium">총 {evaluations.length}회의 수업 기록</span>
          </div>
          <h2 className="text-xl font-black">
            반갑습니다, <span className="text-blue-400">{user?.name}</span> 학생! 👋
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            선생님이 남겨주신 일일 피드백과 반별 공지사항을 확인하고 오늘 학습을 준비하세요.
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/board')}
            className="bg-white hover:border-indigo-300 border border-slate-200/80 p-5 rounded-2xl font-bold text-left shadow-sm hover:shadow-md transition-all duration-200 flex justify-between items-center group"
          >
            <div className="space-y-1">
              <span className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-md font-bold mb-1">
                📢 반별 게시판
              </span>
              <span className="block text-base font-extrabold text-slate-800 group-hover:text-indigo-600 transition">
                공지사항 및 숙제 확인
              </span>
              <span className="text-xs text-slate-400 font-normal block">
                선생님이 부여하신 과제와 알림을 확인합니다.
              </span>
            </div>
            <span className="text-xl text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">→</span>
          </button>

          <button
            onClick={() => router.push('/qna')}
            className="bg-white hover:border-blue-300 border border-slate-200/80 p-5 rounded-2xl font-bold text-left shadow-sm hover:shadow-md transition-all duration-200 flex justify-between items-center group"
          >
            <div className="space-y-1">
              <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-md font-bold mb-1">
                ❓ 1:1 질문함
              </span>
              <span className="block text-base font-extrabold text-slate-800 group-hover:text-blue-600 transition">
                선생님께 질문하기 (Q&A)
              </span>
              <span className="text-xs text-slate-400 font-normal block">
                궁금하거나 모르는 문제를 직접 질문합니다.
              </span>
            </div>
            <span className="text-xl text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">→</span>
          </button>
        </section>

        {/* 일일 피드백 목록 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>📋</span> 일일 학습 피드백 기록
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                날짜별 수업 피드백 카드를 클릭하여 성취도 그래프를 확인하세요.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-500">📅 날짜:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-1 border rounded-lg text-xs bg-white font-bold text-slate-800"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="text-xs text-rose-500 font-bold hover:underline px-1"
                >
                  전체
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredEvals.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">
                {selectedDate ? `${selectedDate}에 작성된 피드백이 없습니다.` : '아직 등록된 학습 피드백이 없습니다.'}
              </p>
            ) : (
              filteredEvals.map((item) => {
                const avgScore = (
                  ((item.concept_score || 0) +
                    (item.calc_score || 0) +
                    (item.app_score || 0) +
                    (item.attitude_score || 0) +
                    (item.homework_score || 0) +
                    (item.perseverance_score || 0)) / 6
                ).toFixed(1);

                return (
                  <div
                    key={item.id}
                    className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/70 transition space-y-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                          📅 {item.eval_date}
                        </span>
                        
                        {/* 🎯 [추가] 출결/지각 뱃지 */}
                        {renderAttendanceBadge(item.attendance_status, item.lateness_minutes)}

                        <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                          성취도 평균: {avgScore}점 / 10점
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium line-clamp-1">
                        ✍️ {item.teacher_comment ? item.teacher_comment : '작성된 요약 총평이 있습니다.'}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveEvalModal(item)}
                      className="bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition whitespace-nowrap self-start sm:self-center flex items-center gap-1.5"
                    >
                      <span>📊 성취도 그래프 및 상세 피드백</span>
                      <span>→</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>

      {/* 🎯 [모달] 성취도 그래프 & 출결 상세 팝업 */}
      {activeEvalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl my-8 animate-in fade-in zoom-in-95">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <h3 className="text-base font-extrabold text-slate-800">
                  {activeEvalModal.eval_date} 피드백
                </h3>
              </div>
              
              {/* 모달 상단 출결 뱃지 */}
              <div className="flex items-center gap-2">
                {renderAttendanceBadge(activeEvalModal.attendance_status, activeEvalModal.lateness_minutes)}
                <button
                  onClick={() => setActiveEvalModal(null)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold w-7 h-7 rounded-full flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 육각형 레이더 차트 */}
            <div className="flex justify-center py-1">
              <StudentHexagonChart
                scores={{
                  concept: activeEvalModal.concept_score,
                  calc: activeEvalModal.calc_score,
                  app: activeEvalModal.app_score,
                  attitude: activeEvalModal.attitude_score,
                  homework: activeEvalModal.homework_score,
                  perseverance: activeEvalModal.perseverance_score,
                }}
                twoWeekAvgScores={getTwoWeekAvgScores(activeEvalModal.eval_date)}
              />
            </div>

            {/* 선생님 총평 */}
            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 space-y-1">
              <span className="text-xs font-extrabold text-blue-900 block">✍️ 선생님 총평 코멘트</span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                {activeEvalModal.teacher_comment || '작성된 코멘트가 없습니다.'}
              </p>
            </div>

            {/* 학부모 수신 답장 */}
            {activeEvalModal.parent_reply && (
              <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
                  <span>💌 학부모님 수신 답장</span>
                  <span className="text-emerald-600 text-[10px]">
                    {activeEvalModal.parent_reply_at ? new Date(activeEvalModal.parent_reply_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-800 font-bold">"{activeEvalModal.parent_reply}"</p>
              </div>
            )}

            <button
              onClick={() => setActiveEvalModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl font-bold text-xs shadow-md transition"
            >
              닫기
            </button>

          </div>
        </div>
      )}

    </div>
  );
}