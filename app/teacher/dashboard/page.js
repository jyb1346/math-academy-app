'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherDashboard() {
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);

  // 계정 등록 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('1234'); // 기본 비밀번호
  const [newRole, setNewRole] = useState('STUDENT'); // STUDENT 또는 TEACHER

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'TEACHER') {
      alert('선생님 권한이 필요합니다.');
      router.push('/login');
      return;
    }
    setTeacher(parsedUser);
    fetchUsers();
  }, []);

  // 전체 회원 목록 가져오기
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const userList = data || [];
      setStudents(userList.filter((u) => u.role === 'STUDENT'));
      setTeachers(userList.filter((u) => u.role === 'TEACHER'));
    } catch (err) {
      console.error(err);
      alert('사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 신규 계정 등록 함수
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      alert('모든 정보를 입력해주세요.');
      return;
    }

    try {
      const { error } = await supabase.from('users').insert([
        {
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          alert('이미 등록된 이메일입니다.');
        } else {
          throw error;
        }
        return;
      }

      alert(`${newRole === 'TEACHER' ? '선생님' : '학생'} 계정이 등록되었습니다!`);
      setNewName('');
      setNewEmail('');
      setNewPassword('1234');
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('계정 등록에 실패했습니다.');
    }
  };

  // 출결 상태 변경 및 DB 저장 처리
  const handleAttendance = async (studentId, status) => {
    if (!teacher) return;

    try {
      const { error } = await supabase.from('attendance').insert([
        {
          student_id: studentId,
          teacher_id: teacher.id,
          status: status,
          check_in_time: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setAttendance((prev) => ({ ...prev, [studentId]: status }));

      if (status === 'ABSENT') {
        alert('결석 처리되었습니다.');
      } else {
        alert(`${status === 'PRESENT' ? '출석' : '지각'} 처리 완료!`);
      }
    } catch (err) {
      console.error(err);
      alert('출결 처리에 실패했습니다.');
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 상단 헤더 */}
      <header className="bg-blue-600 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{teacher?.name} 선생님 교무실</h1>
            <p className="text-sm opacity-90">스마트 학원 관리 대시보드</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('user');
              router.push('/login');
            }}
            className="bg-blue-700 hover:bg-blue-800 text-xs px-3 py-2 rounded-lg transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {/* 오늘 수업 출결 체크 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>📱</span> 오늘 수업 출결 체크
            </h2>
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString('ko-KR')}
            </span>
          </div>

          <div className="space-y-4">
            {students.length === 0 ? (
              <p className="text-gray-500 text-center py-4">등록된 학생이 없습니다.</p>
            ) : (
              students.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4"
                >
                  <div>
                    <p className="font-bold text-lg text-gray-800">{student.name} 학생</p>
                    <p className="text-xs text-gray-500">{student.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAttendance(student.id, 'PRESENT')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-sm transition ${
                        attendance[student.id] === 'PRESENT'
                          ? 'bg-green-600 text-white'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      출석
                    </button>
                    <button
                      onClick={() => handleAttendance(student.id, 'LATE')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-sm transition ${
                        attendance[student.id] === 'LATE'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      지각
                    </button>
                    <button
                      onClick={() => handleAttendance(student.id, 'ABSENT')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-sm transition ${
                        attendance[student.id] === 'ABSENT'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      결석
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 계정 관리 섹션 (선생님/학생 등록) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>👥</span> 학원 계정 관리 (강사/원생)
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition"
            >
              + 신규 등록
            </button>
          </div>

          {/* 등록 모달 */}
          {showAddModal && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
              <h3 className="text-md font-bold text-gray-800">새 신규 계정 추가</h3>
              <form onSubmit={handleRegisterUser} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">구분</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="STUDENT">학생 (STUDENT)</option>
                      <option value="TEACHER">선생님 (TEACHER)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">이름</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="이름 입력"
                      required
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">이메일 (아이디)</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="example@test.com"
                      required
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">초기 비밀번호</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="비밀번호"
                      required
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                  >
                    등록 완료
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 선생님 목록 */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-gray-700 mb-2">👨‍🏫 등록된 선생님 ({teachers.length}명)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teachers.map((t) => (
                <div key={t.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs flex justify-between items-center">
                  <span className="font-bold text-blue-900">{t.name} 선생님</span>
                  <span className="text-gray-500">{t.email}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 게시판 바로가기 메뉴 */}
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">📢</span>
            <span>공지사항</span>
          </div>
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">📝</span>
            <span>숙제 알림</span>
          </div>
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🎬</span>
            <span>복습 영상</span>
          </div>
          <div 
            onClick={() => router.push('/board')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">📄</span>
            <span>강의 자료</span>
          </div>
          <div 
            onClick={() => router.push('/qna')}
            className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">❓</span>
            <span>1:1 Q&A 질문</span>
          </div>
        </section>
      </main>
    </div>
  );
}