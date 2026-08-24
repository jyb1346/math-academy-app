'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [allTeachers, setAllTeachers] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 신규 반 생성 폼
  const [newClassName, setNewClassName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // 🎯 학생 반 일괄 배정 모달
  const [assignTargetClass, setAssignTargetClass] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // 신규 강사 계정 생성 폼
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'HEAD_TEACHER') {
        alert('원장님 전용 관리 페이지입니다.');
        router.push('/teacher/dashboard');
        return;
      }
      setUser(parsedUser);
      fetchAdminData(parsedUser.id);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const fetchAdminData = async (headTeacherId) => {
    try {
      // 1. 전체 강사 목록 조회
      const { data: tData } = await supabase
        .from('users')
        .select('*')
        .in('role', ['TEACHER', 'HEAD_TEACHER']);
      const teachers = tData || [];
      setAllTeachers(teachers);

      if (teachers.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(headTeacherId);
      }

      // 2. 전체 반 목록 조회 (선생님 정보 포함)
      const { data: cData } = await supabase
        .from('classes')
        .select('*, users!classes_teacher_id_fkey(name)');
      setAllClasses(cData || []);

      // 3. 전체 학생 목록 조회
      const { data: stData } = await supabase
        .from('users')
        .select('*, users!users_teacher_id_fkey(name)')
        .eq('role', 'STUDENT');
      setAllStudents(stData || []);

      // 4. 반-학생 배정 현황 조회
      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 신규 강사 계정 생성
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherEmail.trim()) {
      return alert('강사 이름과 이메일/아이디를 입력해 주세요.');
    }

    try {
      const payload = {
        name: teacherName.trim(),
        email: teacherEmail.trim(),
        password: '1234',
        role: 'TEACHER',
      };

      const { error } = await supabase.from('users').insert([payload]);
      if (error) throw error;

      alert(`[${teacherName}] 선생님 계정이 생성되었습니다.`);
      setTeacherName('');
      setTeacherEmail('');
      fetchAdminData(user.id);
    } catch (err) {
      alert(`강사 계정 생성 실패: ${err.message}`);
    }
  };

  // 🗑️ 강사 계정 삭제 기능
  const handleDeleteTeacher = async (teacherId, teacherName, teacherRole) => {
    if (teacherId === user.id || teacherRole === 'HEAD_TEACHER') {
      return alert('원장님 본인 계정은 삭제할 수 없습니다.');
    }

    if (!confirm(`[${teacherName}] 선생님 계정을 삭제하시겠습니까?\n해당 선생님이 담당하던 반과 학생 설정이 해제될 수 있습니다.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('users').delete().eq('id', teacherId);
      if (error) throw error;

      alert(`[${teacherName}] 선생님 계정이 삭제되었습니다.`);
      fetchAdminData(user.id);
    } catch (err) {
      alert(`강사 삭제 실패: ${err.message}`);
    }
  };

  // 반 개설
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return alert('반 이름을 입력해 주세요.');

    try {
      const { error } = await supabase.from('classes').insert([
        {
          name: newClassName.trim(),
          teacher_id: selectedTeacherId || user.id,
        },
      ]);
      if (error) throw error;

      alert(`[${newClassName}] 반이 성공적으로 개설되었습니다.`);
      setNewClassName('');
      fetchAdminData(user.id);
    } catch (err) {
      alert(`반 개설 실패: ${err.message}`);
    }
  };

  // 반 삭제
  const handleDeleteClass = async (classId, className) => {
    if (!confirm(`[${className}] 반을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      fetchAdminData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 학생 반 일괄 배정 모달 오픈
  const openClassAssignModal = (cls) => {
    setAssignTargetClass(cls);
    const currentStudentIds = classStudents
      .filter((cs) => cs.class_id === cls.id)
      .map((cs) => cs.student_id);

    setSelectedStudentIds(currentStudentIds);
  };

  const toggleStudentSelection = (stId) => {
    if (selectedStudentIds.includes(stId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== stId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, stId]);
    }
  };

  const handleSaveBatchClassAssign = async () => {
    if (!assignTargetClass) return;

    try {
      await supabase
        .from('class_students')
        .delete()
        .eq('class_id', assignTargetClass.id);

      if (selectedStudentIds.length > 0) {
        const insertPayloads = selectedStudentIds.map((stId) => ({
          student_id: stId,
          class_id: assignTargetClass.id,
        }));

        const { error } = await supabase.from('class_students').insert(insertPayloads);
        if (error) throw error;
      }

      alert(`[${assignTargetClass.name}] 반에 ${selectedStudentIds.length}명의 학생 배정이 완료되었습니다.`);
      setAssignTargetClass(null);
      fetchAdminData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
      원장님 전용 대시보드 로딩 중...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100/80 pb-20 font-sans text-slate-800">
      
      {/* 👑 원장님 전용 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-amber-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              품수학 원장님 통합 교무실
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2 py-0.5 rounded-md text-[10px]">
                👑 원장님 관리자 뷰
              </span>
              <span>{user?.name} 원장님 환영합니다.</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/teacher/dashboard')}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3.5 py-2 rounded-xl transition border border-indigo-200"
          >
            📘 내 수업 대시보드로 이동
          </button>
          <button
            onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">

        {/* 📊 학원 전체 현황 요약 카운트 */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">👨‍🏫 학원 전체 강사 수</span>
              <span className="text-2xl font-black text-slate-800">{allTeachers.length}명</span>
            </div>
            <span className="text-2xl p-3 bg-amber-50 text-amber-600 rounded-2xl">👑</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">🏫 학원 전체 개설 반</span>
              <span className="text-2xl font-black text-slate-800">{allClasses.length}개 반</span>
            </div>
            <span className="text-2xl p-3 bg-indigo-50 text-indigo-600 rounded-2xl">📘</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">🎓 학원 전체 원생 수</span>
              <span className="text-2xl font-black text-slate-800">{allStudents.length}명</span>
            </div>
            <span className="text-2xl p-3 bg-blue-50 text-blue-600 rounded-2xl">👥</span>
          </div>
        </section>

        {/* 👑 1. 강사 계정 추가 및 삭제 관리 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>👨‍🏫</span> 학원 강사 계정 생성 및 삭제 관리
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">신규 선생님 계정을 생성하거나 기존 강사 계정을 삭제합니다. (초기 비밀번호: 1234)</p>
            </div>
            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">
              총 {allTeachers.length}명
            </span>
          </div>

          <form onSubmit={handleCreateTeacher} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="선생님 이름 (예: 이선생)"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800"
            />
            <input
              type="text"
              placeholder="아이디/이메일 (예: teacher2@test.com)"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800"
            />
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-2xl text-xs shadow-sm transition"
            >
              + 선생님 계정 생성
            </button>
          </form>

          {/* 강사 태그 리스트 & 삭제 버튼 */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            {allTeachers.map((t) => (
              <div
                key={t.id}
                className="bg-slate-50 border border-slate-200/90 pl-3.5 pr-2.5 py-2 rounded-2xl text-xs font-bold text-slate-700 flex items-center gap-2.5 shadow-2xs"
              >
                <span>{t.role === 'HEAD_TEACHER' ? '👑' : '📘'} {t.name}</span>
                <span className="text-slate-400 font-normal">({t.email})</span>

                {t.role !== 'HEAD_TEACHER' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(t.id, t.name, t.role)}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-bold text-[11px] px-1.5 py-0.5 rounded-lg transition"
                    title="강사 계정 삭제"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 🏫 2. 학원 전체 반 관리 및 담당 강사 지정 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>🏫</span> 학원 전체 반 관리 및 강사 배정
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">반을 개설하고 담당 강사를 지정해 원생들을 일괄 배정하세요.</p>
            </div>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">
              총 {allClasses.length}개 반
            </span>
          </div>

          <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="신규 반 이름 입력 (예: 고1 정시반)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800"
            />
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700"
            >
              {allTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  👨‍🏫 담당: {t.name} 선생님
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-sm transition whitespace-nowrap"
            >
              + 반 개설
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {allClasses.map((cls) => {
              const count = classStudents.filter((cs) => cs.class_id === cls.id).length;

              return (
                <div
                  key={cls.id}
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between space-y-3 transition"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-extrabold text-slate-800 block">📘 {cls.name}</span>
                      <span className="text-[10px] text-indigo-600 font-bold">담당: {cls.users?.name || '미지정'}T</span>
                    </div>
                    <button
                      onClick={() => handleDeleteClass(cls.id, cls.name)}
                      className="text-xs text-rose-500 font-bold hover:underline"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-bold">소속 원생: <span className="text-indigo-600 font-extrabold">{count}명</span></span>
                    
                    <button
                      onClick={() => openClassAssignModal(cls)}
                      className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-xs"
                    >
                      + 원생 지정 배정
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* 🎯 모달: 원생 지정 일괄 배정 */}
      {assignTargetClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  📘 [{assignTargetClass.name}] 반 원생 일괄 배정
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">배정할 원생들을 선택해 주세요.</p>
              </div>
              <button onClick={() => setAssignTargetClass(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {allStudents.map((st) => {
                const isChecked = selectedStudentIds.includes(st.id);
                return (
                  <label
                    key={st.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      isChecked ? 'bg-indigo-50/80 border-indigo-300' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStudentSelection(st.id)}
                        className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{st.name}</span>
                        <span className="text-[10px] text-slate-400">담당: {st.users?.name || '미지정'}T</span>
                      </div>
                    </div>

                    {isChecked && (
                      <span className="text-xs font-bold text-indigo-600">선택됨 ✓</span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl text-xs font-bold">
              <span className="text-slate-600">선택된 원생:</span>
              <span className="text-indigo-600 font-extrabold">{selectedStudentIds.length}명</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignTargetClass(null)}
                className="w-1/2 bg-slate-100 text-slate-600 py-3 rounded-2xl text-xs font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveBatchClassAssign}
                className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-bold shadow-md transition"
              >
                배정 완료 저장
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}