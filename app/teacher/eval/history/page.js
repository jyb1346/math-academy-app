'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// SVG 기반 오버랩(학생 vs 반 평균) 육각형 레이더 차트
function HexagonRadarChart({ scores, classAvgScores }) {
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
        {/* 격자망 */}
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

        {/* 방사형 축 */}
        {labels.map((_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
        })}

        {/* 1. 같은 반 평균 영역 (주황색) */}
        {classAvgScores && (
          <polygon
            points={getCoordinates([
              classAvgScores.concept,
              classAvgScores.calc,
              classAvgScores.app,
              classAvgScores.attitude,
              classAvgScores.homework,
              classAvgScores.perseverance,
            ])}
            fill="rgba(249, 115, 22, 0.2)"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* 2. 학생 본인 영역 (파란색) */}
        <polygon
          points={getCoordinates(values)}
          fill="rgba(37, 99, 235, 0.3)"
          stroke="#2563eb"
          strokeWidth="2.5"
        />

        {/* 학생 꼭짓점 포인트 */}
        {values.map((val, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const r = (val / 10) * radius;
          const cx = center + r * Math.cos(angle);
          const cy = center + r * Math.sin(angle);
          return <circle key={i} cx={cx} cy={cy} r="3.5" fill="#2563eb" />;
        })}

        {/* 라벨 */}
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

      {/* 범례 (Legend) */}
      <div className="flex items-center justify-center gap-4 text-[11px] font-bold pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
          <span className="text-blue-900">학생 본인</span>
        </div>
        {classAvgScores && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block border border-dashed"></span>
            <span className="text-orange-900">반 평균</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvalHistoryPage() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);

  // 필터 상태 (반, 학생, 날짜)
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(''); // 특정 날짜 검색
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'TEACHER' && parsedUser.role !== 'HEAD_TEACHER') {
      alert('선생님 권한이 필요합니다.');
      router.push('/');
      return;
    }
    setUser(parsedUser);
    fetchData(parsedUser);
  }, []);

  const fetchData = async (currentUser) => {
    try {
      let stQuery = supabase.from('users').select('id, name, email').eq('role', 'STUDENT');
      if (currentUser.role !== 'HEAD_TEACHER') {
        stQuery = stQuery.eq('teacher_id', currentUser.id);
      }
      const { data: stData } = await stQuery;
      setStudents(stData || []);

      let cQuery = supabase.from('classes').select('*');
      if (currentUser.role !== 'HEAD_TEACHER') {
        cQuery = cQuery.eq('teacher_id', currentUser.id);
      }
      const { data: cData } = await cQuery;
      setClasses(cData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      let evalQuery = supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name, email)')
        .order('eval_date', { ascending: false });

      if (currentUser.role !== 'HEAD_TEACHER') {
        evalQuery = evalQuery.eq('teacher_id', currentUser.id);
      }

      const { data: evalData, error } = await evalQuery;
      if (error) throw error;
      setEvaluations(evalData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEval = async (id, studentName, evalDate) => {
    if (!confirm(`[${studentName}] 학생의 ${evalDate} 피드백을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase.from('daily_evaluations').delete().eq('id', id);
      if (error) throw error;
      alert('삭제되었습니다.');
      fetchData(user);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 특정 학생이 속한 반의 전체 학생 ID 추출 및 반 평균 점수 계산
  const getClassAvgScores = (studentId) => {
    // 해당 학생이 속한 첫 번째 반 찾기
    const studentClassRelation = classStudents.find((cs) => cs.student_id === studentId);
    if (!studentClassRelation) return null;

    const classId = studentClassRelation.class_id;
    const sameClassStudentIds = classStudents
      .filter((cs) => cs.class_id === classId)
      .map((cs) => cs.student_id);

    // 반 전체 학생들의 피드백 집계
    const classEvals = evaluations.filter((e) => sameClassStudentIds.includes(e.student_id));
    if (classEvals.length === 0) return null;

    const total = classEvals.reduce(
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

    const count = classEvals.length;
    return {
      concept: Number((total.concept / count).toFixed(1)),
      calc: Number((total.calc / count).toFixed(1)),
      app: Number((total.app / count).toFixed(1)),
      attitude: Number((total.attitude / count).toFixed(1)),
      homework: Number((total.homework / count).toFixed(1)),
      perseverance: Number((total.perseverance / count).toFixed(1)),
    };
  };

  // 필터링 적용 (반, 학생, 날짜)
  const filteredEvals = evaluations.filter((item) => {
    if (selectedStudentId !== 'ALL' && item.student_id !== selectedStudentId) {
      return false;
    }
    if (selectedClassId !== 'ALL') {
      const inClass = classStudents.some(
        (cs) => cs.class_id === parseInt(selectedClassId) && cs.student_id === item.student_id
      );
      if (!inClass) return false;
    }
    if (selectedDate && item.eval_date !== selectedDate) {
      return false;
    }
    return true;
  });

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 onClick={() => router.push('/teacher/dashboard')} className="text-xl font-bold text-blue-600 cursor-pointer">
          품수학 학원 교무실
        </h1>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>🔷</span> 육각형 피드백 리포트 ({filteredEvals.length}건)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">날짜별 피드백 검색 및 같은 반 학생 평균 오랩 비교 기능</p>
            </div>
            <button
              onClick={() => router.push('/teacher/eval')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + 새 피드백 작성
            </button>
          </div>

          {/* 3가지 필터 영역 (반 / 학생 / 날짜) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            
            {/* 1. 반 필터 */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">🏫 반 선택</label>
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId('ALL'); }}
                className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-700"
              >
                <option value="ALL">전체 반 보기</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                ))}
              </select>
            </div>

            {/* 2. 학생 필터 */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">👤 학생 선택</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-700"
              >
                <option value="ALL">전체 학생 보기</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                ))}
              </select>
            </div>

            {/* 3. 날짜 지정 검색 필터 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-600">📅 날짜 지정</label>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="text-[10px] text-rose-500 font-bold hover:underline"
                  >
                    날짜 초기화 ✕
                  </button>
                )}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs bg-white font-bold text-slate-700"
              />
            </div>

          </div>

          {/* 피드백 리스트 (반 평균 오버랩 포함) */}
          <div className="space-y-6">
            {filteredEvals.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">조건에 해당하는 학습 피드백이 없습니다.</p>
            ) : (
              filteredEvals.map((item) => {
                const classAvgScores = getClassAvgScores(item.student_id);

                return (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    
                    {/* 상단 프로필 및 날짜 */}
                    <div className="flex justify-between items-center border-b pb-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-800">{item.users?.name} 학생</span>
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold border border-blue-200">
                          📅 수업일: {item.eval_date}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteEval(item.id, item.users?.name, item.eval_date)}
                        className="text-rose-500 hover:underline font-bold"
                      >
                        삭제
                      </button>
                    </div>

                    {/* 2컬럼: 오버랩 육각형 차트 / 코멘트 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      
                      {/* 오버랩 육각형 그래프 */}
                      <div className="md:col-span-1 flex justify-center">
                        <HexagonRadarChart
                          scores={{
                            concept: item.concept_score,
                            calc: item.calc_score,
                            app: item.app_score,
                            attitude: item.attitude_score,
                            homework: item.homework_score,
                            perseverance: item.perseverance_score,
                          }}
                          classAvgScores={classAvgScores}
                        />
                      </div>

                      {/* 총평 및 분석 */}
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

        </div>
      </main>
    </div>
  );
}