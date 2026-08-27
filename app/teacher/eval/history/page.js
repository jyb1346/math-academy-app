'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import HexagonRadarChart from '@/components/HexagonRadarChart';

export default function EvalHistoryPage() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
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
      const { data: stData } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'STUDENT')
        .eq('teacher_id', currentUser.id);
      setStudents(stData || []);

      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', currentUser.id);
      setClasses(cData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      const { data: evalData, error } = await supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name, email)')
        .eq('teacher_id', currentUser.id)
        .order('eval_date', { ascending: false });

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

  const getTwoWeekAvgScores = (studentId, currentEvalDate) => {
    if (!currentEvalDate) return null;

    const targetDate = new Date(currentEvalDate);
    const twoWeeksAgo = new Date(targetDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const studentTwoWeekEvals = evaluations.filter((e) => {
      if (e.student_id !== studentId) return false;
      const evalDateObj = new Date(e.eval_date);
      return evalDateObj >= twoWeeksAgo && evalDateObj <= targetDate;
    });

    if (studentTwoWeekEvals.length === 0) return null;

    const total = studentTwoWeekEvals.reduce(
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

    const count = studentTwoWeekEvals.length;
    return {
      concept: Number((total.concept / count).toFixed(1)),
      calc: Number((total.calc / count).toFixed(1)),
      app: Number((total.app / count).toFixed(1)),
      attitude: Number((total.attitude / count).toFixed(1)),
      homework: Number((total.homework / count).toFixed(1)),
      perseverance: Number((total.perseverance / count).toFixed(1)),
    };
  };

  // 🎯 문구 수정: ~분 이내 지각
  const renderAttendanceBadge = (status, latenessMins) => {
    if (status === 'LATE') {
      const minsText = latenessMins >= 30 ? '30분 이상 지각' : `${latenessMins || 5}분 이내 지각`;
      return (
        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full">
          ⏰ {minsText}
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
                <span>🔷</span> 내 작성 피드백 리포트 ({filteredEvals.length}건)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{user.name} 선생님이 작성하신 학습 피드백 전체 기록입니다.</p>
            </div>
            <button
              onClick={() => router.push('/teacher/eval')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + 새 피드백 작성
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">🏫 내 반 선택</label>
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

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">👤 내 담당 학생 선택</label>
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

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-600">📅 날짜 지정</label>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="text-[10px] text-rose-500 font-bold hover:underline"
                  >
                    초기화 ✕
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

          <div className="space-y-6">
            {filteredEvals.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">작성하신 학습 피드백 내역이 없습니다.</p>
            ) : (
              filteredEvals.map((item) => {
                const twoWeekAvgScores = getTwoWeekAvgScores(item.student_id, item.eval_date);

                return (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    
                    <div className="flex justify-between items-center border-b pb-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-slate-800">{item.users?.name} 학생</span>
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold border border-blue-200">
                          📅 수업일: {item.eval_date}
                        </span>
                        
                        {renderAttendanceBadge(item.attendance_status, item.lateness_minutes)}
                      </div>
                      <button
                        onClick={() => handleDeleteEval(item.id, item.users?.name, item.eval_date)}
                        className="text-rose-500 hover:underline font-bold"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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
                          twoWeekAvgScores={twoWeekAvgScores}
                        />
                      </div>

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