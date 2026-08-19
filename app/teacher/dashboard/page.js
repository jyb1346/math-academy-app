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
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // 계정 생성 상태
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('STUDENT');

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'TEACHER') {
      alert('선생님 계정으로만 접근할 수 있습니다.');
      router.push('/');
      return;
    }
    setUser(parsedUser);
    fetchDashboardData(parsedUser.id);
  }, []);

  const fetchDashboardData = async (teacherId) => {
    try {
      // 1. 전체 유저 목록
      const { data: userData } = await supabase.from('users').select('*');
      if (userData) {
        setStudents(userData.filter((u) => u.role === 'STUDENT'));
        setTeachers(userData.filter((u) => u.role === 'TEACHER'));
      }

      // 2. 나에게 온 학부모 답장
      const { data: replyData } = await supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name)')
        .eq('teacher_id', teacherId)
        .not('parent_reply', 'is', null)
        .order('parent_reply_at', { ascending: false });
      setParentReplies(replyData || []);

      // 3. 미답변 Q&A 개수
      const { data: qnaData } = await supabase
        .from('qna')
        .select('id')
        .eq('status', 'PENDING');
      setPendingQnaCount(qnaData?.length || 0);

    } catch (err) {
      console.error('대시보드 데이터 로드 실패:', err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('users').insert([
        { email: newEmail, password: newPassword, name: newName, role: newRole },
      ]);
      if (error) throw error;
      alert('성공적으로 등록되었습니다!');
      setShowAddUserModal(false);
      setNewName(''); setNewEmail(''); setNewPassword('');
      fetchDashboardData(user.id);
    } catch (err) {
      alert('계정 등록에 실패했습니다.');
    }
  };

  if (!user) return <div className="p-10 text-center font-bold">교무실 데이터 불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      
      {/* 1. 헤더 */}
      <header className="bg-slate-900 text-white py-6 px-8 shadow-lg flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-xs px-2.5 py-1 rounded-full font-bold">POOM MATH</span>
            <h1 className="text-2xl font-black">{user.name} 선생님 교무실</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">스마트 학습 관리 & 학부모 소통 대시보드</p>
        </div>
        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl font-bold border border-slate-700 transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">

        {/* 2. 상단 브리핑 지표 (KPI) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400">관리 학생 수</p>
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
            <p className="text-xs font-bold text-slate-400">등록 강사 수</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{teachers.length}명</p>
          </div>
        </section>

        {/* 3. 2컬럼 메인 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 좌측 영역 (2컬럼 분량): 핵심 수업 관리 */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 오늘 수업 출결 & 빠른 피드백 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📱</span> 오늘 수업 출결 및 피드백 작성
                </h2>
                <span className="text-xs text-slate-400 font-semibold">
                  {new Date().toLocaleDateString('ko-KR')}
                </span>
              </div>

              <div className="space-y-3">
                {students.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">등록된 학생이 없습니다.</p>
                ) : (
                  students.map((student) => (
                    <div
                      key={student.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 gap-3"
                    >
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{student.name} 학생</span>
                        <span className="text-xs text-slate-400 block sm:inline sm:ml-2">{student.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                          출석
                        </button>
                        <button className="bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                          지각
                        </button>
                        <button
                          onClick={() => router.push('/teacher/eval')}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition ml-2"
                        >
                          📊 피드백 작성
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 학부모 답장 리스트 */}
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
                        <span className="text-slate-400">
                          수업일: {reply.eval_date}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">
                        "{reply.parent_reply}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* 우측 영역 (1컬럼 분량): 바로가기 메뉴 & 계정 관리 */}
          <div className="space-y-6">
            
            {/* 빠른 기능 메뉴 */}
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
                <span>📢 공지사항 관리</span>
                <span>→</span>
              </button>
            </section>

            {/* 계정 관리 요약 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-800">👥 학원 계정 관리</h2>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  + 신규 등록
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border flex justify-between font-semibold">
                  <span>등록된 선생님</span>
                  <span className="text-blue-600">{teachers.length}명</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border flex justify-between font-semibold">
                  <span>등록된 원생</span>
                  <span className="text-blue-600">{students.length}명</span>
                </div>
              </div>
            </section>

          </div>

        </div>

      </main>

      {/* 계정 추가 모달 */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">신규 계정 추가</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">구분</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                >
                  <option value="STUDENT">학생</option>
                  <option value="TEACHER">선생님</option>
                </select>
              </div>
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
                <label className="block text-xs font-bold text-slate-600 mb-1">이메일(아이디)</label>
                <input
                  type="email" required value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@test.com"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">비밀번호</label>
                <input
                  type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button" onClick={() => setShowAddUserModal(false)}
                  className="w-1/2 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}