'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // 신규 계정 추가 폼 상태
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
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;

      if (data) {
        setStudents(data.filter((u) => u.role === 'STUDENT'));
        setTeachers(data.filter((u) => u.role === 'TEACHER'));
      }
    } catch (err) {
      console.error('사용자 목록 가져오기 오류:', err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('users').insert([
        {
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole,
        },
      ]);

      if (error) throw error;

      alert('성공적으로 등록되었습니다!');
      setShowAddUserModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('계정 등록에 실패했습니다.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* 헤더 영역 */}
      <header className="bg-blue-600 text-white py-6 px-8 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black">{user.name} 선생님 교무실</h1>
          <p className="text-xs text-blue-100 mt-1">스마트 학원 관리 대시보드</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4 py-2 rounded-lg font-bold transition"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        
        {/* Today's Attendance Check */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              📱 오늘 수업 출결 체크
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              {new Date().toLocaleDateString('ko-KR')}
            </span>
          </div>

          <div className="space-y-3">
            {students.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">등록된 학생이 없습니다.</p>
            ) : (
              students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100"
                >
                  <div>
                    <span className="font-bold text-slate-800 text-sm">{student.name} 학생</span>
                    <span className="text-xs text-slate-400 ml-2">{student.email}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      출석
                    </button>
                    <button className="bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      지각
                    </button>
                    <button className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      결석
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Account Management */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              👥 학원 계정 관리 (강사/원생)
            </h2>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + 신규 등록
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-2">
                👩‍🏫 등록된 선생님 ({teachers.length}명)
              </h3>
              <div className="space-y-2">
                {teachers.map((t) => (
                  <div key={t.id} className="bg-white p-2.5 rounded-lg border text-xs flex justify-between">
                    <span className="font-bold text-slate-700">{t.name} 선생님</span>
                    <span className="text-slate-400">{t.email}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-2">
                🧑‍🎓 등록된 학생 ({students.length}명)
              </h3>
              <div className="space-y-2">
                {students.map((s) => (
                  <div key={s.id} className="bg-white p-2.5 rounded-lg border text-xs flex justify-between">
                    <span className="font-bold text-slate-700">{s.name} 학생</span>
                    <span className="text-slate-400">{s.email}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 하단 기능 메뉴 그리드 (수업 피드백 버튼 추가) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          
          {/* 새로 추가된 당일 수업 피드백 버튼 */}
          <button
            onClick={() => router.push('/teacher/eval')}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4 rounded-2xl shadow-md hover:shadow-lg hover:scale-105 transition flex flex-col items-center justify-center space-y-2 text-center"
          >
            <span className="text-2xl">📊</span>
            <span className="font-bold text-xs">일일 수업 피드백</span>
          </button>

          <button
            onClick={() => router.push('/board')}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col items-center justify-center space-y-2 text-center"
          >
            <span className="text-2xl">📢</span>
            <span className="font-bold text-xs text-slate-700">공지사항</span>
          </button>

          <button className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col items-center justify-center space-y-2 text-center opacity-60 cursor-not-allowed">
            <span className="text-2xl">📝</span>
            <span className="font-bold text-xs text-slate-700">숙제 알림</span>
          </button>

          <button className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col items-center justify-center space-y-2 text-center opacity-60 cursor-not-allowed">
            <span className="text-2xl">🎬</span>
            <span className="font-bold text-xs text-slate-700">복습 영상</span>
          </button>

          <button className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col items-center justify-center space-y-2 text-center opacity-60 cursor-not-allowed">
            <span className="text-2xl">📄</span>
            <span className="font-bold text-xs text-slate-700">강의 자료</span>
          </button>

          <button
            onClick={() => router.push('/qna')}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col items-center justify-center space-y-2 text-center"
          >
            <span className="text-2xl">❓</span>
            <span className="font-bold text-xs text-slate-700">1:1 Q&A 질문</span>
          </button>
        </section>

      </main>

      {/* 신규 계정 추가 모달 */}
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
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이메일 (아이디)</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@test.com"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">비밀번호</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
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