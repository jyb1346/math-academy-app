'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function EvalHistoryPage() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);

  // 필터 상태
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');
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
      // 1. 학생 목록
      let stQuery = supabase.from('users').select('id, name, email').eq('role', 'STUDENT');
      if (currentUser.role !== 'HEAD_TEACHER') {
        stQuery = stQuery.eq('teacher_id', currentUser.id);
      }
      const { data: stData } = await stQuery;
      setStudents(stData || []);

      // 2. 반 및 반-학생
      let cQuery = supabase.from('classes').select('*');
      if (currentUser.role !== 'HEAD_TEACHER') {
        cQuery = cQuery.eq('teacher_id', currentUser.id);
      }
      const { data: cData } = await cQuery;
      setClasses(cData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      // 3. 피드백 이력 가져오기
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

  // 피드백 삭제
  const handleDeleteEval = async (id, studentName, evalDate) => {
    if (!confirm(`[${studentName}] 학생의 ${evalDate} 피드백을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase.from('daily_evaluations').delete().eq('id', id);
      if (error) throw error;
      alert('성공적으로 삭제되었습니다.');
      fetchData(user);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 반/학생 필터링
  const filteredEvals = evaluations.filter((item) => {
    // 1. 학생 직접 선택 필터
    if (selectedStudentId !== 'ALL' && item.student_id !== selectedStudentId) {
      return false;
    }
    // 2. 반 선택 필터
    if (selectedClassId !== 'ALL') {
      const inClass = classStudents.some(
        (cs) => cs.class_id === parseInt(selectedClassId) && cs.student_id === item.student_id
      );
      if (!inClass) return false;
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
                <span>📋</span> 작성된 일일 학습 피드백 조회 ({filteredEvals.length}건)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">학생별로 작성된 일일 피드백 및 학부모 답장을 확인합니다.</p>
            </div>
            <button
              onClick={() => router.push('/teacher/eval')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + 새 피드백 작성하기
            </button>
          </div>

          {/* 필터 영역 (반 / 학생 선택) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">🏫 반별 필터</label>
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
              <label className="block text-xs font-bold text-slate-600 mb-1">👤 학생별 필터</label>
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
          </div>

          {/* 피드백 리스트 */}
          <div className="space-y-4">
            {filteredEvals.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">조회된 학습 피드백이 없습니다.</p>
            ) : (
              filteredEvals.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  
                  {/* 상단 프로필 및 날짜 */}
                  <div className="flex justify-between items-center border-b pb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-800">{item.users?.name} 학생</span>
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
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

                  {/* 6대 역량 점수 요약 바 */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl text-center text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold">개념 이해</span>
                      <span className="font-black text-blue-600 text-sm">{item.concept_score || 0}점</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold">연산 정확</span>
                      <span className="font-black text-blue-600 text-sm">{item.calc_score || 0}점</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold">응용 해결</span>
                      <span className="font-black text-blue-600 text-sm">{item.app_score || 0}점</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold">수업 집중</span>
                      <span className="font-black text-blue-600 text-sm">{item.attitude_score || 0}점</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold">과제 이행</span>
                      <span className="font-black text-blue-600 text-sm">{item.homework_score || 0}점</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold">오답/끈기</span>
                      <span className="font-black text-blue-600 text-sm">{item.perseverance_score || 0}점</span>
                    </div>
                  </div>

                  {/* 총평 코멘트 */}
                  <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-1">
                    <span className="text-[11px] font-bold text-blue-800">✍️ 선생님 코멘트</span>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap font-medium">{item.teacher_comment}</p>
                  </div>

                  {/* 학부모 수신 답장 (있을 경우) */}
                  {item.parent_reply && (
                    <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-bold text-emerald-800">
                        <span>💌 학부모님 수신 답장</span>
                        <span className="text-emerald-600 text-[10px]">
                          {item.parent_reply_at ? new Date(item.parent_reply_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-bold">"{item.parent_reply}"</p>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

        </div>
      </main>
    </div>
  );
}