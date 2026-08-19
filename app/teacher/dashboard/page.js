'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parentReplies, setParentReplies] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

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
    fetchMyParentReplies(parsedUser.id);
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

  // 로그인한 선생님 전용 학부모 답장 가져오기
  const fetchMyParentReplies = async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name)')
        .eq('teacher_id', teacherId)
        .not('parent_reply', 'is', null)
        .order('parent_reply_at', { ascending: false });

      if (error) throw error;
      setParentReplies(data || []);
    } catch (err) {
      console.error('학부모 답장 로드 에러:', err);
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
        
        {/* 나에게 온 학부모 답장 목록 (선생님 본인에게 온 답장만 노출) */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            💌 학부모 답장 알림 ({parentReplies.length}건)
          </h2>
          {parentReplies.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">도착한 학부모 답장이 없습니다.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {parentReplies.map((reply) => (
                <div key={reply.id} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-blue-700">
                      {reply.users?.name} 학생 학부모님
                    </span>
                    <span className="text-slate-400">
                      수업일: {reply.eval_date} ({new Date(reply.parent_reply_at).toLocaleDateString()})
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

        {/* 출결 체크 섹션 */}
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

        {/* 하단 기능 메뉴 그리드 */}
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
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
    </div>
  );
}