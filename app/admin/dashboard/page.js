'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/useSession';

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

  // 🔍 원생 검색, 강사 필터, 수정 모달 상태
  const [studentSearch, setStudentSearch] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('ALL');
  const [editingStudent, setEditingStudent] = useState(null);

  // 🎯 반 원생 배정 모달 내 실시간 검색 및 필터 상태
  const [assignModalSearch, setAssignModalSearch] = useState('');
  const [assignModalTeacherFilter, setAssignModalTeacherFilter] = useState('ALL');
  const [onlySelectedInModal, setOnlySelectedInModal] = useState(false);

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
      const res = await fetch('/api/admin/data');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '조회 실패');

      const teachers = data.teachers || [];
      setAllTeachers(teachers);

      if (teachers.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(headTeacherId || teachers[0]?.id || '');
      }

      setAllClasses(data.classes || []);
      setAllStudents(data.students || []);
      setClassStudents(data.classStudents || []);
    } catch (err) {
      console.error('Admin Fetch Error:', err);
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
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teacherName.trim(), email: teacherEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');

      alert(`[${teacherName}] 선생님 계정이 생성되었습니다.`);
      setTeacherName('');
      setTeacherEmail('');
      fetchAdminData(user.id);
    } catch (err) {
      alert(`강사 계정 생성 실패: ${err.message}`);
    }
  };

  // 강사 계정 삭제 기능
  const handleDeleteTeacher = async (teacherId, teacherName, teacherRole) => {
    if (teacherId === user.id || teacherRole === 'HEAD_TEACHER') {
      return alert('원장님 본인 계정은 삭제할 수 없습니다.');
    }

    if (!confirm(`[${teacherName}] 선생님 계정을 삭제하시겠습니까?\n해당 선생님이 담당하던 반과 학생 설정이 해제될 수 있습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');

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
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim(), teacherId: selectedTeacherId || user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '개설 실패');

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
      const res = await fetch(`/api/admin/classes/${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');
      fetchAdminData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 학생 반 일괄 배정 모달 오픈
  const openClassAssignModal = (cls) => {
    setAssignTargetClass(cls);
    setAssignModalSearch('');
    setAssignModalTeacherFilter('ALL');
    setOnlySelectedInModal(false);
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
      const res = await fetch('/api/admin/class-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: assignTargetClass.id, studentIds: selectedStudentIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배정 실패');

      alert(`[${assignTargetClass.name}] 반에 ${selectedStudentIds.length}명의 학생 배정이 완료되었습니다.`);
      setAssignTargetClass(null);
      fetchAdminData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  // 👨‍🏫 원생 담당 선생님 원클릭 즉시 변경
  const handleQuickChangeTeacher = async (studentId, newTeacherId) => {
    try {
      const res = await fetch(`/api/admin/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: newTeacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '변경 실패');

      const teacherObj = allTeachers.find((t) => t.id === newTeacherId);
      alert(`담당 선생님이 [${teacherObj?.name || '선생님'}]으로 변경되었습니다.`);
      fetchAdminData(user.id);
    } catch (err) {
      alert(`담당 선생님 변경 실패: ${err.message}`);
    }
  };

  // ✏️ 원생 상세 정보 수정
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const res = await fetch(`/api/admin/students/${editingStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingStudent.name,
          email: editingStudent.email,
          parentPhone: editingStudent.parent_phone,
          teacherId: editingStudent.teacher_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '수정 실패');

      alert('원생 정보가 수정되었습니다.');
      setEditingStudent(null);
      fetchAdminData(user.id);
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  // 🗑️ 원생 삭제
  const handleDeleteStudent = async (studentId, studentName) => {
    if (!confirm(`[${studentName}] 원생을 학원에서 삭제하시겠습니까?\n삭제 시 반 배정 및 로그인 정보가 영구 제거됩니다.`)) return;
    try {
      const res = await fetch(`/api/admin/students/${studentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');

      alert(`[${studentName}] 원생이 삭제되었습니다.`);
      fetchAdminData(user.id);
    } catch (err) {
      alert(`원생 삭제 실패: ${err.message}`);
    }
  };

  const filteredStudents = allStudents.filter((st) => {
    const matchSearch = !studentSearch.trim() || 
      (st.name || '').toLowerCase().includes(studentSearch.toLowerCase()) || 
      (st.email || '').toLowerCase().includes(studentSearch.toLowerCase());
    const matchTeacher = filterTeacher === 'ALL' || st.teacher_id === filterTeacher;
    return matchSearch && matchTeacher;
  });

  const modalFilteredStudents = allStudents.filter((st) => {
    const matchSearch =
      !assignModalSearch.trim() ||
      (st.name || '').toLowerCase().includes(assignModalSearch.toLowerCase()) ||
      (st.email || '').toLowerCase().includes(assignModalSearch.toLowerCase());
    const matchTeacher =
      assignModalTeacherFilter === 'ALL' || st.teacher_id === assignModalTeacherFilter;
    const matchSelected = !onlySelectedInModal || selectedStudentIds.includes(st.id);
    return matchSearch && matchTeacher && matchSelected;
  });

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
            onClick={async () => { await logout(); router.push('/login'); }}
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
              const teacherObj = allTeachers.find((t) => t.id === cls.teacher_id);

              return (
                <div
                  key={cls.id}
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between space-y-3 transition"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-extrabold text-slate-800 block">📘 {cls.name}</span>
                      <span className="text-[10px] text-indigo-600 font-bold">담당: {teacherObj?.name || '미지정'}T</span>
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

        {/* 🎓 3. 학원 전체 원생 관리 & 직속 담당 강사 지정 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>🎓</span> 학원 전체 원생 관리 & 담당 선생님 배정
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                원생별 직속 담당 선생님(Q&A 및 전담)을 변경하거나 원생 정보를 수정·삭제합니다.
              </p>
            </div>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100 self-start sm:self-auto">
              총 {allStudents.length}명 원생
            </span>
          </div>

          {/* 검색 및 필터 바 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="🔍 학생 이름 또는 아이디로 검색..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">👨‍🏫 전체 담당 선생님 보기</option>
              {allTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.role === 'HEAD_TEACHER' ? '👑' : '👨‍🏫'} {t.name} 선생님 담당
                </option>
              ))}
            </select>
          </div>

          {/* 원생 리스트 */}
          <div className="space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-bold">
                검색 조건에 맞는 원생이 없습니다.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const studentEnrolledClassIds = classStudents
                  .filter((cs) => cs.student_id === st.id)
                  .map((cs) => String(cs.class_id));

                const assignedClasses = allClasses.filter((c) =>
                  studentEnrolledClassIds.includes(String(c.id))
                );
                const teacherObj = allTeachers.find((t) => t.id === st.teacher_id);

                return (
                  <div
                    key={st.id}
                    className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-800">{st.name}</span>
                        <span className="text-slate-400 text-xs font-semibold">({st.email})</span>
                        {st.parent_phone ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            📱 {st.parent_phone}
                          </span>
                        ) : (
                          <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                            연락처 미등록
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400 font-bold">소속 반:</span>
                          {assignedClasses.length > 0 ? (
                            assignedClasses.map((cls) => (
                              <span key={cls.id} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                                📘 {cls.name}
                              </span>
                            ))
                          ) : (
                            <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                              미배정
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-bold">직속 담당:</span>
                          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg font-extrabold text-[11px]">
                            {teacherObj?.role === 'HEAD_TEACHER' ? '👑' : '👨‍🏫'} {teacherObj?.name || '미지정'}T
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* 빠른 담당 선생님 변경 드롭다운 */}
                      <select
                        value={st.teacher_id || ''}
                        onChange={(e) => handleQuickChangeTeacher(st.id, e.target.value)}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                        title="직속 담당 선생님 변경"
                      >
                        <option value="" disabled>-- 담당 강사 선택 --</option>
                        {allTeachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.role === 'HEAD_TEACHER' ? '👑' : '👨‍🏫'} {t.name} 선생님
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setEditingStudent(st)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition whitespace-nowrap shadow-2xs"
                      >
                        ✏️ 수정
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(st.id, st.name)}
                        className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 text-xs transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>

      {/* 🎯 모달 1: 원생 지정 일괄 배정 */}
      {assignTargetClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  📘 [{assignTargetClass.name}] 반 원생 일괄 배정
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">배정할 원생들을 검색하거나 체크해 주세요.</p>
              </div>
              <button onClick={() => setAssignTargetClass(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>

            {/* 🔍 실시간 원생 검색 & 강사 필터 */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="🔍 학생 이름 또는 아이디로 검색..."
                    value={assignModalSearch}
                    onChange={(e) => setAssignModalSearch(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  {assignModalSearch && (
                    <button
                      type="button"
                      onClick={() => setAssignModalSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={assignModalTeacherFilter}
                  onChange={(e) => setAssignModalTeacherFilter(e.target.value)}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">전체 강사</option>
                  {allTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}T 담당
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 px-1">
                <button
                  type="button"
                  onClick={() => setOnlySelectedInModal(!onlySelectedInModal)}
                  className={`px-2 py-1 rounded-lg border transition ${
                    onlySelectedInModal
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {onlySelectedInModal ? '✓ 선택된 원생만 보기 중' : '선택된 원생만 모아보기'}
                </button>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = modalFilteredStudents.map((s) => s.id);
                      const merged = Array.from(new Set([...selectedStudentIds, ...visibleIds]));
                      setSelectedStudentIds(merged);
                    }}
                    className="text-indigo-600 hover:underline"
                  >
                    검색결과 전체선택
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = modalFilteredStudents.map((s) => s.id);
                      setSelectedStudentIds(selectedStudentIds.filter((id) => !visibleIds.includes(id)));
                    }}
                    className="text-slate-400 hover:underline"
                  >
                    검색결과 전체해제
                  </button>
                </div>
              </div>
            </div>

            {/* 원생 목록 리스트 */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {modalFilteredStudents.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-bold">
                  {assignModalSearch.trim() ? `'${assignModalSearch}' 검색 결과가 없습니다.` : '등록된 원생이 없습니다.'}
                </p>
              ) : (
                modalFilteredStudents.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  const teacherObj = allTeachers.find((t) => t.id === st.teacher_id);
                  const otherClasses = classStudents
                    .filter((cs) => cs.student_id === st.id && cs.class_id !== assignTargetClass.id)
                    .map((cs) => allClasses.find((c) => c.id === cs.class_id)?.name)
                    .filter(Boolean);

                  return (
                    <label
                      key={st.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                        isChecked ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs' : 'bg-slate-50 border-slate-200'
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-800">{st.name}</span>
                            <span className="text-[10px] text-slate-400">({st.email})</span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[10.5px]">
                            <span className="text-amber-800 font-bold">
                              담당: {teacherObj?.role === 'HEAD_TEACHER' ? '👑' : '👨‍🏫'} {teacherObj?.name || '미지정'}T
                            </span>
                            {otherClasses.length > 0 && (
                              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded text-[9.5px] font-semibold">
                                타반: {otherClasses.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isChecked && (
                        <span className="text-xs font-black text-indigo-600 whitespace-nowrap">
                          선택됨 ✓
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl text-xs font-bold border border-slate-200/60">
              <span className="text-slate-600">선택된 원생:</span>
              <span className="text-indigo-600 font-extrabold">{selectedStudentIds.length}명</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAssignTargetClass(null)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl text-xs font-bold transition"
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

      {/* ✏️ 모달 2: 원생 정보 및 담당 선생님 수정 */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-base font-extrabold text-slate-800">✏️ 원생 정보 및 담당 선생님 수정</h4>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">학생 이름</label>
                <input
                  type="text"
                  value={editingStudent.name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">아이디 / 이메일</label>
                <input
                  type="text"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">📱 학부모 연락처 (알림톡 수신용)</label>
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={editingStudent.parent_phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })}
                  className="w-full p-3 bg-amber-50/50 border border-amber-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">👨‍🏫 직속 담당 선생님 (Q&A 및 관리)</label>
                <select
                  value={editingStudent.teacher_id || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, teacher_id: e.target.value })}
                  className="w-full p-3 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {allTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.role === 'HEAD_TEACHER' ? '👑' : '👨‍🏫'} {t.name} 선생님
                    </option>
                  ))}
                </select>
                <p className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">
                  💡 담당 선생님을 변경하면 해당 선생님 교무실 및 1:1 Q&A 질문 수신자로 연동됩니다. (과거 작성된 평가/피드백/벌레 도감 데이터는 100% 보존됩니다)
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="w-1/2 bg-slate-100 text-slate-600 py-3 rounded-2xl text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-bold shadow-md transition"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}