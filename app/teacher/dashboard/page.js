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
  const [parentPhone, setParentPhone] = useState(''); // 🎯 학부모 연락처 추가

  // 학생 수정 모달 상태
  const [editingStudent, setEditingStudent] = useState(null);

  // 일괄 학생 생성 폼 상태
  const [batchNames, setBatchNames] = useState('');

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

  // 2️⃣ 개별 학생 등록 (학부모 연락처 포함)
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
        parent_phone: parentPhone.replace(/[^0-9]/g, ''), // 🎯 숫지만 저장
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

  // 3️⃣ 일괄 학생 생성 (이름 목록 입력 시 아이디/비밀번호 자동생성)
  const handleBatchCreateStudents = async (e) => {
    e.preventDefault();
    if (!batchNames.trim()) return alert('학생 이름들을 입력해주세요.');

    const nameList = batchNames
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (nameList.length === 0) return alert('유효한 학생 이름이 없습니다.');

    try {
      const payloads = nameList.map((name) => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return {
          name,
          email: `${name.toLowerCase()}${randomNum}@poom.com`,
          password: '1234',
          role: 'STUDENT',
          teacher_id: user.id,
        };
      });

      const { error } = await supabase.from('users').insert(payloads);
      if (error) throw error;

      alert(`${nameList.length}명의 학생 계정이 일괄 생성되었습니다.`);
      setBatchNames('');
      fetchDashboardData(user.id);
    } catch (err) {
      alert(`일괄 생성 실패: ${err.message}`);
    }
  };

  // 4️⃣ 학생 정보 수정 (학부모 연락처 포함)
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
      // 기존 배정 삭제 후 재등록
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

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* 헤더 */}
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h1 onClick={() => router.push('/')} className="text-xl font-bold text-blue-600 cursor-pointer">
            품수학 학원 교무실
          </h1>
          <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
            {user?.name} 선생님
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/board')}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-2 rounded-xl transition"
          >
            📢 게시판 관리
          </button>
          <button
            onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-2 rounded-xl transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">

        {/* 상단 퀵 메뉴 버튼 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/teacher/eval')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-2xl font-bold text-left shadow-md hover:shadow-lg transition flex justify-between items-center group"
          >
            <div>
              <span className="text-xs text-blue-200 block mb-1">📝 Daily Feedback</span>
              <span className="text-lg font-black block">일일 학습 피드백 작성하기</span>
              <span className="text-xs text-blue-100 font-normal">학생별 6대 성취도 및 출결/지각 기록</span>
            </div>
            <span className="text-2xl group-hover:translate-x-1 transition">→</span>
          </button>

          <button
            onClick={() => router.push('/teacher/eval/history')}
            className="bg-white border border-slate-200 p-5 rounded-2xl font-bold text-left shadow-sm hover:shadow-md transition flex justify-between items-center group"
          >
            <div>
              <span className="text-xs text-indigo-600 block mb-1">📋 Feedback Report</span>
              <span className="text-lg font-black text-slate-800 block">피드백 리포트 내역 조회</span>
              <span className="text-xs text-slate-400 font-normal">작성한 일일 피드백 및 학부모 답장 확인</span>
            </div>
            <span className="text-2xl text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition">→</span>
          </button>
        </section>

        {/* 1. 반 개설 및 반 목록 */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>🏫</span> 내 담당 반 관리 ({classes.length}개 반)
          </h2>

          <form onSubmit={handleCreateClass} className="flex gap-2">
            <input
              type="text"
              placeholder="신규 반 이름 입력 (예: 중3 심화A반)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1 p-2.5 border rounded-xl text-xs font-semibold"
            />
            <button
              type="submit"
              className="bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow hover:bg-slate-800 transition whitespace-nowrap"
            >
              + 반 개설
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {classes.length === 0 ? (
              <p className="text-xs text-slate-400">개설된 반이 없습니다. 반을 개설해 주세요.</p>
            ) : (
              classes.map((cls) => (
                <div key={cls.id} className="bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-xl flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-900">📘 {cls.name}</span>
                  <button
                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                    className="text-xs text-rose-500 font-bold hover:underline"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 2. 개별 학생 등록 & 일괄 학생 등록 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 개별 등록 (학부모 연락처 포함) */}
          <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>👤</span> 개별 학생 신규 등록
            </h2>

            <form onSubmit={handleCreateSingleStudent} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">학생 이름</label>
                  <input
                    type="text"
                    placeholder="홍길동"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">아이디/이메일</label>
                  <input
                    type="text"
                    placeholder="hong123"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold"
                  />
                </div>

                {/* 🎯 [추가] 학부모 연락처 필드 */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">📱 학부모 연락처 (알림톡용)</label>
                  <input
                    type="tel"
                    placeholder="010-1234-5678"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold bg-amber-50/60 border-amber-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-sm"
              >
                + 학생 등록하기
              </button>
            </form>
          </div>

          {/* 일괄 등록 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>⚡</span> 학생 일괄 계정 생성
            </h2>

            <form onSubmit={handleBatchCreateStudents} className="space-y-3">
              <textarea
                placeholder="학생 이름을 줄바꿈으로 입력&#10;예:&#10;김철수&#10;이영희&#10;박민수"
                value={batchNames}
                onChange={(e) => setBatchNames(e.target.value)}
                className="w-full p-3 border rounded-xl text-xs h-24 font-medium"
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
              >
                일괄 계정 생성하기
              </button>
            </form>
          </div>

        </section>

        {/* 3. 담당 학생 목록 및 반 배정 관리 */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>👥</span> 담당 학생 목록 및 반 배정 ({students.length}명)
            </h2>
          </div>

          <div className="space-y-3">
            {students.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-xs font-bold">등록된 학생이 없습니다.</p>
            ) : (
              students.map((st) => {
                const assignedClassInfo = classStudents.find((cs) => cs.student_id === st.id);
                const assignedClass = classes.find((c) => c.id === assignedClassInfo?.class_id);

                return (
                  <div
                    key={st.id}
                    className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-800">{st.name}</span>
                        <span className="text-slate-400">({st.email})</span>
                        
                        {/* 🎯 학부모 연락처 뱃지 표시 */}
                        {st.parent_phone ? (
                          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px] border border-amber-200">
                            📱 학부모: {st.parent_phone}
                          </span>
                        ) : (
                          <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            연락처 미등록
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">소속 반:</span>
                        {assignedClass ? (
                          <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold">
                            📘 {assignedClass.name}
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-bold">
                            미배정
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedClassMap[st.id] || (assignedClass ? assignedClass.id.toString() : '')}
                        onChange={(e) => setSelectedClassMap({ ...selectedClassMap, [st.id]: e.target.value })}
                        className="p-2 border rounded-xl text-xs bg-white font-bold text-slate-700"
                      >
                        <option value="">-- 반 선택 --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssignClass(st.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl transition whitespace-nowrap"
                      >
                        배정
                      </button>

                      <button
                        onClick={() => setEditingStudent(st)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-2 rounded-xl transition whitespace-nowrap"
                      >
                        수정
                      </button>

                      <button
                        onClick={() => handleDeleteStudent(st.id, st.name)}
                        className="text-rose-500 hover:underline font-bold px-1"
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

      {/* 🎯 학생 수정 모달 (학부모 연락처 포함) */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <h4 className="text-sm font-bold text-slate-800">✏️ 학생 정보 수정</h4>
            
            <form onSubmit={handleUpdateStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">학생 이름</label>
                <input
                  type="text"
                  value={editingStudent.name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">아이디/이메일</label>
                <input
                  type="text"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">📱 학부모 연락처 (알림톡 수신용)</label>
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={editingStudent.parent_phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-xs font-semibold bg-amber-50/60 border-amber-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="w-1/2 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold shadow"
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