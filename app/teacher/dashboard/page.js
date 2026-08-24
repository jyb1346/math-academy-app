'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 반 생성 폼 상태
  const [newClassName, setNewClassName] = useState('');

  // 개별 학생 신규 등록 폼 상태
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('1234');
  const [parentPhone, setParentPhone] = useState('');

  // 학생 수정 모달 상태
  const [editingStudent, setEditingStudent] = useState(null);

  // 🎯 일괄 학생 등록 모달 및 상태
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInputText, setBatchInputText] = useState('');

  // 학생-반 배정 선택 상태 (studentId -> classId)
  const [selectedClassMap, setSelectedClassMap] = useState({});

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'TEACHER' && parsedUser.role !== 'HEAD_TEACHER') {
        alert('선생님 권한이 필요합니다.');
        router.push('/');
        return;
      }
      setUser(parsedUser);
      fetchDashboardData(parsedUser.id);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const fetchDashboardData = async (teacherId) => {
    try {
      // 1. 내 담당 반 조회
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacherId);
      setClasses(cData || []);

      // 2. 내 담당 학생 조회
      const { data: stData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'STUDENT')
        .eq('teacher_id', teacherId);
      setStudents(stData || []);

      // 3. 반-학생 매핑 조회
      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 1️⃣ 반 생성
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return alert('반 이름을 입력해주세요.');

    try {
      const { error } = await supabase.from('classes').insert([
        { name: newClassName.trim(), teacher_id: user.id }
      ]);
      if (error) throw error;

      alert(`[${newClassName}] 반이 개설되었습니다.`);
      setNewClassName('');
      fetchDashboardData(user.id);
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
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 2️⃣ 개별 학생 등록
  const handleCreateSingleStudent = async (e) => {
    e.preventDefault();
    if (!studentName.trim() || !studentEmail.trim()) {
      return alert('학생 이름과 아이디/이메일을 입력해주세요.');
    }

    try {
      const payload = {
        name: studentName.trim(),
        email: studentEmail.trim(),
        password: studentPassword || '1234',
        role: 'STUDENT',
        teacher_id: user.id,
        parent_phone: parentPhone.replace(/[^0-9]/g, ''),
      };

      const { error } = await supabase.from('users').insert([payload]);
      if (error) throw error;

      alert(`[${studentName}] 학생이 등록되었습니다.`);
      setStudentName('');
      setStudentEmail('');
      setParentPhone('');
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`등록 실패: ${err.message}`);
    }
  };

  // 3️⃣ 🎯 일괄 학생 등록 (학부모 번호 파싱 포함)
  const handleBatchCreateStudents = async (e) => {
    e.preventDefault();
    if (!batchInputText.trim()) return alert('학생 명단을 입력해주세요.');

    const lines = batchInputText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return alert('유효한 학생 데이터가 없습니다.');

    try {
      const payloads = lines.map((line) => {
        // 이름과 학부모 연락처 분리 (쉼표나 공백, 탭 구분 허용)
        const parts = line.split(/[, \t]+/).filter(Boolean);
        const name = parts[0];
        const rawPhone = parts[1] || '';
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

        const randomNum = Math.floor(1000 + Math.random() * 9000);

        return {
          name,
          email: `${name.toLowerCase()}${randomNum}@poom.com`,
          password: '1234',
          role: 'STUDENT',
          teacher_id: user.id,
          parent_phone: cleanPhone,
        };
      });

      const { error } = await supabase.from('users').insert(payloads);
      if (error) throw error;

      alert(`${payloads.length}명의 학생 계정이 학부모 연락처와 함께 생성되었습니다.`);
      setBatchInputText('');
      setShowBatchModal(false);
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`일괄 생성 실패: ${err.message}`);
    }
  };

  // 4️⃣ 학생 정보 수정
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editingStudent.name,
          email: editingStudent.email,
          parent_phone: editingStudent.parent_phone ? editingStudent.parent_phone.replace(/[^0-9]/g, '') : '',
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      alert('학생 정보가 수정되었습니다.');
      setEditingStudent(null);
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (studentId, studentName) => {
    if (!confirm(`[${studentName}] 학생을 계정 목록에서 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', studentId);
      if (error) throw error;
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 5️⃣ 학생을 반에 배정/변경
  const handleAssignClass = async (studentId) => {
    const classId = selectedClassMap[studentId];
    if (!classId) return alert('배정할 반을 선택해 주세요.');

    try {
      await supabase.from('class_students').delete().eq('student_id', studentId);

      const { error } = await supabase.from('class_students').insert([
        { student_id: studentId, class_id: parseInt(classId) }
      ]);

      if (error) throw error;
      alert('반 배정이 완료되었습니다.');
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">
      품수학 교무실 로딩 중...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 font-sans">
      
      {/* 헤더 */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-white cursor-pointer leading-tight">
              품수학 학원 교무실
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">
              <span className="text-indigo-400 font-bold">{user?.name} 선생님</span> 대시보드
            </p>
          </div>
        </div>

        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="text-xs bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 font-bold px-3.5 py-2 rounded-xl transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">

        {/* 🎯 1. 메인 액션 카드의 비중 강화 (일일피드백 & 반별게시판) */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* 카드 A: 일일 학습 피드백 작성 */}
            <div
              onClick={() => router.push('/teacher/eval')}
              className="group relative bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-7 rounded-3xl shadow-xl shadow-indigo-950/30 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl border border-indigo-500/20"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start">
                <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white text-xs px-3.5 py-1 rounded-full font-bold">
                  ✍️ Daily Feedback
                </span>
                <span className="text-3xl text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-2xl font-black text-white">일일 학습 피드백 작성</h2>
                <p className="text-xs text-blue-100/80 font-normal leading-relaxed">
                  오늘 수업 성취도(6대 영역) 및 출결/지각 상태를 기록합니다.
                </p>
              </div>
            </div>

            {/* 카드 B: 반별 게시판 관리 (일일 피드백과 대등한 비중) */}
            <div
              onClick={() => router.push('/board')}
              className="group relative bg-gradient-to-br from-slate-800 via-slate-800 to-indigo-950/80 border border-indigo-500/40 p-7 rounded-3xl shadow-xl cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-3.5 py-1 rounded-full font-bold">
                  📢 Notice Board
                </span>
                <span className="text-3xl text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-2xl font-black text-white">반별 공지 및 숙제 게시판</h2>
                <p className="text-xs text-slate-300 font-normal leading-relaxed">
                  숙제 알림 등록 및 학생들의 공지 확인 여부를 체크합니다.
                </p>
              </div>
            </div>

          </div>

          {/* 서브 링크: 피드백 리포트 내역 */}
          <div className="flex justify-end">
            <button
              onClick={() => router.push('/teacher/eval/history')}
              className="text-xs bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-4 py-2.5 rounded-2xl font-bold transition flex items-center gap-2"
            >
              <span>📋 작성된 일일 피드백 리포트 내역 및 학부모 답장 보기</span>
              <span>→</span>
            </button>
          </div>
        </section>

        {/* 🏫 반 개설 및 목록 관리 */}
        <section className="bg-slate-800/60 border border-slate-700/70 p-6 rounded-3xl space-y-5 shadow-lg backdrop-blur-xs">
          <div className="flex justify-between items-center border-b border-slate-700/60 pb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-base font-bold">🏫</span>
              <div>
                <h2 className="text-base font-extrabold text-white">내 개설 반 관리</h2>
                <p className="text-xs text-slate-400">현재 담당하고 있는 반 목록입니다.</p>
              </div>
            </div>
            <span className="bg-slate-700/80 text-slate-300 text-xs font-bold px-3 py-1 rounded-full border border-slate-600">
              총 {classes.length}개 반
            </span>
          </div>

          <form onSubmit={handleCreateClass} className="flex gap-2">
            <input
              type="text"
              placeholder="신규 반 이름 (예: 중3 심화A반)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1 p-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-md shadow-indigo-600/20 transition whitespace-nowrap"
            >
              + 반 개설
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-1">
            {classes.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium py-2">개설된 반이 없습니다. 반을 추가해 주세요.</p>
            ) : (
              classes.map((cls) => (
                <div key={cls.id} className="bg-slate-900/80 border border-indigo-500/30 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-xs">
                  <span className="text-xs font-extrabold text-indigo-300">📘 {cls.name}</span>
                  <button
                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold hover:bg-rose-950/50 w-5 h-5 rounded-full flex items-center justify-center transition"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 🎯 2. 컴팩트 학생 추가 & 일괄 등록 모달 버튼 */}
        <section className="bg-slate-800/60 border border-slate-700/70 p-6 rounded-3xl space-y-5 shadow-lg backdrop-blur-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700/60 pb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl text-base font-bold">👤</span>
              <div>
                <h2 className="text-base font-extrabold text-white">신규 학생 등록</h2>
                <p className="text-xs text-slate-400">학생 추가 및 일괄 명단 등록을 수행합니다.</p>
              </div>
            </div>

            {/* ⚡ 일괄 등록 전용 모달 오픈 버튼 */}
            <button
              onClick={() => setShowBatchModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/30 font-bold px-4 py-2.5 rounded-2xl text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <span>⚡ 학부모 번호 포함 일괄 등록 모달</span>
            </button>
          </div>

          <form onSubmit={handleCreateSingleStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">학생 이름</label>
              <input
                type="text"
                placeholder="홍길동"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">아이디 / 이메일</label>
              <input
                type="text"
                placeholder="hong123"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-400 mb-1">📱 학부모 연락처</label>
              <input
                type="tel"
                placeholder="010-1234-5678"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20"
              >
                + 학생 등록
              </button>
            </div>
          </form>
        </section>

        {/* 👥 담당 학생 목록 및 반 배정 */}
        <section className="bg-slate-800/60 border border-slate-700/70 p-6 rounded-3xl space-y-5 shadow-lg backdrop-blur-xs">
          <div className="flex justify-between items-center border-b border-slate-700/60 pb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-base font-bold">👥</span>
              <div>
                <h2 className="text-base font-extrabold text-white">담당 학생 목록 및 반 배정</h2>
                <p className="text-xs text-slate-400">학생 정보 수정 및 소속 반을 배정합니다.</p>
              </div>
            </div>
            <span className="bg-slate-700/80 text-slate-300 text-xs font-bold px-3 py-1 rounded-full border border-slate-600">
              총 {students.length}명
            </span>
          </div>

          <div className="space-y-3">
            {students.length === 0 ? (
              <p className="text-center py-12 text-slate-500 text-xs font-bold">등록된 학생이 없습니다.</p>
            ) : (
              students.map((st) => {
                const assignedClassInfo = classStudents.find((cs) => cs.student_id === st.id);
                const assignedClass = classes.find((c) => c.id === assignedClassInfo?.class_id);

                return (
                  <div
                    key={st.id}
                    className="bg-slate-900/80 border border-slate-700/70 p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-slate-600"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white">{st.name}</span>
                        <span className="text-slate-400 text-xs font-semibold">({st.email})</span>
                        
                        {st.parent_phone ? (
                          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
                            📱 학부모: {st.parent_phone}
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-500 border border-slate-700 px-2 py-0.5 rounded-lg font-semibold text-[10px]">
                            연락처 미등록
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-bold">소속 반:</span>
                        {assignedClass ? (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                            📘 {assignedClass.name}
                          </span>
                        ) : (
                          <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                            미배정
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedClassMap[st.id] || (assignedClass ? assignedClass.id.toString() : '')}
                        onChange={(e) => setSelectedClassMap({ ...selectedClassMap, [st.id]: e.target.value })}
                        className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:outline-none"
                      >
                        <option value="">-- 반 선택 --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssignClass(st.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition whitespace-nowrap shadow-xs"
                      >
                        배정
                      </button>

                      <button
                        onClick={() => setEditingStudent(st)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs transition whitespace-nowrap"
                      >
                        수정
                      </button>

                      <button
                        onClick={() => handleDeleteStudent(st.id, st.name)}
                        className="text-rose-400 hover:text-rose-300 font-bold px-2 text-xs"
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

      {/* 🎯 [모달 1] 학부모 연락처 포함 일괄 등록 모달 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-lg space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>⚡</span> 학생 명단 일괄 등록 (학부모 번호 포함)
              </h4>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-500 hover:text-white font-bold text-xs">✕</button>
            </div>

            <form onSubmit={handleBatchCreateStudents} className="space-y-4">
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80 text-xs text-slate-300 space-y-1">
                <p className="font-bold text-amber-300">💡 입력 형식 안내 (한 줄에 한 명씩):</p>
                <p>• <span className="font-bold text-white">홍길동, 01012345678</span> (이름, 전화번호)</p>
                <p>• <span className="font-bold text-white">김철수 010-9876-5432</span> (띄어쓰기 구분도 가능)</p>
                <p>• <span className="font-bold text-white">이영희</span> (전화번호 생략 가능)</p>
              </div>

              <textarea
                placeholder="홍길동, 010-1234-5678&#10;김철수, 010-9876-5432&#10;이영희"
                value={batchInputText}
                onChange={(e) => setBatchInputText(e.target.value)}
                className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs h-40 font-medium text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition leading-relaxed"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="w-1/2 bg-slate-800 text-slate-400 py-3 rounded-2xl text-xs font-bold border border-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  일괄 등록 실행
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ [모달 2] 학생 정보 수정 모달 */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-extrabold text-white">✏️ 학생 정보 수정</h4>
            
            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">학생 이름</label>
                <input
                  type="text"
                  value={editingStudent.name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">아이디 / 이메일</label>
                <input
                  type="text"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-400 mb-1">📱 학부모 연락처 (알림톡 수신용)</label>
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={editingStudent.parent_phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })}
                  className="w-full p-3 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-xs font-semibold text-amber-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="w-1/2 bg-slate-800 text-slate-400 py-3 rounded-2xl text-xs font-bold border border-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl text-xs font-bold shadow-md shadow-blue-600/20"
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