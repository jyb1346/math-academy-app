'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parentReplies, setParentReplies] = useState([]);
  const [pendingQnaCount, setPendingQnaCount] = useState(0);

  // 계정 생성 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetRole, setTargetRole] = useState('STUDENT'); // STUDENT or TEACHER
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('1234');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // 생성 완료 안내 카드 팝업
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
      alert('선생님 또는 메인 선생님 계정으로만 접근할 수 있습니다.');
      router.push('/');
      return;
    }
    setUser(parsedUser);
    fetchDashboardData(parsedUser);
  }, []);

  const fetchDashboardData = async (currentUser) => {
    try {
      // 1. 유저 데이터 가져오기
      const { data: userData } = await supabase.from('users').select('*');
      if (userData) {
        const allTeachers = userData.filter((u) => u.role === 'TEACHER' || u.role === 'HEAD_TEACHER');
        setTeachers(allTeachers);

        // HEAD_TEACHER(메인 선생님)는 전체 학생 조회, TEACHER는 본인 담당 학생만 조회
        if (currentUser.role === 'HEAD_TEACHER') {
          setStudents(userData.filter((u) => u.role === 'STUDENT'));
        } else {
          setStudents(userData.filter((u) => u.role === 'STUDENT' && u.teacher_id === currentUser.id));
        }
      }

      // 2. 학부모 답장
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

      // 3. 미답변 Q&A
      const { data: qnaData } = await supabase.from('qna').select('id').eq('status', 'PENDING');
      setPendingQnaCount(qnaData?.length || 0);

    } catch (err) {
      console.error('대시보드 데이터 로드 실패:', err);
    }
  };

  // 계정 신규 등록 (선생님/학생)
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

  // 계정 삭제
  const handleDeleteUser = async (userId, userName, userRole) => {
    if (!confirm(`정말로 [${userName}] ${userRole === 'STUDENT' ? '학생' : '선생님'} 계정을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      alert('성공적으로 삭제되었습니다.');
      fetchDashboardData(user);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  if (!user) return <div className="p-10 text-center font-bold">교무실 데이터 불러오는 중...</div>;

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
          <p className="text-xs text-slate-400 mt-1">
            {user.role === 'HEAD_TEACHER' ? '학원 전체 선생님 & 학생 통합 관리 시스템' : '담당 학생 스마트 학습 관리 시스템'}
          </p>
        </div>
        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl font-bold border border-slate-700 transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">

        {/* 상단 브리핑 지표 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">
              {user.role === 'HEAD_TEACHER' ? '학원 전체 학생 수' : '내 담당 학생 수'}
            </p>
            <p className="text-2xl font-black text-slate-800 mt-1">{students.length}명</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">학부모 답장 알림</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{parentReplies.length}건</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">미답변 Q&A 질문</p>
            <p className="text-2xl font-black text-rose-500 mt-1">{pendingQnaCount}건</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">등록 선생님 수</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{teachers.length}명</p>
          </div>
        </section>

        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 좌측 메인 관리 영역 */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 학생 목록 & 출결/피드백 작성 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📱</span> {user.role === 'HEAD_TEACHER' ? '학원 학생 목록 및 피드백' : '내 담당 학생 출결 및 피드백'}
                </h2>
                <button
                  onClick={() => { setTargetRole('STUDENT'); setShowAddModal(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  + 학생 계정 발급
                </button>
              </div>

              <div className="space-y-3">
                {students.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">등록된 학생이 없습니다.</p>
                ) : (
                  students.map((student) => {
                    const teacherName = teachers.find((t) => t.id === student.teacher_id)?.name || '미지정';
                    return (
                      <div
                        key={student.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{student.name} 학생</span>
                            {user.role === 'HEAD_TEACHER' && (
                              <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">
                                담당: {teacherName} 선생님
                              </span>
                            )}
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
                  })
                )}
              </div>
            </section>

            {/* 학부모 수신 답장 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>💌</span> 학부모 수신 답장 ({parentReplies.length})
              </h2>
              {parentReplies.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">도착한 학부모 답장이 없습니다.</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {parentReplies.map((reply) => (
                    <div key={reply.id} className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-blue-700">
                          {reply.users?.name} 학생 학부모님
                        </span>
                        <span className="text-slate-400">수업일: {reply.eval_date}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">"{reply.parent_reply}"</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* 우측 관리 영역 */}
          <div className="space-y-6">
            
            {/* 메인 선생님 전용: 선생님 목록 및 계정 발급 */}
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
                  {teachers.map((tc) => {
                    const studentCount = students.filter((s) => s.teacher_id === tc.id).length;
                    return (
                      <div key={tc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{tc.name} 선생님</span>
                          {tc.role === 'HEAD_TEACHER' && <span className="text-amber-600 font-bold ml-1">(원장)</span>}
                          <p className="text-[11px] text-slate-400">{tc.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                            학생 {studentCount}명
                          </span>
                          {tc.role !== 'HEAD_TEACHER' && (
                            <button
                              onClick={() => handleDeleteUser(tc.id, tc.name, 'TEACHER')}
                              className="text-rose-500 hover:underline font-bold"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 빠른 기능 바로가기 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="text-base font-bold text-slate-800 mb-2">⚡ 수업 핵심 바로가기</h2>
              <button
                onClick={() => router.push('/teacher/eval')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-xl font-bold text-xs shadow hover:opacity-95 transition flex justify-between items-center"
              >
                <span>📊 일일 학습 피드백 작성</span>
                <span>→</span>
              </button>
              <button
                onClick={() => router.push('/qna')}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 p-3.5 rounded-xl font-bold text-xs border border-slate-200 transition flex justify-between items-center"
              >
                <span>❓ 1:1 Q&A 질문 답변 ({pendingQnaCount})</span>
                <span>→</span>
              </button>
              <button
                onClick={() => router.push('/board')}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 p-3.5 rounded-xl font-bold text-xs border border-slate-200 transition flex justify-between items-center"
              >
                <span>📢 숙제 및 공지사항 관리</span>
                <span>→</span>
              </button>
            </section>

          </div>

        </div>

      </main>

      {/* 계정 등록 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">
              {targetRole === 'STUDENT' ? '📱 신규 학생 계정 발급' : '👨‍🏫 신규 선생님 계정 추가'}
            </h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이름</label>
                <input
                  type="text" required value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이메일 계정 (아이디)</label>
                <input
                  type="email" required value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student1@poommath.com"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">초기 비밀번호</label>
                <input
                  type="text" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-bold"
                />
              </div>

              {/* 학생 등록 시 담당 선생님 선택 (메인 선생님일 경우) */}
              {targetRole === 'STUDENT' && user.role === 'HEAD_TEACHER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">담당 선생님 지정</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 font-semibold"
                  >
                    <option value="">본인({user.name} 선생님)</option>
                    {teachers.filter((t) => t.id !== user.id).map((tc) => (
                      <option key={tc.id} value={tc.id}>{tc.name} 선생님</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button" onClick={() => setShowAddModal(false)}
                  className="w-1/2 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow"
                >
                  계정 발급하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 계정 생성 완료 안내 안내카드 팝업 */}
      {createdInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl text-center">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-bold text-slate-800">
              [{createdInfo.name}] {createdInfo.role} 계정이 발급되었습니다!
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl border text-left text-xs space-y-1 font-mono">
              <p className="font-bold text-blue-600">[품수학 학원 접속 안내]</p>
              <p>• 계정 아이디: {createdInfo.email}</p>
              <p>• 비밀번호: {createdInfo.password}</p>
            </div>

            <button
              onClick={() => {
                const text = `[품수학 학원 계정 안내]\n이름: ${createdInfo.name}\n아이디: ${createdInfo.email}\n비밀번호: ${createdInfo.password}`;
                navigator.clipboard.writeText(text);
                alert('안내 문구가 클립보드에 복사되었습니다! 카톡이나 문자로 전송하세요.');
              }}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs shadow hover:bg-emerald-700 transition"
            >
              📋 전송용 안내 문구 복사하기
            </button>

            <button
              onClick={() => setCreatedInfo(null)}
              className="w-full bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs"
            >
              닫기
            </button>
          </div>
        </div>
      )}

    </div>
  );
}