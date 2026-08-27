'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import PushNotificationManager from '@/components/PushNotificationManager';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [pendingQnaCount, setPendingQnaCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 비밀번호 변경 모달 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // 반 생성 폼
  const [newClassName, setNewClassName] = useState('');

  // 🎯 메인에 배치된 엑셀 2박스 일괄 학생 등록 상태
  const [batchNamesText, setBatchNamesText] = useState('');   // 이름 세로 박스
  const [batchPhonesText, setBatchPhonesText] = useState(''); // 전화번호 세로 박스

  // 학생 수정 모달 상태
  const [editingStudent, setEditingStudent] = useState(null);

  // 특정 반에 학생 일괄 배정 모달 상태
  const [assignTargetClass, setAssignTargetClass] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // 학생 개별 배정 드롭다운
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
      setUser(parsedUser);
      fetchTeacherData(parsedUser.id);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const fetchTeacherData = async (teacherId) => {
    try {
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacherId);
      setClasses(cData || []);

      const { data: stData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'STUDENT')
        .eq('teacher_id', teacherId);
      setStudents(stData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      const { data: qnaData } = await supabase
        .from('qna')
        .select('id, status')
        .eq('teacher_id', teacherId)
        .eq('status', 'PENDING');
      setPendingQnaCount(qnaData ? qnaData.length : 0);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`반 개설 실패: ${err.message}`);
    }
  };

  const handleDeleteClass = async (classId, className) => {
    if (!confirm(`[${className}] 반을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 🎯 엑셀 2박스(이름 박스 / 학부모 번호 박스) 일괄 등록 실행
  const handleBatchCreateStudents = async (e) => {
    e.preventDefault();
    if (!batchNamesText.trim()) return alert('학생 이름 열을 입력하거나 붙여넣어 주세요.');

    const nameList = batchNamesText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const phoneList = batchPhonesText
      .split('\n')
      .map((line) => line.trim());

    const validPhones = phoneList.filter((p) => p.length > 0);
    if (validPhones.length > 0 && nameList.length !== validPhones.length) {
      const proceed = confirm(
        `⚠️ 입력된 이름 개수(${nameList.length}명)와 전화번호 개수(${validPhones.length}개)가 서로 다릅니다.\n줄바꿈 순서대로 매칭되며, 번호가 부족한 학생은 빈 번호로 등록됩니다.\n\n계속 진행하시겠습니까?`
      );
      if (!proceed) return;
    }

    if (nameList.length === 0) return alert('유효한 학생 이름이 없습니다.');

    try {
      const payloads = nameList.map((name, index) => {
        const rawPhone = phoneList[index] || '';
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

      alert(`${payloads.length}명의 학생 계정이 신규 등록되었습니다.`);
      setBatchNamesText('');
      setBatchPhonesText('');
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`학생 등록 실패: ${err.message}`);
    }
  };

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
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!confirm(`[${studentName}] 학생을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', studentId);
      if (error) throw error;
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const handleAssignClass = async (studentId) => {
    const classId = selectedClassMap[studentId];
    if (!classId) return alert('배정할 반을 선택해 주세요.');

    try {
      await supabase.from('class_students').delete().eq('student_id', studentId);

      const { error } = await supabase.from('class_students').insert([
        { student_id: studentId, class_id: classId }
      ]);

      if (error) throw error;
      alert('반 배정이 완료되었습니다.');
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  const openClassAssignModal = (cls) => {
    setAssignTargetClass(cls);
    const currentStudentIds = classStudents
      .filter((cs) => String(cs.class_id) === String(cls.id))
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
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
      교무실 대시보드 로딩 중...
    </div>
  );

  const isHeadTeacher = user?.role === 'HEAD_TEACHER';

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      
      {/* 📘 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              품수학 학원 교무실
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md text-[10px]">
                📘 {isHeadTeacher ? '원장님 (내 수업 모드)' : '선생님'}
              </span>
              <span>{user?.name} 선생님 대시보드</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareKakaoLink}
            className="text-xs bg-amber-300 hover:bg-amber-400 text-amber-950 font-black px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
            title="학부모/학생에게 카톡으로 앱 설치 링크 보내기"
          >
            <span>💬</span>
            <span>카톡 앱 초대 링크</span>
          </button>
          {isHeadTeacher && (
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold px-3 py-2 rounded-xl transition"
            >
              👑 원장 뷰
            </button>
          )}

          <button
            onClick={() => setShowPasswordModal(true)}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition border border-slate-200"
          >
            🔒 비밀번호 변경
          </button>

          <button
            onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-2 rounded-xl transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        <PushNotificationManager user={user} />

        {/* 🎯 1. 메인 대형 액션 메뉴 */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* 카드 A: 일일 피드백 작성 */}
            <div
              onClick={() => router.push('/teacher/eval')}
              className="group relative bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-7 rounded-3xl shadow-xl shadow-indigo-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
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
                <p className="text-xs text-blue-100/90 font-normal leading-relaxed">
                  오늘 수업 성취도(6대 영역) 및 출결/지각 상태를 기록합니다.
                </p>
              </div>
            </div>

            {/* 카드 B: 반별 게시판 관리 */}
            <div
              onClick={() => router.push('/board')}
              className="group relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-7 rounded-3xl shadow-xl shadow-indigo-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs px-3.5 py-1 rounded-full font-bold">
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

            {/* 🎯 카드 C: 1:1 수학 질의응답 (Q&A) */}
            <div
              onClick={() => router.push('/qna')}
              className="group relative bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 text-white p-7 rounded-3xl shadow-xl shadow-amber-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start">
                <span className={`text-xs px-3.5 py-1 rounded-full font-black flex items-center gap-1.5 ${
                  pendingQnaCount > 0
                    ? 'bg-rose-600 text-white animate-pulse shadow-md'
                    : 'bg-white/20 border border-white/20 text-white'
                }`}>
                  {pendingQnaCount > 0 ? `🚨 미답변 질문 ${pendingQnaCount}건` : '✅ 답변 완료'}
                </span>
                <span className="text-3xl text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-2xl font-black text-white">1:1 질의응답 (Q&A)</h2>
                <p className="text-xs text-amber-100 font-normal leading-relaxed">
                  담당 학생들이 올린 문제 사진과 질문을 확인하고 1:1 풀이 답변을 남깁니다.
                </p>
              </div>
            </div>

          </div>

          <div className="flex justify-end">
            <button
              onClick={() => router.push('/teacher/eval/history')}
              className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 px-4 py-2.5 rounded-2xl font-bold transition shadow-xs flex items-center gap-2"
            >
              <span>📋 작성된 일일 피드백 리포트 내역 및 학부모 답장 보기</span>
              <span>→</span>
            </button>
          </div>
        </section>

        {/* 🏫 2. 내 담당 반 관리 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>🏫</span> 내 담당 반 관리
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">반을 개설하거나 내 반의 학생들을 지정해 일괄 배정하세요.</p>
            </div>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">
              총 {classes.length}개 반
            </span>
          </div>

          <form onSubmit={handleCreateClass} className="flex gap-2">
            <input
              type="text"
              placeholder="신규 반 이름 입력 (예: 중3 심화A반)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-sm transition whitespace-nowrap"
            >
              + 반 개설
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {classes.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 col-span-full">개설된 반이 없습니다. 반을 추가해 주세요.</p>
            ) : (
              classes.map((cls) => {
                const count = classStudents.filter((cs) => String(cs.class_id) === String(cls.id)).length;

                return (
                  <div
                    key={cls.id}
                    className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between space-y-3 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-extrabold text-slate-800">📘 {cls.name}</span>
                      <button
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                        className="text-xs text-rose-500 font-bold hover:underline"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-bold">소속 학생: <span className="text-indigo-600 font-extrabold">{count}명</span></span>
                      
                      <button
                        onClick={() => openClassAssignModal(cls)}
                        className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-xs"
                      >
                        + 학생 지정 배정
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 📊 🎯 3. 학생 신규 일괄 등록 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <span>📊</span> 내 담당 학생 신규 일괄 등록
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              1명만 등록할 때는 1행만 입력하시고, 여러 명일 때는 엑셀의 [이름 열]과 [연락처 열]을 복사해서 그대로 붙여넣으세요.
            </p>
          </div>

          <form onSubmit={handleBatchCreateStudents} className="space-y-4">
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-amber-900">💡 엑셀 복사/붙여넣기 및 입력 방법:</p>
              <p>• 1명 등록 시: 왼쪽 박스에 <span className="font-bold text-slate-900">홍길동</span>, 오른쪽 박스에 <span className="font-bold text-slate-900">01012345678</span> 입력</p>
              <p>• 엑셀 붙여넣기 시: 엑셀의 <span className="font-bold text-slate-900">[학생 이름 열]</span>과 <span className="font-bold text-slate-900">[학부모 연락처 열]</span>을 각각 복사(Ctrl+C)하여 아래 2개 박스에 각각 붙여넣으세요.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                  <span>👤 학생 이름 열 (필수)</span>
                  <span className="text-[11px] text-indigo-600 font-extrabold">
                    {batchNamesText.split('\n').filter((l) => l.trim()).length}명 입력됨
                  </span>
                </label>
                <textarea
                  placeholder="홍길동&#10;김철수&#10;이영희"
                  value={batchNamesText}
                  onChange={(e) => setBatchNamesText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs h-44 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                  <span>📱 학부모 연락처 열 (선택)</span>
                  <span className="text-[11px] text-amber-600 font-extrabold">
                    {batchPhonesText.split('\n').filter((l) => l.trim()).length}건 입력됨
                  </span>
                </label>
                <textarea
                  placeholder="010-1234-5678&#10;010-9876-5432&#10;010-1111-2222"
                  value={batchPhonesText}
                  onChange={(e) => setBatchPhonesText(e.target.value)}
                  className="w-full p-3.5 bg-amber-50/30 border border-amber-200/80 rounded-2xl text-xs h-44 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 transition leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md transition"
            >
              + 학생 일괄 등록 완료하기
            </button>
          </form>
        </section>

        {/* 👥 4. 내 담당 학생 목록 */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>👥</span> 내 담당 학생 목록 ({students.length}명)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">학생 개별 수정 및 개별 반 변경이 가능합니다.</p>
            </div>
          </div>

          <div className="space-y-3">
            {students.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">등록된 학생이 없습니다.</p>
            ) : (
              students.map((st) => {
                const assignedClassInfo = classStudents.find((cs) => cs.student_id === st.id);
                const assignedClass = classes.find((c) => String(c.id) === String(assignedClassInfo?.class_id));

                return (
                  <div
                    key={st.id}
                    className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-800">{st.name}</span>
                        <span className="text-slate-400 text-xs font-semibold">({st.email})</span>
                        
                        {st.parent_phone ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                            📱 학부모: {st.parent_phone}
                          </span>
                        ) : (
                          <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                            연락처 미등록
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-bold">소속 반:</span>
                        {assignedClass ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
                            📘 {assignedClass.name}
                          </span>
                        ) : (
                          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-0.5 rounded-full font-bold">
                            미배정
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedClassMap[st.id] || (assignedClass ? String(assignedClass.id) : '')}
                        onChange={(e) => setSelectedClassMap({ ...selectedClassMap, [st.id]: e.target.value })}
                        className="p-2 border rounded-xl text-xs font-bold text-slate-700 bg-white"
                      >
                        <option value="">-- 반 선택 --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssignClass(st.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition whitespace-nowrap shadow-xs"
                      >
                        배정
                      </button>

                      <button
                        onClick={() => setEditingStudent(st)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition whitespace-nowrap"
                      >
                        수정
                      </button>

                      <button
                        onClick={() => handleDeleteStudent(st.id, st.name)}
                        className="text-rose-500 hover:underline font-bold px-1 text-xs"
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

      {/* 🔒 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowPasswordModal(false)}
          onPasswordUpdated={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {/* 🎯 모달 1: 반 학생 일괄 배정 */}
      {assignTargetClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  📘 [{assignTargetClass.name}] 반 학생 일괄 배정
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">배정할 학생들을 체크박스로 선택해 주세요.</p>
              </div>
              <button onClick={() => setAssignTargetClass(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {students.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">등록된 학생이 없습니다.</p>
              ) : (
                students.map((st) => {
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
                          <span className="text-[10px] text-slate-400">{st.email}</span>
                        </div>
                      </div>

                      {isChecked && (
                        <span className="text-xs font-bold text-indigo-600">선택됨 ✓</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl text-xs font-bold">
              <span className="text-slate-600">선택된 학생:</span>
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

      {/* ✏️ 모달 2: 학생 정보 수정 */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <h4 className="text-base font-extrabold text-slate-800">✏️ 학생 정보 수정</h4>
            
            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">학생 이름</label>
                <input
                  type="text"
                  value={editingStudent.name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">아이디 / 이메일</label>
                <input
                  type="text"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
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
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-bold shadow-md transition"
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