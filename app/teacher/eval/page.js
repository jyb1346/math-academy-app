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

  // 평가 폼 상태
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState('ATTEND'); // ATTEND, LATE, ABSENT
  const [testScore, setTestScore] = useState('');
  const [testMaxScore, setTestMaxScore] = useState('100');
  const [attitude, setAttitude] = useState('EXCELLENT'); // EXCELLENT, GOOD, NEED_IMPROVEMENT
  const [homeworkStatus, setHomeworkStatus] = useState('COMPLETE'); // COMPLETE, INCOMPLETE, NONE
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
      // 1. 학생 목록 가져오기
      let studentQuery = supabase.from('users').select('*').eq('role', 'STUDENT');
      if (currentUser.role !== 'HEAD_TEACHER') {
        studentQuery = studentQuery.eq('teacher_id', currentUser.id);
      }
      const { data: stData } = await studentQuery;
      setStudents(stData || []);

      // 2. 반(Class) 목록 가져오기
      let classQuery = supabase.from('classes').select('*');
      if (currentUser.role !== 'HEAD_TEACHER') {
        classQuery = classQuery.eq('teacher_id', currentUser.id);
      }
      const { data: cData } = await classQuery;
      setClasses(cData || []);

      // 3. 반-학생 매핑 정보 가져오기
      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

    } catch (err) {
      console.error(err);
    }
  };

  // 선택된 반에 맞춰 학생 필터링
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
        teacher_id: user.id,
        eval_date: evalDate,
        attendance,
        test_score: testScore ? parseInt(testScore) : null,
        test_max_score: testMaxScore ? parseInt(testMaxScore) : 100,
        attitude,
        homework_status: homeworkStatus,
        teacher_comment: teacherComment,
      };

      const { error } = await supabase.from('daily_evaluations').insert([evalData]);
      if (error) throw error;

      alert(`[${selectedStudent.name}] 학생의 학습 피드백이 등록되었습니다.`);
      setTestScore('');
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
            <span>📊</span> 일일 학습 피드백 작성
          </h2>

          {/* 1. 반(Class) 선택 필터 탭 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600">🏫 반 선택 필터</label>
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
                전체 보기 ({students.length}명)
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

          {/* 2. 필터링된 학생 선택 버블 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600">👤 피드백 작성할 학생 선택</label>
            {filteredStudents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
                선택한 반에 소속된 학생이 없습니다.
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

          {/* 3. 피드백 입력 폼 */}
          {selectedStudent ? (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-100">
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs font-bold text-blue-900">
                🎯 선택된 학생: {selectedStudent.name} ({selectedStudent.email})
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">수업 날짜</label>
                  <input
                    type="date"
                    required
                    value={evalDate}
                    onChange={(e) => setEvalDate(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">출결 상태</label>
                  <select
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-semibold"
                  >
                    <option value="ATTEND">✅ 출석</option>
                    <option value="LATE">⏰ 지각</option>
                    <option value="ABSENT">❌ 결석</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">일일 테스트 점수</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="점수"
                      value={testScore}
                      onChange={(e) => setTestScore(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                    />
                    <span className="text-xs text-slate-400 font-bold">/</span>
                    <input
                      type="number"
                      value={testMaxScore}
                      onChange={(e) => setTestMaxScore(e.target.value)}
                      className="w-20 p-2.5 border rounded-xl text-sm bg-slate-50 text-center font-bold text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">수업 태도</label>
                  <select
                    value={attitude}
                    onChange={(e) => setAttitude(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-semibold"
                  >
                    <option value="EXCELLENT">🌟 매우 우수</option>
                    <option value="GOOD">👍 양호</option>
                    <option value="NEED_IMPROVEMENT">⚠️ 노력 필요</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">과제 이행도</label>
                  <select
                    value={homeworkStatus}
                    onChange={(e) => setHomeworkStatus(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-semibold"
                  >
                    <option value="COMPLETE">💯 완료</option>
                    <option value="INCOMPLETE">🔺 미흡/부분 완료</option>
                    <option value="NONE">❌ 안함</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">선생님 한줄 코멘트 / 피드백</label>
                <textarea
                  required
                  placeholder="오늘 수업에서 잘했던 점이나 보완할 점을 간단히 적어주세요."
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
                {loading ? '등록 중...' : '학습 피드백 저장하기'}
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