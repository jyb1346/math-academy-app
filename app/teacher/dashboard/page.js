'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [parentReplies, setParentReplies] = useState([]);
  const [pendingQnaCount, setPendingQnaCount] = useState(0);

  // 계정 생성 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetRole, setTargetRole] = useState('STUDENT');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('1234');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // 반 생성 및 학생 배정 모달 상태
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [activeClass, setActiveClass] = useState(null); // 학생 배정용 선택된 반

  const [createdInfo, setCreatedInfo] = useState(null);
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
    fetchDashboardData(parsedUser);
  }, []);

  const fetchDashboardData = async (currentUser) => {
    try {
      // 1. 유저 데이터
      const { data: userData } = await supabase.from('users').select('*');
      if (userData) {
        const allTeachers = userData.filter((u) => u.role === 'TEACHER' || u.role === 'HEAD_TEACHER');
        setTeachers(allTeachers);

        if (currentUser.role === 'HEAD_TEACHER') {
          setStudents(userData.filter((u) => u.role === 'STUDENT'));
        } else {
          setStudents(userData.filter((u) => u.role === 'STUDENT' && u.teacher_id === currentUser.id));
        }
      }

      // 2. 반(Class) 및 반-학생 데이터
      let classQuery = supabase.from('classes').select('*');
      if (currentUser.role !== 'HEAD_TEACHER') {
        classQuery = classQuery.eq('teacher_id', currentUser.id);
      }
      const { data: classData } = await classQuery;
      setClasses(classData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      // 3. 학부모 답장
      let replyQuery = supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name)')
        .not('parent_reply', 'is', null)
        .order('parent_reply_at', { ascending: false });

      if (currentUser.role !== 'HEAD_TEACHER') {
        replyQuery = replyQuery.eq('teacher_id', currentUser.id);
      }
      const { data: replyData } = await replyQuery;
      setParentReplies(replyData || []);

      // 4. Q&A
      const { data: qnaData } = await supabase.from('qna').select('id').eq('status', 'PENDING');
      setPendingQnaCount(qnaData?.length || 0);

    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  };

  // 반 생성
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const { error } = await supabase.from('classes').insert([
        { name: newClassName.trim(), teacher_id: user.id }
      ]);
      if (error) throw error;

      setNewClassName('');
      setShowClassModal(false);
      fetchDashboardData(user);
      alert('새로운 반이 생성되었습니다.');
    } catch (err) {
      alert(`반 생성 실패: ${err.message}`);
    }
  };

  // 반 삭제
  const handleDeleteClass = async (classId, className) => {
    if (!confirm(`[${className}] 반을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      fetchDashboardData(user);
    } catch (err) {
      alert(`반 삭제 실패: ${err.message}`);
    }
  };

  // 반에 학생 추가/제거 토글
  const toggleStudentInClass = async (classId, studentId) => {
    const isAssigned = classStudents.some(
      (cs) => cs.class_id === classId && cs.student_id === studentId
    );

    if (isAssigned) {
      await supabase
        .from('class_students')
        .delete()
        .eq('class_id', classId)
        .eq('student_id', studentId);
    } else {
      await supabase
        .from('class_students')
        .insert([{ class_id: classId, student_id: studentId }]);
    }
    fetchDashboardData(user);
  };

  // 계정 등록
  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const newUserObj = {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        role: targetRole,
        teacher_id: targetRole === 'STUDENT' ? (selectedTeacherId || user.id) : null,
      };

      const { error } = await supabase.from('users').insert([newUserObj]);
      if (error) throw error;

      setCreatedInfo({
        role: targetRole === 'STUDENT' ? '학생' : '선생님',
        name: newName,
        email: newEmail,
        password: newPassword,
      });

      setShowAddModal(false);
      setNewName(''); setNewEmail(''); setNewPassword('1234'); setSelectedTeacherId('');
      fetchDashboardData(user);
    } catch (err) {
      alert(`계정 등록 실패: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId, userName, userRole) => {
    if (!confirm(`정말로 [${userName}] 계정을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      fetchDashboardData(user);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  if (!user) return <div className="p-10 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      
      {/* 헤더 */}
      <header className="bg-slate-900 text-white py-6 px-8 shadow-lg flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${user.role === 'HEAD_TEACHER' ? 'bg-amber-500 text-slate-950' : 'bg-blue-600'}`}>
              {user.role === 'HEAD_TEACHER' ? '👑 메인 선생님(원장님)' : 'POOM MATH'}
            </span>
            <h1 className="text-2xl font-black">{user.name} 선생님 교무실</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">담당 반 관리 및 개별 공지/숙제 전달 시스템</p>
        </div>
        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl font-bold border border-slate-700 transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">

        {/* 대시보드 지표 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">내 담당 반 수</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{classes.length}개 반</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">관리 학생 수</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{students.length}명</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">학부모 답장</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{parentReplies.length}건</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">미답변 Q&A</p>
            <p className="text-2xl font-black text-rose-500 mt-1">{pendingQnaCount}건</p>
          </div>
        </section>

        {/* 반(Class) 관리 섹션 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🏫</span> 담당 반 목록 및 학생 배정
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">반별로 학생을 배치하여 반 전용 공지와 숙제를 지정할 수 있습니다.</p>
            </div>
            <button
              onClick={() => setShowClassModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow transition"
            >
              + 새 반 생성
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 col-span-3 text-center">생성된 반이 없습니다. 새 반을 개설해 보세요!</p>
            ) : (
              classes.map((cls) => {
                const assignedStudentIds = classStudents
                  .filter((cs) => cs.class_id === cls.id)
                  .map((cs) => cs.student_id);
                const assignedCount = assignedStudentIds.length;

                return (
                  <div key={cls.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-800 text-sm">📘 {cls.name}</span>
                        <button
                          onClick={() => handleDeleteClass(cls.id, cls.name)}
                          className="text-xs text-rose-500 hover:underline font-bold"
                        >
                          삭제
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        배정 학생: <span className="font-bold text-blue-600">{assignedCount}명</span>
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveClass(cls)}
                      className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs py-2 rounded-lg font-bold transition shadow-sm"
                    >
                      ⚙️ 학생 배정 관리
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 2컬럼 메인 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* 학생 목록 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📱</span> {user.role === 'HEAD_TEACHER' ? '학원 전체 학생' : '내 담당 학생'} ({students.length}명)
                </h2>
                <button
                  onClick={() => { setTargetRole('STUDENT'); setShowAddModal(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  + 학생 계정 발급
                </button>
              </div>

              <div className="space-y-3">
                {students.map((student) => {
                  const studentClasses = classStudents
                    .filter((cs) => cs.student_id === student.id)
                    .map((cs) => classes.find((c) => c.id === cs.class_id)?.name)
                    .filter(Boolean);

                  return (
                    <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{student.name} 학생</span>
                          {studentClasses.map((cName, idx) => (
                            <span key={idx} className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-bold">
                              {cName}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-slate-400 block mt-0.5">아이디: {student.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push('/teacher/eval')}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition"
                        >
                          📊 피드백 작성
                        </button>
                        <button
                          onClick={() => handleDeleteUser(student.id, student.name, 'STUDENT')}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-600 text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* 우측 영역 */}
          <div className="space-y-6">
            {user.role === 'HEAD_TEACHER' && (
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                    <span>👨‍🏫</span> 선생님 계정 관리
                  </h2>
                  <button
                    onClick={() => { setTargetRole('TEACHER'); setShowAddModal(true); }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    + 선생님 추가
                  </button>
                </div>

                <div className="space-y-2">
                  {teachers.map((tc) => (
                    <div key={tc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{tc.name} 선생님</span>
                        {tc.role === 'HEAD_TEACHER' && <span className="text-amber-600 font-bold ml-1">(원장)</span>}
                        <p className="text-[11px] text-slate-400">{tc.email}</p>
                      </div>
                      {tc.role !== 'HEAD_TEACHER' && (
                        <button onClick={() => handleDeleteUser(tc.id, tc.name, 'TEACHER')} className="text-rose-500 hover:underline font-bold">
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="text-base font-bold text-slate-800 mb-2">⚡ 바로가기</h2>
              <button
                onClick={() => router.push('/board')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-xl font-bold text-xs shadow hover:opacity-95 transition flex justify-between items-center"
              >
                <span>📢 반별 공지 및 숙제 작성하기</span>
                <span>→</span>
              </button>
              <button
                onClick={() => router.push('/teacher/eval')}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 p-3.5 rounded-xl font-bold text-xs border border-slate-200 transition flex justify-between items-center"
              >
                <span>📊 일일 학습 피드백 작성</span>
                <span>→</span>
              </button>
            </section>
          </div>
        </div>

      </main>

      {/* 새 반 생성 모달 */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">🏫 새 반 생성하기</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">반 이름</label>
                <input
                  type="text" required value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="예: 고3 수능최저반, 중2 내신A반"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowClassModal(false)} className="w-1/2 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs">
                  취소
                </button>
                <button type="submit" className="w-1/2 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs shadow">
                  생성하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 반에 학생 배정 모달 */}
      {activeClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-800">📘 [{activeClass.name}] 학생 배정</h3>
              <button onClick={() => setActiveClass(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">닫기</button>
            </div>

            <p className="text-xs text-slate-500">이 반에 소속될 학생들을 선택해 주세요 (클릭하여 체크/해제):</p>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {students.map((st) => {
                const isAssigned = classStudents.some(
                  (cs) => cs.class_id === activeClass.id && cs.student_id === st.id
                );
                return (
                  <div
                    key={st.id}
                    onClick={() => toggleStudentInClass(activeClass.id, st.id)}
                    className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition ${
                      isAssigned ? 'bg-indigo-50 border-indigo-300 font-bold text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs">{st.name} ({st.email})</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${isAssigned ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {isAssigned ? '✓ 소속됨' : '+ 추가'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setActiveClass(null)} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs shadow">
              배정 완료
            </button>
          </div>
        </div>
      )}

      {/* 계정 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">
              {targetRole === 'STUDENT' ? '📱 신규 학생 계정 발급' : '👨‍🏫 신규 선생님 계정 추가'}
            </h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이름</label>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 홍길동" className="w-full p-2.5 border rounded-xl text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이메일 계정 (아이디)</label>
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="student1@poommath.com" className="w-full p-2.5 border rounded-xl text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">초기 비밀번호</label>
                <input type="text" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-bold" />
              </div>
              {targetRole === 'STUDENT' && user.role === 'HEAD_TEACHER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">담당 선생님 지정</label>
                  <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-semibold">
                    <option value="">본인({user.name} 선생님)</option>
                    {teachers.filter((t) => t.id !== user.id).map((tc) => (
                      <option key={tc.id} value={tc.id}>{tc.name} 선생님</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs">취소</button>
                <button type="submit" className="w-1/2 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow">계정 발급하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 계정 생성 완료 팝업 */}
      {createdInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl text-center">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-bold text-slate-800">[{createdInfo.name}] {createdInfo.role} 계정이 발급되었습니다!</h3>
            <div className="bg-slate-50 p-4 rounded-xl border text-left text-xs space-y-1 font-mono">
              <p className="font-bold text-blue-600">[품수학 학원 접속 안내]</p>
              <p>• 계정 아이디: {createdInfo.email}</p>
              <p>• 비밀번호: {createdInfo.password}</p>
            </div>
            <button
              onClick={() => {
                const text = `[품수학 학원 계정 안내]\n이름: ${createdInfo.name}\n아이디: ${createdInfo.email}\n비밀번호: ${createdInfo.password}`;
                navigator.clipboard.writeText(text);
                alert('안내 문구가 복사되었습니다!');
              }}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs shadow transition"
            >
              📋 전송용 안내 문구 복사하기
            </button>
            <button onClick={() => setCreatedInfo(null)} className="w-full bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs">닫기</button>
          </div>
        </div>
      )}

    </div>
  );
}