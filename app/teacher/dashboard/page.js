'use client';
import TeacherClinicModal from "@/components/TeacherClinicModal";
import StudentStickerMarketModal from "@/components/StudentStickerMarketModal";
import ClassAttendanceModal from "@/components/ClassAttendanceModal";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PushNotificationManager from '@/components/PushNotificationManager';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { logout } from '@/lib/useSession';
import { getClientCache, setClientCache } from '@/lib/clientCache';
import { isParentReplyUnread, markParentReplyCheckedInComment } from '@/lib/evalUtils';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [allAcademyStudents, setAllAcademyStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [allClassStudents, setAllClassStudents] = useState([]);
  const [qnaStats, setQnaStats] = useState({ pending: 0, inProgress: 0, resolved: 0, total: 0 });
  const [clinicPendingCount, setClinicPendingCount] = useState(0);
  const [repliedEvaluations, setRepliedEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showStickerMarketModal, setShowStickerMarketModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceTargetClassId, setAttendanceTargetClassId] = useState('ALL');

  // 반 생성 폼 및 수업 유형 (판서수업 LECTURE / 개별수업 INDIVIDUAL)
  const [newClassName, setNewClassName] = useState('');
  const [newClassType, setNewClassType] = useState('LECTURE');
  const [classTypes, setClassTypes] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('poom_class_types');
      if (stored) {
        setClassTypes(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleToggleClassType = (classId) => {
    const current = classTypes[classId] || 'LECTURE';
    const nextType = current === 'LECTURE' ? 'INDIVIDUAL' : 'LECTURE';
    const updated = { ...classTypes, [classId]: nextType };
    setClassTypes(updated);
    try {
      localStorage.setItem('poom_class_types', JSON.stringify(updated));
    } catch (e) {}
  };

  // 📲 카카오톡 초대 및 앱 설치 안내 링크 복사/공유 (중복 URL 방지)
  const handleShareKakaoLink = async () => {
    const appUrl = (typeof window !== 'undefined' ? window.location.origin : 'https://math-academy-app-kappa.vercel.app') + '/?app=1';
    const shareText = `[품수학 학원 공식 앱 안내]\n안녕하세요! 품수학 학원 전용 알림 앱입니다.\n아래 링크를 눌러 스마트폰 홈 화면에 추가하시면 반별 숙제 공지와 1:1 질문 풀이 알림을 실시간으로 확인하실 수 있습니다.\n\n🔗 품수학 앱 바로가기:\n${appUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // text 안에 이미 주소가 포함되어 있으므로 url 속성을 생략하여 모바일 OS의 주소 2중 중복 병합 방지
        await navigator.share({
          text: shareText,
        });
        return;
      } catch (err) {
        // User cancelled or fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      alert('💬 카카오톡 전송용 안내 문구와 링크가 복사되었습니다!\n카톡 채팅방이나 단톡방에 붙여넣어(Ctrl+V) 보내주세요.');
    } catch (err) {
      prompt('아래 링크를 복사하여 카카오톡으로 전달해 주세요:', shareText);
    }
  };

  // 🎯 메인에 배치된 엑셀 2박스 일괄 학생 등록 상태 (+ 학년/학교 선택 지원)
  const [batchNamesText, setBatchNamesText] = useState('');   // 이름 세로 박스
  const [batchPhonesText, setBatchPhonesText] = useState(''); // 전화번호 세로 박스
  const [batchGradeCode, setBatchGradeCode] = useState('');   // 일괄 등록 기본 학년 (선택: M1~M3, H1~H3)
  const [batchSchoolName, setBatchSchoolName] = useState(''); // 일괄 등록 기본 학교명 (선택)
  const [studentGradeFilter, setStudentGradeFilter] = useState('ALL'); // ALL | MIDDLE | HIGH | M1..H3

  // 학생 수정 모달 상태
  const [editingStudent, setEditingStudent] = useState(null);

  // 특정 반에 학생 일괄 배정 모달 상태 (타 선생님 학생 특강 배정 지원)
  const [assignTargetClass, setAssignTargetClass] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [assignModalScope, setAssignModalScope] = useState('MY'); // 'MY' | 'ALL_ACADEMY'
  const [assignSearchQuery, setAssignSearchQuery] = useState('');

  // 학생 개별 배정 드롭다운
  const [selectedClassMap, setSelectedClassMap] = useState({});

  const router = useRouter();

  const applyTeacherData = (data) => {
    setClasses(data.classes || []);
    setAllClasses(data.allClasses || data.classes || []);
    const sortedStudents = [...(data.students || [])].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ko')
    );
    setStudents(sortedStudents);
    const sortedAllAcademy = [...(data.allAcademyStudents || data.students || [])].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ko')
    );
    setAllAcademyStudents(sortedAllAcademy);
    setTeachers(data.teachers || []);
    setClassStudents(data.classStudents || []);
    setAllClassStudents(data.allClassStudents || data.classStudents || []);
    setRepliedEvaluations(data.repliedEvaluations || []);

    const parsedQna = (data.qna || []).map((q) => {
      let replies = [];
      if (Array.isArray(q.replies)) replies = q.replies;
      else if (typeof q.replies === 'string') {
        try { replies = JSON.parse(q.replies) || []; } catch { replies = []; }
      }
      const lastReply = replies.length > 0 ? replies[replies.length - 1] : null;
      let computedStatus = q.status;
      if (q.status === 'ANSWERED' && lastReply?.type === 'RESOLVED') {
        computedStatus = 'RESOLVED';
      }
      return { ...q, computedStatus };
    });

    const pending = parsedQna.filter((q) => q.computedStatus === 'PENDING').length;
    const inProgress = parsedQna.filter((q) => q.computedStatus === 'ANSWERED').length;
    const resolved = parsedQna.filter((q) => q.computedStatus === 'RESOLVED').length;

    setQnaStats({
      pending,
      inProgress,
      resolved,
      total: parsedQna.length,
    });
  };

  const fetchTeacherData = async (teacherId, isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const teacherDataPromise = fetch('/api/teacher/data').then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      });

      const clinicPromise = fetch('/api/clinic/schedules').then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      }).catch(() => null);

      const [data, clinicData] = await Promise.all([teacherDataPromise, clinicPromise]);

      if (data) {
        setClientCache(`teacher_data_${teacherId}`, data);
        applyTeacherData(data);
      }
      if (clinicData) {
        const rList = clinicData.rescheduleRequests || [];
        setClinicPendingCount(rList.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ⚡ 전방위 사전 로드(Universal Prefetch)로 어떤 버튼을 눌러도 0초 즉시 전환
    try {
      router.prefetch('/board');
      router.prefetch('/board?category=NOTICE_HOMEWORK');
      router.prefetch('/qna');
      router.prefetch('/admin/dashboard');
      router.prefetch('/teacher/eval');
      router.prefetch('/teacher/eval/history');
      router.prefetch('/teacher/eval/history?tab=PARENT_REPLY');
      router.prefetch('/teacher/timer');
    } catch (e) {}

    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // ⚡ 1. 캐시가 있다면 0초 만에 대시보드 화면 즉시 복원 (뒤로가기 등)
      const cached = getClientCache(`teacher_data_${parsedUser.id}`);
      if (cached) {
        applyTeacherData(cached);
        setLoading(false);
        // 백그라운드 최신 동기화
        fetchTeacherData(parsedUser.id, false);
      } else {
        fetchTeacherData(parsedUser.id, true);
      }
      // 🎁 푸시 알림 등으로 띠부씰 장터 열기 요청 파라미터가 있을 경우
      if (typeof window !== 'undefined' && window.location.search.includes('openStickerMarket=1')) {
        setShowStickerMarketModal(true);
      }
      if (typeof window !== 'undefined' && window.location.search.includes('openAttendance=1')) {
        setShowAttendanceModal(true);
      }
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return alert('반 이름을 입력해주세요.');

    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '개설 실패');

      if (data?.id) {
        const updated = { ...classTypes, [data.id]: newClassType };
        setClassTypes(updated);
        try {
          localStorage.setItem('poom_class_types', JSON.stringify(updated));
        } catch (e) {}
      }

      alert(`[${newClassName}] 반(${newClassType === 'LECTURE' ? '판서수업' : '개별수업'})이 개설되었습니다.`);
      setNewClassName('');
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`반 개설 실패: ${err.message}`);
    }
  };

  const handleDeleteClass = async (classId, className) => {
    if (!confirm(`[${className}] 반을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');
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
      const studentsPayload = nameList.map((name, index) => ({
        name,
        phone: phoneList[index] || '',
        grade_code: batchGradeCode || undefined,
        school_name: batchSchoolName.trim() || undefined,
      }));

      const res = await fetch('/api/teacher/students/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: studentsPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '등록 실패');

      alert(`${studentsPayload.length}명의 학생 계정이 신규 등록되었습니다.`);
      setBatchNamesText('');
      setBatchPhonesText('');
      setBatchSchoolName('');
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`학생 등록 실패: ${err.message}`);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const targetTeacherId = editingStudent.teacher_id || user.id;
      const isTeacherChanged = targetTeacherId !== user.id;

      const res = await fetch(`/api/teacher/students/${editingStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingStudent.name,
          email: editingStudent.email,
          parentPhone: editingStudent.parent_phone,
          teacherId: targetTeacherId,
          schoolName: editingStudent.school_name ?? '',
          gradeCode: editingStudent.grade_code || 'H1',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '수정 실패');

      if (isTeacherChanged) {
        const targetTeacher = teachers.find((t) => t.id === targetTeacherId);
        alert(`학생 정보가 수정되었습니다.\n담당 선생님이 [${targetTeacher?.name || '선생님'}]으로 변경되어 해당 선생님의 목록으로 이전되었습니다.`);
      } else {
        alert('학생 정보가 수정되었습니다.');
      }
      setEditingStudent(null);
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    // 1. 일반 선생님인 경우: 학생 계정을 삭제하지 않고, 내 담당 반(수업)에서만 안전하게 제외(배정 해제)
    if (user?.role !== 'HEAD_TEACHER') {
      if (!confirm(`[${studentName}] 학생을 내 담당 수업(반)에서 제외하시겠습니까?\n\n※ 다른 선생님의 수업 및 학생 계정/성적 기록은 안전하게 유지됩니다.`)) {
        return;
      }
      try {
        const res = await fetch(`/api/teacher/students/${studentId}/unassign`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '제외 실패');

        alert(`[${studentName}] 학생이 내 담당 수업에서 제외되었습니다.`);
        fetchTeacherData(user.id);
      } catch (err) {
        alert(`제외 실패: ${err.message}`);
      }
      return;
    }

    // 2. 원장 선생님(HEAD_TEACHER)인 경우: 학원 전체 영구 삭제 권한
    const confirmDelete = confirm(
      `⚠️ [${studentName}] 원생을 학원에서 영구 삭제하시겠습니까?\n\n※ 삭제 시 학생 계정, 모든 반 배정 및 로그인 정보가 영구 제거됩니다.\n(내 수업에서만 제외하려면 취소 후 [반 배정]을 수정하세요)`
    );
    if (!confirmDelete) return;

    if (!confirm(`[${studentName}] 학생을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/students/${studentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');

      alert(`[${studentName}] 원생이 영구 삭제되었습니다.`);
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const handleAssignClass = async (studentId) => {
    const classId = selectedClassMap[studentId];
    if (!classId) return alert('추가 배정할 반을 선택해 주세요.');

    try {
      const res = await fetch(`/api/teacher/students/${studentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배정 실패');
      if (data.alreadyAssigned) {
        alert('이미 해당 반에 배정되어 있는 학생입니다.');
      } else {
        alert('반 추가 배정이 완료되었습니다. (기존 반 수강 내역도 함께 유지됩니다)');
      }
      setSelectedClassMap((prev) => ({ ...prev, [studentId]: '' }));
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  const handleUnassignSingleClass = async (studentId, classId, studentName, className) => {
    if (!confirm(`[${studentName}] 학생을 [${className}] 반에서만 배정 해제하시겠습니까?\n(다른 수강 중인 반은 그대로 유지됩니다)`)) {
      return;
    }
    try {
      const res = await fetch(`/api/teacher/students/${studentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, action: 'remove' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배정 해제 실패');
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`배정 해제 실패: ${err.message}`);
    }
  };

  const openClassAssignModal = (cls) => {
    setAssignTargetClass(cls);
    setAssignModalScope('MY');
    setAssignSearchQuery('');
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
      const res = await fetch('/api/teacher/class-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: assignTargetClass.id, studentIds: selectedStudentIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배정 실패');

      alert(`[${assignTargetClass.name}] 반에 ${selectedStudentIds.length}명의 학생 배정이 완료되었습니다.`);
      setAssignTargetClass(null);
      fetchTeacherData(user.id);
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    }
  };

  // 💌 교무실 대시보드에서 학부모 답장 1클릭 확인 완료 처리 (0초 낙관적 UI)
  const syncReplyCommentToCaches = (updatedMap) => {
    if (!user?.id) return;
    const cachedDashboard = getClientCache(`teacher_data_${user.id}`);
    if (cachedDashboard && Array.isArray(cachedDashboard.repliedEvaluations)) {
      setClientCache(`teacher_data_${user.id}`, {
        ...cachedDashboard,
        repliedEvaluations: cachedDashboard.repliedEvaluations.map((ev) =>
          updatedMap.has(ev.id) ? { ...ev, teacher_comment: updatedMap.get(ev.id) } : ev
        ),
      });
    }
    const cachedHistory = getClientCache(`teacher_eval_history_${user.id}`);
    if (cachedHistory && Array.isArray(cachedHistory.evaluations)) {
      setClientCache(`teacher_eval_history_${user.id}`, {
        ...cachedHistory,
        evaluations: cachedHistory.evaluations.map((ev) =>
          updatedMap.has(ev.id) ? { ...ev, teacher_comment: updatedMap.get(ev.id) } : ev
        ),
      });
    }
  };

  const handleMarkReplyCheckedOnDashboard = async (evalItem) => {
    const nowIso = new Date().toISOString();
    const prevComment = evalItem.teacher_comment;
    const updatedComment = markParentReplyCheckedInComment(prevComment, nowIso);
    const updatedMap = new Map([[evalItem.id, updatedComment]]);

    setRepliedEvaluations((prev) =>
      prev.map((ev) => (ev.id === evalItem.id ? { ...ev, teacher_comment: updatedComment } : ev))
    );
    syncReplyCommentToCaches(updatedMap);

    try {
      const res = await fetch(`/api/eval/${evalItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherComment: updatedComment }),
      });
      if (!res.ok) throw new Error('저장 실패');
    } catch (err) {
      console.error('handleMarkReplyCheckedOnDashboard error:', err);
      const revertMap = new Map([[evalItem.id, prevComment]]);
      setRepliedEvaluations((prev) =>
        prev.map((ev) => (ev.id === evalItem.id ? { ...ev, teacher_comment: prevComment } : ev))
      );
      syncReplyCommentToCaches(revertMap);
      alert('답장 확인 상태 저장 중 오류가 발생했습니다.');
    }
  };

  const handleMarkAllRepliesCheckedOnDashboard = async (unreadList) => {
    if (!unreadList || unreadList.length === 0) return;
    const nowIso = new Date().toISOString();
    const updatedMap = new Map();
    const prevMap = new Map();

    unreadList.forEach((ev) => {
      prevMap.set(ev.id, ev.teacher_comment);
      updatedMap.set(ev.id, markParentReplyCheckedInComment(ev.teacher_comment, nowIso));
    });

    setRepliedEvaluations((prev) =>
      prev.map((ev) => (updatedMap.has(ev.id) ? { ...ev, teacher_comment: updatedMap.get(ev.id) } : ev))
    );
    syncReplyCommentToCaches(updatedMap);

    try {
      const responses = await Promise.all(
        unreadList.map((ev) =>
          fetch(`/api/eval/${ev.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherComment: updatedMap.get(ev.id) }),
          })
        )
      );
      if (responses.some((r) => !r.ok)) throw new Error('일괄 저장 실패');
    } catch (err) {
      console.error('handleMarkAllRepliesCheckedOnDashboard error:', err);
      setRepliedEvaluations((prev) =>
        prev.map((ev) => (prevMap.has(ev.id) ? { ...ev, teacher_comment: prevMap.get(ev.id) } : ev))
      );
      syncReplyCommentToCaches(prevMap);
      alert('일괄 확인 처리 중 오류가 발생했습니다.');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
      교무실 대시보드 로딩 중...
    </div>
  );

  const isHeadTeacher = user?.role === 'HEAD_TEACHER';
  const unreadParentReplies = repliedEvaluations.filter((ev) => isParentReplyUnread(ev));

  return (
    <div className="min-h-screen bg-slate-100/70 pb-32 font-sans text-slate-800">
      
      {/* 📘 헤더 (모바일 2단 분리형 - 글씨 꺾임 완전 해결) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3 sm:py-4 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          
          {/* 1층: 학원 로고 + 타이틀 (좌측) / 모바일 로그아웃 (우측) */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
                onClick={() => router.push('/')}
              >
                품
              </div>
              <div>
                <h1 onClick={() => router.push('/')} className="text-base sm:text-lg font-extrabold text-slate-800 cursor-pointer leading-tight">
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

            {/* 모바일 전용 상단 우측 로그아웃 */}
            <button
              onClick={async () => { await logout(); router.push('/login'); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-xl transition md:hidden"
            >
              로그아웃
            </button>
          </div>

          {/* 2층: 액션 버튼 그룹 (모바일에서 가로로 시원하게 배치) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 md:pt-0 scrollbar-none">
            <button
              onClick={() => router.push('/teacher/scores')}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="중·고등 내신 및 모의고사 성적 추이·패인 분석 센터 열기"
            >
              <span>📈</span>
              <span>중·고등 성적 추이</span>
            </button>

            <button
              onClick={() => router.push('/teacher/timer')}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="수업 중 개별 시험 타이머 열기"
            >
              <span>⏱️</span>
              <span>시험 타이머</span>
            </button>

            <button
              onClick={handleShareKakaoLink}
              className="text-xs bg-amber-300 hover:bg-amber-400 text-amber-950 font-black px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="학부모/학생에게 카톡으로 앱 설치 링크 보내기"
            >
              <span>💬</span>
              <span>카톡 앱 초대</span>
            </button>

            <button
              onClick={() => setShowStickerMarketModal(true)}
              className="text-xs bg-rose-500 hover:bg-rose-600 text-white font-black px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="학생 띠부씰 교환 장터 열람 및 감독"
            >
              <span>🎁</span>
              <span>띠부씰 장터</span>
            </button>

            <button
              onClick={() => {
                setAttendanceTargetClassId('ALL');
                setShowAttendanceModal(true);
              }}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-black px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="반별 출석부 & 지각 관리 엑셀표 열기"
            >
              <span>📋</span>
              <span>반별 출석부</span>
            </button>

            {isHeadTeacher && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0"
              >
                👑 원장 뷰
              </button>
            )}

            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200 whitespace-nowrap shrink-0"
            >
              🔒 비밀번호 변경
            </button>

            {/* 데스크톱 전용 로그아웃 */}
            <button
              onClick={async () => { await logout(); router.push('/login'); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap hidden md:inline-block"
            >
              로그아웃
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        <PushNotificationManager user={user} />

        {/* 🎯 1. 메인 대형 액션 메뉴 */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* 카드 A: 일일 피드백 작성 */}
            <div
              onClick={() => router.push('/teacher/eval')}
              className="group relative bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-6 sm:p-7 rounded-3xl shadow-xl shadow-indigo-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start">
                <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white text-xs px-3.5 py-1 rounded-full font-bold">
                  ✍️ Daily Feedback
                </span>
                <span className="text-3xl text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">일일 학습 피드백</h2>
                <p className="text-xs text-blue-100/90 font-normal leading-relaxed">
                  오늘 수업 성취도(6대 영역) 및 출결/지각을 기록합니다.
                </p>
              </div>
            </div>

            {/* 카드 B: 반별 게시판 관리 */}
            <div
              onClick={() => router.push('/board')}
              className="group relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-indigo-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs px-3.5 py-1 rounded-full font-bold">
                  📢 Notice Board
                </span>
                <span className="text-3xl text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">공지 및 숙제 게시판</h2>
                <p className="text-xs text-slate-300 font-normal leading-relaxed">
                  숙제 알림 등록 및 학생들의 공지 확인을 체크합니다.
                </p>
              </div>
            </div>

            {/* 🎯 카드 C: 1:1 수학 질의응답 (Q&A) */}
            <div
              onClick={() => router.push('/qna')}
              className="group relative bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 text-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-amber-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start">
                <span className={`text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5 ${
                  qnaStats.pending > 0
                    ? 'bg-rose-600 text-white animate-pulse shadow-md'
                    : qnaStats.inProgress > 0
                    ? 'bg-amber-400 text-slate-900 font-extrabold shadow-md'
                    : 'bg-emerald-500/90 text-white border border-emerald-400/40 font-bold'
                }`}>
                  {qnaStats.pending > 0 && qnaStats.inProgress > 0
                    ? `🚨 미답변 ${qnaStats.pending}건`
                    : qnaStats.pending > 0
                    ? `🚨 미답변 ${qnaStats.pending}건`
                    : qnaStats.inProgress > 0
                    ? `💬 확인 중 ${qnaStats.inProgress}건`
                    : '💡 Q&A 완료'}
                </span>
                <span className="text-3xl text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">1:1 질의응답 (Q&A)</h2>
                <p className="text-xs text-amber-100 font-normal leading-relaxed">
                  학생들이 올린 문제 질문에 1:1 풀이 답변을 남깁니다.
                </p>
              </div>
            </div>

            {/* ⏰ 카드 D: 클리닉 시간 관리 */}
            <div
              onClick={() => setShowClinicModal(true)}
              className="group relative bg-gradient-to-br from-purple-700 via-indigo-800 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-indigo-950/10 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start">
                <span className={`text-xs px-3.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  clinicPendingCount > 0
                    ? 'bg-rose-600 text-white font-black animate-pulse shadow-md'
                    : 'bg-white/20 backdrop-blur-md border border-white/20 text-white'
                }`}>
                  {clinicPendingCount > 0 ? `🚨 변경 요청 ${clinicPendingCount}건` : '⏰ Clinic'}
                </span>
                <span className="text-3xl text-purple-200 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
              </div>

              <div className="mt-8 space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">클리닉 시간 관리</h2>
                <p className="text-xs text-purple-100 font-normal leading-relaxed">
                  {clinicPendingCount > 0
                    ? `학생의 시간 변경 요청이 대기 중입니다. 클릭하여 승인하세요.`
                    : '클리닉 일정 개설 및 학생별 예약 시간표를 관리합니다.'}
                </p>
              </div>
            </div>

          </div>

          {/* 💌 미확인 학부모 피드백 답장 도착 알림 배너 */}
          {unreadParentReplies.length > 0 && (
            <div className="bg-gradient-to-r from-rose-50 via-amber-50/80 to-rose-50 border-2 border-rose-300 rounded-3xl p-4 sm:p-5 shadow-md space-y-3.5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-xl shadow-xs shrink-0 animate-bounce">
                    💌
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-rose-950">
                        미확인 학부모 피드백 답장 {unreadParentReplies.length}건이 도착했습니다!
                      </h3>
                      <span className="text-[11px] font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                        NEW 미확인 {unreadParentReplies.length}건
                      </span>
                    </div>
                    <p className="text-xs text-rose-800/90 font-semibold mt-0.5">
                      학부모님께서 일일 피드백 리포트에 남기신 소중한 답장입니다. 확인 완료를 체크하거나 답장 모아보기에서 전체 내역을 확인하세요.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMarkAllRepliesCheckedOnDashboard(unreadParentReplies)}
                    className="text-xs font-black bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 px-3.5 py-2 rounded-xl transition shadow-2xs cursor-pointer"
                  >
                    ✓ 미확인 {unreadParentReplies.length}건 모두 확인 완료
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/teacher/eval/history?tab=PARENT_REPLY')}
                    className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💌 답장 모아보기 ({unreadParentReplies.length})</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* 미확인 답장 미리보기 리스트 (최대 3건) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {unreadParentReplies.slice(0, 3).map((ev) => {
                  const studentName = ev.users?.name || students.find((s) => s.id === ev.student_id)?.name || '학생';
                  return (
                    <div
                      key={ev.id}
                      className="bg-white/95 border border-rose-200 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-black text-slate-900 truncate">{studentName} 학부모님</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                              {ev.eval_date} 수업
                            </span>
                          </div>
                          {ev.parent_reply_at && (
                            <span className="text-[10px] font-bold text-rose-600 shrink-0">
                              {new Date(ev.parent_reply_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 답장
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-700 line-clamp-2 whitespace-pre-wrap leading-relaxed bg-rose-50/50 px-2.5 py-2 rounded-xl border border-rose-100">
                          &ldquo;{ev.parent_reply}&rdquo;
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => router.push('/teacher/eval/history?tab=PARENT_REPLY')}
                          className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                        >
                          상세 리포트 보기 →
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkReplyCheckedOnDashboard(ev)}
                          className="text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
                        >
                          ✓ 확인 완료 체크
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {unreadParentReplies.length > 3 && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => router.push('/teacher/eval/history?tab=PARENT_REPLY')}
                    className="text-xs font-black text-rose-700 hover:underline cursor-pointer"
                  >
                    + 외 {unreadParentReplies.length - 3}건의 미확인 답장 더 보기 →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 📈 중·고등 수학 내신·모의고사 성적 추이 & 패인 분석 배너 + 피드백 내역 바로가기 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div
              onClick={() => router.push('/teacher/scores')}
              className="flex-1 bg-gradient-to-r from-indigo-900 via-indigo-800 to-emerald-900 text-white px-5 py-3.5 rounded-2xl shadow-md cursor-pointer hover:opacity-95 transition flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📈</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">
                      중·고등 내신 · 모의고사 성적 추이 & 패인 분석 센터
                    </span>
                    <span className="text-[10px] bg-emerald-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                      NEW
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-100/90 font-medium">
                    중등 성취도(A~E)·고교 환산 등급 · 고등 내신/모의고사 등급 · 오답 패인 진단 및 맞춤 처방
                  </p>
                </div>
              </div>
              <span className="text-lg font-black text-white/80 shrink-0">열기 →</span>
            </div>

            <button
              onClick={() =>
                router.push(
                  unreadParentReplies.length > 0
                    ? '/teacher/eval/history?tab=PARENT_REPLY'
                    : '/teacher/eval/history'
                )
              }
              className={`w-full sm:w-auto text-xs px-4 py-3.5 rounded-2xl font-extrabold transition shadow-xs flex items-center justify-between sm:justify-center gap-2.5 shrink-0 cursor-pointer ${
                unreadParentReplies.length > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 ring-2 ring-rose-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
              }`}
            >
              <span className="whitespace-nowrap truncate">📋 피드백 내역 · 학부모 답장 보기</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {unreadParentReplies.length > 0 ? (
                  <span className="bg-white text-rose-700 text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse whitespace-nowrap shrink-0">
                    💌 미확인 {unreadParentReplies.length}건
                  </span>
                ) : repliedEvaluations.length > 0 ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    💌 답장 {repliedEvaluations.length}건
                  </span>
                ) : null}
                <span className="shrink-0">→</span>
              </div>
            </button>
          </div>
        </section>

        {/* 🏫 2. 내 담당 반 관리 */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>🏫</span> 내 담당 반 관리
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100 whitespace-nowrap shrink-0">
                총 {classes.length}개 반
              </span>
            </div>
            <p className="text-xs text-slate-400">반을 개설하거나 내 반의 학생들을 지정해 일괄 배정하세요.</p>
          </div>

          <form onSubmit={handleCreateClass} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="신규 반 이름 입력 (예: 중3 심화A반)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="flex-1 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
              />
              <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setNewClassType('LECTURE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                    newClassType === 'LECTURE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👥 판서수업</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewClassType('INDIVIDUAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                    newClassType === 'INDIVIDUAL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👤 개별수업</span>
                </button>
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-sm transition whitespace-nowrap"
              >
                + 반 개설
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pl-1">
              💡 {newClassType === 'LECTURE' ? '판서수업: 반 전체가 동일한 공통 진도 및 과제를 수행합니다. (피드백 일괄 작성 지원)' : '개별수업: 학생마다 개별 맞춤 진도와 과제를 다르게 부여합니다.'}
            </p>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {classes.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 col-span-full">개설된 반이 없습니다. 반을 추가해 주세요.</p>
            ) : (
              classes.map((cls) => {
                const count = classStudents.filter((cs) => String(cs.class_id) === String(cls.id)).length;
                const currentType = classTypes[cls.id] || 'LECTURE';

                return (
                  <div
                    key={cls.id}
                    className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between space-y-3 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-extrabold text-slate-800 block">📘 {cls.name}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleClassType(cls.id)}
                          className={`mt-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border transition flex items-center gap-1 ${
                            currentType === 'LECTURE'
                              ? 'bg-indigo-100/80 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                              : 'bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                          }`}
                          title="클릭하여 수업 방식을 전환할 수 있습니다"
                        >
                          <span>{currentType === 'LECTURE' ? '👥 판서수업' : '👤 개별수업'}</span>
                          <span className="text-[10px] text-slate-400">🔄</span>
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                        className="text-xs text-rose-500 font-bold hover:underline"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                      <span className="text-xs text-slate-500 font-bold">소속 학생: <span className="text-indigo-600 font-extrabold">{count}명</span></span>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setAttendanceTargetClassId(cls.id);
                            setShowAttendanceModal(true);
                          }}
                          className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs px-2.5 py-1.5 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                          title={`[${cls.name}] 출석부 엑셀표 열기`}
                        >
                          <span>📋</span>
                          <span>출석부</span>
                        </button>
                        <button
                          onClick={() => openClassAssignModal(cls)}
                          className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer"
                        >
                          + 학생 지정 배정
                        </button>
                      </div>
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
              <p className="font-bold text-amber-900">💡 엑셀 복사/붙여넣기 및 학년 설정 안내:</p>
              <p>• 1명 등록 시: 아래에서 <span className="font-bold text-slate-900">학년(중1~고3)</span>과 <span className="font-bold text-slate-900">학교명</span>을 선택한 뒤 이름과 연락처를 입력해 주세요.</p>
              <p>• 엑셀 붙여넣기 시: 엑셀의 <span className="font-bold text-slate-900">[학생 이름 열]</span>과 <span className="font-bold text-slate-900">[학부모 연락처 열]</span>을 각각 복사(Ctrl+C)하여 붙여넣으세요. (학년은 등록 후 개별 수정도 가능합니다)</p>
            </div>

            {/* 신규 등록 시 기본 학년(중1~고3) 및 학교명 선택 바 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  🎓 학년 구분 (선택 시 성적표 모드 자동 연동)
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { code: '', label: '미지정' },
                    { code: 'M1', label: '중1' },
                    { code: 'M2', label: '중2' },
                    { code: 'M3', label: '중3' },
                    { code: 'H1', label: '고1' },
                    { code: 'H2', label: '고2' },
                    { code: 'H3', label: '고3' },
                  ].map((opt) => {
                    const active = batchGradeCode === opt.code;
                    const isMiddle = opt.code.startsWith('M');
                    return (
                      <button
                        key={opt.code || 'NONE'}
                        type="button"
                        onClick={() => setBatchGradeCode(opt.code)}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition whitespace-nowrap ${
                          active
                            ? isMiddle
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : opt.code
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  🏫 재학 학교명 (선택사항 · 나중에 입력 가능)
                </label>
                <input
                  type="text"
                  placeholder="예: 서현중, 내정중, 분당고, 낙생고"
                  value={batchSchoolName}
                  onChange={(e) => setBatchSchoolName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>👥</span> 내 담당 학생 목록 ({students.length}명)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">학생 개별 학년(중1~고3)·학교 수정 및 개별 반 변경이 가능합니다.</p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: '전체' },
                { id: 'MIDDLE', label: '중등 (중1~중3)' },
                { id: 'HIGH', label: '고등 (고1~고3)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStudentGradeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition whitespace-nowrap ${
                    studentGradeFilter === tab.id
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {students.filter((st) => {
              if (studentGradeFilter === 'ALL') return true;
              if (studentGradeFilter === 'MIDDLE') return st.school_level === 'MIDDLE';
              if (studentGradeFilter === 'HIGH') return st.school_level !== 'MIDDLE';
              return st.grade_code === studentGradeFilter;
            }).length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">해당 조건의 학생이 없습니다.</p>
            ) : (
              students
                .filter((st) => {
                  if (studentGradeFilter === 'ALL') return true;
                  if (studentGradeFilter === 'MIDDLE') return st.school_level === 'MIDDLE';
                  if (studentGradeFilter === 'HIGH') return st.school_level !== 'MIDDLE';
                  return st.grade_code === studentGradeFilter;
                })
                .map((st) => {
                  const myAssignedClasses = classStudents
                    .filter((cs) => cs.student_id === st.id)
                    .map((cs) => classes.find((c) => String(c.id) === String(cs.class_id)))
                    .filter(Boolean);
                  const myAssignedClassIds = new Set(myAssignedClasses.map((c) => String(c.id)));

                  const otherAssignedClasses = allClassStudents
                    .filter((cs) => cs.student_id === st.id && !myAssignedClassIds.has(String(cs.class_id)))
                    .map((cs) => {
                      const cls = allClasses.find((c) => String(c.id) === String(cs.class_id));
                      if (!cls || cls.teacher_id === user?.id) return null;
                      const tName = teachers.find((t) => t.id === cls.teacher_id)?.name || '타선생님';
                      return { ...cls, teacherName: tName };
                    })
                    .filter(Boolean);

                  const availableMyClasses = classes.filter((c) => !myAssignedClassIds.has(String(c.id)));
                  const isMiddle = st.school_level === 'MIDDLE';
                  const displayGradeBadge = st.grade_label || (st.school_name ? `${isMiddle ? '중' : '고'}${st.school_grade || 1}` : '');

                  return (
                    <div
                      key={st.id}
                      className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-800">{st.name}</span>
                          {(displayGradeBadge || st.school_name) && (
                            <span
                              className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] border whitespace-nowrap ${
                                isMiddle
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {[displayGradeBadge, st.school_name].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          <span className="text-slate-400 text-xs font-semibold">({st.email})</span>

                          {st.teacher_id && st.teacher_id !== user?.id && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              타반 겸임 수강생 (주담당: {teachers.find((t) => t.id === st.teacher_id)?.name || '선생님'}T)
                            </span>
                          )}

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

                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span className="text-slate-500 font-bold mr-0.5">수강 반({myAssignedClasses.length + otherAssignedClasses.length}):</span>
                          {myAssignedClasses.length === 0 && otherAssignedClasses.length === 0 ? (
                            <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-0.5 rounded-full font-bold">
                              미배정
                            </span>
                          ) : (
                            <>
                              {myAssignedClasses.map((cls) => (
                                <span
                                  key={cls.id}
                                  className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 pl-2.5 pr-1.5 py-0.5 rounded-full font-extrabold"
                                >
                                  <span>📘 {cls.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUnassignSingleClass(st.id, cls.id, st.name, cls.name)}
                                    className="w-4 h-4 rounded-full bg-indigo-100 hover:bg-rose-500 hover:text-white text-indigo-600 text-[10px] font-black flex items-center justify-center transition cursor-pointer"
                                    title={`[${cls.name}] 반에서만 배정 해제`}
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                              {otherAssignedClasses.map((cls) => (
                                <span
                                  key={cls.id}
                                  className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]"
                                  title="다른 선생님 반에서 동시 수강 중인 수업입니다"
                                >
                                  <span>🟣 [{cls.teacherName}T] {cls.name}</span>
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <select
                          value={selectedClassMap[st.id] || ''}
                          onChange={(e) => setSelectedClassMap({ ...selectedClassMap, [st.id]: e.target.value })}
                          className="p-2 border rounded-xl text-xs font-bold text-slate-700 bg-white"
                        >
                          <option value="">
                            {availableMyClasses.length > 0 ? '+ 반 추가 선택...' : '모든 내 반 배정됨'}
                          </option>
                          {availableMyClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleAssignClass(st.id)}
                          disabled={availableMyClasses.length === 0}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-3 py-2 rounded-xl text-xs transition whitespace-nowrap shadow-xs cursor-pointer"
                          title="기존 반을 유지하면서 선택한 반(특강 등)을 추가로 배정합니다"
                        >
                          + 반 추가
                        </button>

                        <button
                          onClick={() =>
                            setEditingStudent({
                              ...st,
                              grade_code:
                                st.grade_code ||
                                `${st.school_level === 'MIDDLE' ? 'M' : 'H'}${st.school_grade || 1}`,
                            })
                          }
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition whitespace-nowrap"
                        >
                          수정
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(st.id, st.name)}
                          className="text-rose-500 hover:text-rose-700 hover:underline font-bold px-1 text-xs cursor-pointer"
                          title={isHeadTeacher ? '원생을 학원에서 영구 삭제합니다' : '내 담당 수업에서 이 학생을 제외합니다 (학생 계정 유지)'}
                        >
                          {isHeadTeacher ? '삭제' : '제외'}
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

      {/* 🎯 모달 1: 반 학생 일괄 배정 (내 담당 학생 + 타 선생님 학생 특강 겸임 배정 지원) */}
      {assignTargetClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  📘 [{assignTargetClass.name}] 반 학생 일괄 배정
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  내 담당 학생뿐만 아니라 다른 선생님 반 학생도 특강/겸임 수업으로 함께 배정할 수 있습니다.
                </p>
              </div>
              <button onClick={() => setAssignTargetClass(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>

            {/* 범위 전환 탭: 내 담당 학생 vs 학원 전체 원생 (타 강사 학생 포함) */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAssignModalScope('MY')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition ${
                  assignModalScope === 'MY'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👤 내 담당 학생 ({students.length}명)
              </button>
              <button
                type="button"
                onClick={() => setAssignModalScope('ALL_ACADEMY')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition ${
                  assignModalScope === 'ALL_ACADEMY'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🌐 학원 전체 원생 ({allAcademyStudents.length}명 · 타반 특강 배정)
              </button>
            </div>

            {/* 이름 / 학교 / 학년 검색창 */}
            <div>
              <input
                type="text"
                placeholder="🔍 학생 이름, 학교명, 학년(예: 중3, 고1)으로 빠른 검색..."
                value={assignSearchQuery}
                onChange={(e) => setAssignSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {(() => {
                const basePool = assignModalScope === 'ALL_ACADEMY' ? allAcademyStudents : students;
                const q = assignSearchQuery.trim().toLowerCase();
                const filteredPool = q
                  ? basePool.filter(
                      (st) =>
                        (st.name || '').toLowerCase().includes(q) ||
                        (st.school_name || '').toLowerCase().includes(q) ||
                        (st.grade_label || '').toLowerCase().includes(q) ||
                        (st.email || '').toLowerCase().includes(q)
                    )
                  : basePool;

                if (filteredPool.length === 0) {
                  return (
                    <div className="py-6 text-center space-y-2">
                      <p className="text-xs text-slate-400 font-bold">검색 조건에 맞는 학생이 없습니다.</p>
                      {assignModalScope === 'MY' && (
                        <button
                          type="button"
                          onClick={() => setAssignModalScope('ALL_ACADEMY')}
                          className="text-xs font-extrabold text-purple-600 hover:underline"
                        >
                          🌐 다른 선생님 반 학생인가요? [학원 전체 원생] 탭에서 찾기 →
                        </button>
                      )}
                    </div>
                  );
                }

                return filteredPool.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  const isOtherTeacherPrimary = st.teacher_id && st.teacher_id !== user?.id;
                  const primaryTeacherName = teachers.find((t) => t.id === st.teacher_id)?.name || '선생님';
                  const enrolledClassesForSt = allClassStudents
                    .filter((cs) => cs.student_id === st.id && String(cs.class_id) !== String(assignTargetClass.id))
                    .map((cs) => allClasses.find((c) => String(c.id) === String(cs.class_id))?.name)
                    .filter(Boolean);

                  return (
                    <label
                      key={st.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                        isChecked ? 'bg-indigo-50/80 border-indigo-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudentSelection(st.id)}
                          className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800">{st.name}</span>
                            {(st.grade_label || st.school_name) && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                                {[st.grade_label, st.school_name].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            {isOtherTeacherPrimary && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                주담당: {primaryTeacherName}T
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] text-slate-400">{st.email}</span>
                            {enrolledClassesForSt.length > 0 && (
                              <span className="text-[10px] font-bold text-indigo-600">
                                · 타 수업 수강중: {enrolledClassesForSt.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isChecked && (
                        <span className="text-xs font-bold text-indigo-600 shrink-0 ml-2">선택됨 ✓</span>
                      )}
                    </label>
                  );
                });
              })()}
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl text-xs font-bold">
              <span className="text-slate-600">이 반에 배정될 총 학생:</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">🎓 학년 구분 (중1~고3)</label>
                  <select
                    value={
                      editingStudent.grade_code ||
                      `${editingStudent.school_level === 'MIDDLE' ? 'M' : 'H'}${editingStudent.school_grade || 1}`
                    }
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, grade_code: e.target.value })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <optgroup label="중학교 (성취도 A~E + 고교 환산)">
                      <option value="M1">중학교 1학년 (중1)</option>
                      <option value="M2">중학교 2학년 (중2)</option>
                      <option value="M3">중학교 3학년 (중3)</option>
                    </optgroup>
                    <optgroup label="고등학교 (내신·모의고사 등급)">
                      <option value="H1">고등학교 1학년 (고1 · 5등급제)</option>
                      <option value="H2">고등학교 2학년 (고2 · 9등급제)</option>
                      <option value="H3">고등학교 3학년 (고3 · 9등급제)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">🏫 재학 학교명</label>
                  <input
                    type="text"
                    placeholder="예: 서현중, 분당고"
                    value={editingStudent.school_name || ''}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, school_name: e.target.value })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
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

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">👨‍🏫 직속 담당 선생님 (Q&A 및 관리)</label>
                <select
                  value={editingStudent.teacher_id || user.id}
                  onChange={(e) => setEditingStudent({ ...editingStudent, teacher_id: e.target.value })}
                  className="w-full p-3 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.role === 'HEAD_TEACHER' ? '👑' : '👨‍🏫'} {t.name} 선생님 {t.id === user.id ? '(현재 본인)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">
                  💡 담당 선생님을 변경하면 해당 선생님 교무실로 학생이 인계되며, 1:1 Q&A 질문도 변경된 선생님께 전송됩니다. (과거 작성된 평가/피드백 데이터는 100% 보존됩니다)
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
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-bold shadow-md transition"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⏰ 모달 5: 주말 클리닉 시간표 및 예약 관리 모달 */}
      {showClinicModal && user && (
        <TeacherClinicModal
          user={user}
          students={students}
          classes={classes}
          classStudents={classStudents}
          onClose={() => {
            setShowClinicModal(false);
            if (user?.id) fetchTeacherData(user.id);
          }}
        />
      )}

      {/* 🔒 모달 4: 비밀번호 변경 모달 */}
      {showPasswordModal && user && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowPasswordModal(false)}
          onPasswordUpdated={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {/* 🎁 모달: 띠부씰 장터 (선생님 감독 뷰) */}
      {showStickerMarketModal && user && (
        <StudentStickerMarketModal
          user={user}
          onClose={() => setShowStickerMarketModal(false)}
        />
      )}

      {/* 📋 모달: 반별 출석부 & 지각 관리 엑셀표 */}
      {showAttendanceModal && user && (
        <ClassAttendanceModal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          initialClassId={attendanceTargetClassId}
          classes={classes}
          students={students}
          user={user}
        />
      )}

    </div>
  );
}