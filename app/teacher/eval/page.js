'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherEvalPage() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // 🎯 평가 항목 상태 (6개 + 출결/지각)
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('ATTEND'); // ATTEND, LATE, ABSENT
  const [latenessMinutes, setLatenessMinutes] = useState(10); // 지각 분

  const [conceptScore, setConceptScore] = useState(8);
  const [calcScore, setCalcScore] = useState(8);
  const [appScore, setAppScore] = useState(8);
  const [attitudeScore, setAttitudeScore] = useState(8);
  const [homeworkScore, setHomeworkScore] = useState(8);
  const [perseveranceScore, setPerseveranceScore] = useState(8);

  const [teacherComment, setTeacherComment] = useState('');
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
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', currentUser.id);
      
      const classList = cData || [];
      setClasses(classList);

      if (classList.length > 0) {
        setSelectedClassId(classList[0].id.toString());
        fetchClassStudents(classList[0].id);
      } else {
        const { data: stData } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('role', 'STUDENT')
          .eq('teacher_id', currentUser.id);
        setStudents(stData || []);
        if (stData && stData.length > 0) setSelectedStudentId(stData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassStudents = async (classId) => {
    try {
      const { data: csData } = await supabase
        .from('class_students')
        .select('student_id, users(id, name, email)')
        .eq('class_id', classId);

      if (csData) {
        const stList = csData.map((item) => item.users).filter(Boolean);
        setStudents(stList);
        if (stList.length > 0) setSelectedStudentId(stList[0].id);
        else setSelectedStudentId('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClassChange = (e) => {
    const cId = e.target.value;
    setSelectedClassId(cId);
    fetchClassStudents(cId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) return alert('학생을 선택해 주세요.');

    try {
      const payload = {
        teacher_id: user.id,
        student_id: selectedStudentId,
        eval_date: evalDate,
        attendance_status: attendanceStatus,
        lateness_minutes: attendanceStatus === 'LATE' ? parseInt(latenessMinutes) : 0,
        concept_score: parseInt(conceptScore),
        calc_score: parseInt(calcScore),
        app_score: parseInt(appScore),
        attitude_score: parseInt(attitudeScore),
        homework_score: parseInt(homeworkScore),
        perseverance_score: parseInt(perseveranceScore),
        teacher_comment: teacherComment,
      };

      const { error } = await supabase.from('daily_evaluations').insert([payload]);
      if (error) throw error;

      alert('일일 피드백이 등록되었습니다!');
      setTeacherComment('');
    } catch (err) {
      alert(`등록 실패: ${err.message}`);
    }
  };

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

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">📝 일일 학습 피드백 및 성취도 입력</h2>
              <p className="text-xs text-slate-400 mt-0.5">학생별 6대 학습 영역 성취도와 출결/지각 상태를 기록합니다.</p>
            </div>
            <button
              onClick={() => router.push('/teacher/eval/history')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition"
            >
              📋 피드백 내역 보기
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 반 & 학생 & 날짜 선택 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">🏫 담당 반 선택</label>
                <select
                  value={selectedClassId}
                  onChange={handleClassChange}
                  className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">👤 학생 선택</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                >
                  {students.length === 0 ? (
                    <option value="">등록된 학생 없음</option>
                  ) : (
                    students.map((st) => (
                      <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">📅 수업 날짜</label>
                <input
                  type="date"
                  value={evalDate}
                  onChange={(e) => setEvalDate(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs bg-white font-bold text-slate-800"
                />
              </div>
            </div>

            {/* 🎯 [추가] 출결 및 지각 정보 선택 폼 */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <span className="text-xs font-extrabold text-amber-900 block">⏰ 출석 및 지각 상태 기록</span>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('ATTEND')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    attendanceStatus === 'ATTEND'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  🟢 정시 출석
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('LATE')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    attendanceStatus === 'LATE'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  ⏰ 지각
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('ABSENT')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    attendanceStatus === 'ABSENT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  🔴 결석
                </button>

                {/* 지각 선택 시 분 입력 세부 옵션 */}
                {attendanceStatus === 'LATE' && (
                  <div className="flex items-center gap-1.5 ml-2 bg-white px-3 py-1.5 rounded-xl border border-amber-300">
                    <span className="text-xs font-bold text-amber-800">지각 시간:</span>
                    <select
                      value={latenessMinutes}
                      onChange={(e) => setLatenessMinutes(e.target.value)}
                      className="text-xs font-extrabold text-amber-900 bg-transparent focus:outline-none"
                    >
                      <option value={5}>5분 지각</option>
                      <option value={10}>10분 지각</option>
                      <option value={15}>15분 지각</option>
                      <option value={20}>20분 지각</option>
                      <option value={30}>30분 이상 지각</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 6대 영역 점수 슬라이더 */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-700">📊 6대 성취도 영역 (각 1~10점)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>📘 개념 이해도</span>
                    <span className="text-blue-600 font-black">{conceptScore}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={conceptScore}
                    onChange={(e) => setConceptScore(e.target.value)} className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>🔢 연산/계산 정확도</span>
                    <span className="text-blue-600 font-black">{calcScore}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={calcScore}
                    onChange={(e) => setCalcScore(e.target.value)} className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>💡 응용/심화 해결력</span>
                    <span className="text-blue-600 font-black">{appScore}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={appScore}
                    onChange={(e) => setAppScore(e.target.value)} className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>👀 수업 태도/집중도</span>
                    <span className="text-blue-600 font-black">{attitudeScore}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={attitudeScore}
                    onChange={(e) => setAttitudeScore(e.target.value)} className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>📚 과제 완성도</span>
                    <span className="text-blue-600 font-black">{homeworkScore}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={homeworkScore}
                    onChange={(e) => setHomeworkScore(e.target.value)} className="w-full accent-blue-600"
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>🔥 오답 복습 및 끈기</span>
                    <span className="text-blue-600 font-black">{perseveranceScore}점</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={perseveranceScore}
                    onChange={(e) => setPerseveranceScore(e.target.value)} className="w-full accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* 총평 메모 */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">✍️ 선생님 총평 코멘트</label>
              <textarea
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="오늘 수업 성취 및 칭찬/보완할 점을 적어주세요."
                className="w-full p-3 border rounded-xl text-xs h-24 font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow transition text-sm"
            >
              일일 피드백 등록하기
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}