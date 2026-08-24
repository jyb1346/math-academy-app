'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherEvalPage() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  
  // 선택된 반 필터 ('ALL' 또는 class.id)
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 평가 폼 상태 (1~10점 선택)
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState('ATTEND');
  const [concept, setConcept] = useState(8);      // 개념 이해도
  const [calculation, setCalculation] = useState(8);  // 계산 정확도
  const [application, setApplication] = useState(7);  // 응용/유형 해결력
  const [attitude, setAttitude] = useState(8);     // 수업 집중도
  const [homework, setHomework] = useState(9);     // 과제 완성도 (오타 수정: fontHomework -> setHomework)
  const [perseverance, setPerseverance] = useState(7); // 오답/끈기
  const [teacherComment, setTeacherComment] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'TEACHER' && parsedUser.role !== 'HEAD_TEACHER') {
      alert('선생님 접근 권한이 필요합니다.');
      router.push('/');
      return;
    }
    setUser(parsedUser);
    fetchInitialData(parsedUser);
  }, []);

  const fetchInitialData = async (currentUser) => {
    try {
      // 🎯 [핵심] 원장님도 기본적으로 '내가 직접 담당하는 학생'만 피드백 작성에 가져옴
      const { data: stData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'STUDENT')
        .eq('teacher_id', currentUser.id);
      setStudents(stData || []);

      // 🎯 [핵심] 내가 만든 반만 피드백 선택 필터에 가져옴
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', currentUser.id);
      setClasses(cData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

    } catch (err) {
      console.error(err);
    }
  };

  const filteredStudents = students.filter((st) => {
    if (selectedClassId === 'ALL') return true;
    return classStudents.some(
      (cs) => cs.class_id === parseInt(selectedClassId) && cs.student_id === st.id
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return alert('학생을 선택해 주세요.');

    setLoading(true);
    try {
      const evalData = {
        student_id: selectedStudent.id,
        teacher_id: user.id, // 로그인한 원장님 본인의 ID로 저장
        eval_date: evalDate,
        attendance,
        concept_score: parseInt(concept),
        calc_score: parseInt(calculation),
        app_score: parseInt(application),
        attitude_score: parseInt(attitude),
        homework_score: parseInt(homework),
        perseverance_score: parseInt(perseverance),
        teacher_comment: teacherComment,
      };

      const { error } = await supabase.from('daily_evaluations').insert([evalData]);
      if (error) throw error;

      alert(`[${selectedStudent.name}] 학생의 일일 학습 피드백이 저장되었습니다.`);
      setTeacherComment('');
    } catch (err) {
      alert(`등록 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="p-8 text-center font-bold">로딩 중...</div>;

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

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-3 flex items-center gap-2">
            <span>📊</span> 일일 학습 피드백 작성 ({user.name} 선생님 전용)
          </h2>

          {/* 1. 반(Class) 필터 탭 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600">🏫 내 개설 반 선택 필터</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => { setSelectedClassId('ALL'); setSelectedStudent(null); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedClassId === 'ALL'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                전체 내 담당 학생 ({students.length}명)
              </button>
              {classes.map((cls) => {
                const count = classStudents.filter((cs) => cs.class_id === cls.id).length;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => { setSelectedClassId(cls.id.toString()); setSelectedStudent(null); }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      selectedClassId === cls.id.toString()
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    📘 {cls.name} ({count}명)
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 학생 선택 버블 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600">👤 피드백 작성할 학생 선택</label>
            {filteredStudents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
                선택한 반에 소속된 내 담당 학생이 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {filteredStudents.map((st) => {
                  const isSelected = selectedStudent?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStudent(st)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md scale-105'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span>{st.name}</span>
                      {isSelected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. 영역 평가 입력 폼 */}
          {selectedStudent ? (
            <form onSubmit={handleSubmit} className="space-y-5 pt-4 border-t border-slate-100">
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs font-bold text-blue-900 flex justify-between items-center">
                <span>🎯 평가 학생: {selectedStudent.name} ({selectedStudent.email})</span>
                <div className="flex items-center gap-2">
                  <span>수업일:</span>
                  <input
                    type="date"
                    value={evalDate}
                    onChange={(e) => setEvalDate(e.target.value)}
                    className="p-1 px-2 border rounded-lg text-xs bg-white font-bold"
                  />
                </div>
              </div>

              {/* 6대 영역 점수 슬라이더 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>📐 개념 이해도</span>
                    <span className="text-blue-600 font-black text-sm">{concept}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>✏️ 연산/계산 정확도</span>
                    <span className="text-blue-600 font-black text-sm">{calculation}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={calculation}
                    onChange={(e) => setCalculation(e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>💡 응용/심화 해결력</span>
                    <span className="text-blue-600 font-black text-sm">{application}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={application}
                    onChange={(e) => setApplication(e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>🔥 수업 태도/집중도</span>
                    <span className="text-blue-600 font-black text-sm">{attitude}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={attitude}
                    onChange={(e) => setAttitude(e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>📚 과제 이행 및 완성도</span>
                    <span className="text-blue-600 font-black text-sm">{homework}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>🧩 오답 복습 및 끈기</span>
                    <span className="text-blue-600 font-black text-sm">{perseverance}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={perseverance}
                    onChange={(e) => setPerseverance(e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">선생님 총평 코멘트</label>
                <textarea
                  required
                  placeholder="오늘 수업 성취도 및 보완할 점을 자유롭게 기록해 주세요."
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm h-24"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 shadow transition disabled:bg-slate-300"
              >
                {loading ? '저장 중...' : '피드백 저장하기'}
              </button>
            </form>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
              위에서 학생을 선택하시면 피드백 입력 창이 나타납니다.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}