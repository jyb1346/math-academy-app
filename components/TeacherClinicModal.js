'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  timeToMinutes,
  minutesToTime,
  generateTimePoints,
  formatDurationLabel,
  generateIntervalsWithAvailability,
  blocksToRanges,
  formatRangesSummary,
  checkMultipleRangesCapacity,
} from '@/lib/clinicUtils';

export default function TeacherClinicModal({ user, students = [], classes = [], onClose }) {
  const [activeTab, setActiveTab] = useState('TIMETABLE'); // 'TIMETABLE' | 'CREATE'
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tableNotCreated, setTableNotCreated] = useState(false);

  // 뷰 모드 (타임테이블 뷰 vs 명단 테이블 뷰)
  const [viewMode, setViewMode] = useState('TIMELINE'); // 'TIMELINE' | 'LIST'

  // 신규 일정 생성 폼 상태
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    // 다음 토요일 날짜 기본 계산
    const day = d.getDay();
    const diff = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  });
  const [newTitle, setNewTitle] = useState('클리닉 시간');
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('18:00');
  const [isUnlimitedCapacity, setIsUnlimitedCapacity] = useState(true);
  const [newMaxCapacity, setNewMaxCapacity] = useState(6);
  const [newNotice, setNewNotice] = useState('질문할 교재 및 오답노트를 지참해 주세요.');
  const [sendPushOnCreate, setSendPushOnCreate] = useState(true);

  // 🎯 신청 대상 설정 상태 ('TEACHER_STUDENTS' | 'CLASS' | 'STUDENTS')
  const [targetType, setTargetType] = useState('TEACHER_STUDENTS');
  const [targetClassId, setTargetClassId] = useState('');
  const [targetClassIds, setTargetClassIds] = useState([]);
  const [targetStudentIds, setTargetStudentIds] = useState([]);
  const [studentSearchKeyword, setStudentSearchKeyword] = useState('');
  const [showUnbookedList, setShowUnbookedList] = useState(false);

  // 학생 대리 등록 모달 상태 (30분 단위 다중/분리 블록 선택 지원)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [proxyStudentId, setProxyStudentId] = useState('');
  const [proxySelectedBlocks, setProxySelectedBlocks] = useState([]);
  const [proxySubject, setProxySubject] = useState('');

  // 대상 학생 검색 필터링 목록
  const filteredStudentsForTarget = useMemo(() => {
    if (!studentSearchKeyword.trim()) return students;
    const kw = studentSearchKeyword.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(kw) ||
        s.parent_phone?.includes(kw) ||
        s.email?.toLowerCase().includes(kw)
    );
  }, [students, studentSearchKeyword]);

  // 일정 목록 및 예약 데이터 불러오기
  const fetchClinicData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clinic/schedules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '조회 실패');

      if (data.tableNotCreated) {
        setTableNotCreated(true);
        setSchedules([]);
        return;
      }

      setTableNotCreated(false);
      setSchedules(data.schedules || []);

      if (data.schedules && data.schedules.length > 0) {
        if (!selectedScheduleId || !data.schedules.some((s) => s.id === selectedScheduleId)) {
          setSelectedScheduleId(data.schedules[0].id);
        }
      } else {
        setSelectedScheduleId(null);
        setActiveTab('CREATE');
      }
    } catch (err) {
      console.error('fetchClinicData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinicData();
  }, []);

  // 현재 선택된 일정
  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.id === selectedScheduleId) || schedules[0] || null;
  }, [schedules, selectedScheduleId]);

  // 🎯 현재 일정의 대상 학생 목록 계산
  const scheduleTargetStudents = useMemo(() => {
    if (!currentSchedule) return [];
    const type = currentSchedule.target_type || 'TEACHER_STUDENTS';

    if (type === 'STUDENTS') {
      const ids = Array.isArray(currentSchedule.target_student_ids)
        ? currentSchedule.target_student_ids
        : [];
      return students.filter((s) => ids.includes(s.id));
    }

    if (type === 'CLASS') {
      let classIds = [];
      if (Array.isArray(currentSchedule.target_class_ids)) {
        classIds = currentSchedule.target_class_ids;
      } else if (typeof currentSchedule.target_class_ids === 'string') {
        try {
          classIds = JSON.parse(currentSchedule.target_class_ids);
        } catch {
          classIds = [currentSchedule.target_class_ids];
        }
      }
      if (currentSchedule.target_class_id && !classIds.includes(currentSchedule.target_class_id)) {
        classIds.push(currentSchedule.target_class_id);
      }
      if (classIds.length === 0) return students;
      return students.filter((s) => classIds.includes(s.class_id));
    }

    return students;
  }, [currentSchedule, students]);

  // 🎯 현재 유효 예약이 있는 고유 학생 ID Set
  const bookedStudentIdSet = useMemo(() => {
    if (!currentSchedule) return new Set();
    const validBookings = (currentSchedule.bookings || []).filter((b) => b.status !== 'CANCELLED');
    return new Set(validBookings.map((b) => b.student_id));
  }, [currentSchedule]);

  // 🎯 미신청 학생 목록
  const unbookedStudents = useMemo(() => {
    return scheduleTargetStudents.filter((s) => !bookedStudentIdSet.has(s.id));
  }, [scheduleTargetStudents, bookedStudentIdSet]);

  // 신규 일정 생성 핸들러
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!newDate) return alert('날짜를 선택해 주세요.');

    if (targetType === 'CLASS' && targetClassIds.length === 0 && !targetClassId) {
      return alert('대상 반을 1개 이상 선택해 주세요.');
    }
    if (targetType === 'STUDENTS' && targetStudentIds.length === 0) {
      return alert('클리닉 대상 학생을 1명 이상 선택해 주세요.');
    }

    try {
      setSubmitting(true);
      const selectedClassIds = targetClassIds.length > 0 ? targetClassIds : (targetClassId ? [targetClassId] : []);
      const res = await fetch('/api/clinic/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          title: newTitle,
          startTime: newStartTime,
          endTime: newEndTime,
          slotIntervalMinutes: 30,
          durationMinutes: 120,
          maxCapacity: isUnlimitedCapacity ? null : Number(newMaxCapacity),
          targetType,
          targetClassId: targetType === 'CLASS' ? selectedClassIds[0] || null : null,
          targetClassIds: targetType === 'CLASS' ? selectedClassIds : [],
          targetStudentIds: targetType === 'STUDENTS' ? targetStudentIds : [],
          notice: newNotice,
          sendPush: sendPushOnCreate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일정 개설 실패');

      alert('🎉 클리닉 일정이 성공적으로 개설되었습니다!');
      setActiveTab('TIMETABLE');
      setTargetStudentIds([]);
      setTargetClassIds([]);
      setTargetClassId('');
      await fetchClinicData();
      if (data.schedule?.id) {
        setSelectedScheduleId(data.schedule.id);
      }
    } catch (err) {
      alert(`개설 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 학생 출석 상태 변경 핸들러
  const handleUpdateBookingStatus = async (bookingId, nextStatus) => {
    try {
      const res = await fetch(`/api/clinic/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '상태 변경 실패');

      await fetchClinicData();
    } catch (err) {
      alert(`상태 변경 실패: ${err.message}`);
    }
  };

  // 예약 취소 핸들러
  const handleDeleteBooking = async (bookingId, studentName) => {
    if (!confirm(`[${studentName}] 학생의 클리닉 예약을 취소하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/clinic/bookings/${bookingId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '취소 실패');

      alert('예약이 취소되었습니다.');
      await fetchClinicData();
    } catch (err) {
      alert(`취소 실패: ${err.message}`);
    }
  };

  // 일정 마감/오픈 토글
  const handleToggleScheduleActive = async () => {
    if (!currentSchedule) return;
    const nextActive = !currentSchedule.is_active;
    const actionLabel = nextActive ? '다시 오픈' : '신청 마감';

    if (!confirm(`[${currentSchedule.date}] 클리닉을 ${actionLabel} 처리하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/clinic/schedules/${currentSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '처리 실패');

      alert(`클리닉 일정이 ${actionLabel}되었습니다.`);
      await fetchClinicData();
    } catch (err) {
      alert(`처리 실패: ${err.message}`);
    }
  };

  // 일정 영구 삭제
  const handleDeleteSchedule = async () => {
    if (!currentSchedule) return;
    if (!confirm(`⚠️ [${currentSchedule.date}] 클리닉 일정과 모든 학생 예약 내역을 영구 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/clinic/schedules/${currentSchedule.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');

      alert('클리닉 일정이 삭제되었습니다.');
      await fetchClinicData();
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 🎯 학생 대리 등록 모달 열기 핸들러 (선택 학생의 기존 예약 불러오기 또는 기본 2시간)
  const handleOpenProxyModal = (studentId = '') => {
    const sId = studentId || (unbookedStudents[0]?.id || students[0]?.id || '');
    setProxyStudentId(sId);
    setProxySubject('');

    const existing = (currentSchedule?.bookings || []).filter(
      (b) => b.student_id === sId && b.status !== 'CANCELLED'
    );
    if (existing.length > 0) {
      const blocks = [];
      let exSub = '';
      existing.forEach((b) => {
        const startM = timeToMinutes(b.start_time);
        const endM = timeToMinutes(b.end_time);
        for (let m = startM; m < endM; m += 30) {
          blocks.push(minutesToTime(m));
        }
        if (b.subject && !exSub) exSub = b.subject;
      });
      setProxySelectedBlocks([...new Set(blocks)]);
      if (exSub) setProxySubject(exSub);
    } else {
      const initStartM = timeToMinutes(currentSchedule?.start_time || '10:00');
      const schedEndM = timeToMinutes(currentSchedule?.end_time || '18:00');
      const blocks = [];
      for (let m = initStartM; m < Math.min(initStartM + 120, schedEndM); m += 30) {
        blocks.push(minutesToTime(m));
      }
      setProxySelectedBlocks(blocks.length > 0 ? blocks : [currentSchedule?.start_time || '10:00']);
    }
    setShowAddStudentModal(true);
  };

  const handleProxyStudentChange = (sId) => {
    setProxyStudentId(sId);
    const existing = (currentSchedule?.bookings || []).filter(
      (b) => b.student_id === sId && b.status !== 'CANCELLED'
    );
    if (existing.length > 0) {
      const blocks = [];
      let exSub = '';
      existing.forEach((b) => {
        const startM = timeToMinutes(b.start_time);
        const endM = timeToMinutes(b.end_time);
        for (let m = startM; m < endM; m += 30) {
          blocks.push(minutesToTime(m));
        }
        if (b.subject && !exSub) exSub = b.subject;
      });
      setProxySelectedBlocks([...new Set(blocks)]);
      if (exSub) setProxySubject(exSub);
    }
  };

  // 대리 등록 시 30분 단위 블록 및 현황
  const proxyIntervals = useMemo(() => {
    if (!currentSchedule) return [];
    return generateIntervalsWithAvailability(
      currentSchedule.start_time,
      currentSchedule.end_time,
      currentSchedule.bookings || [],
      currentSchedule.max_capacity,
      proxyStudentId || user.id
    );
  }, [currentSchedule, proxyStudentId, user.id]);

  const proxyRanges = useMemo(() => {
    return blocksToRanges(proxySelectedBlocks);
  }, [proxySelectedBlocks]);

  const proxyTotalMinutes = useMemo(() => {
    return proxyRanges.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
  }, [proxyRanges]);

  const proxySummaryText = useMemo(() => {
    return formatRangesSummary(proxyRanges);
  }, [proxyRanges]);

  const handleToggleProxyBlock = (blockStartTime) => {
    setProxySelectedBlocks((prev) => {
      if (prev.includes(blockStartTime)) {
        return prev.filter((t) => t !== blockStartTime);
      } else {
        return [...prev, blockStartTime];
      }
    });
  };

  // 선생님 대리 학생 등록 submit
  const handleProxyAddStudent = async (e) => {
    e.preventDefault();
    if (!proxyStudentId) return alert('배정할 학생을 선택해 주세요.');
    if (!currentSchedule) return;
    if (proxyRanges.length === 0 || proxyTotalMinutes <= 0) {
      return alert('배정할 시간 블록을 1개 이상 선택해 주세요.');
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/clinic/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: currentSchedule.id,
          studentId: proxyStudentId,
          ranges: proxyRanges,
          selectedBlocks: proxySelectedBlocks,
          subject: proxySubject,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배정 실패');

      alert('학생이 성공적으로 클리닉에 배정되었습니다.');
      setShowAddStudentModal(false);
      setProxyStudentId('');
      setProxySubject('');
      setProxySelectedBlocks([]);
      await fetchClinicData();
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 📲 미신청 학생들에게 클리닉 신청 안내 푸시 알림 발송 (선생님 전용)
  const handleSendUnbookedClinicReminder = async () => {
    if (!currentSchedule || unbookedStudents.length === 0) {
      return alert('미신청 학생이 없습니다.');
    }
    if (!confirm(`[${currentSchedule.date} ${currentSchedule.title}]\n아직 클리닉을 신청하지 않은 학생 ${unbookedStudents.length}명에게 신청 안내 푸시 알림을 발송하시겠습니까?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/clinic/schedules/${currentSchedule.id}/remind`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발송 실패');
      alert(`📢 미신청 학생 ${data.sentCount || unbookedStudents.length}명에게 클리닉 신청 안내 푸시 알림을 발송했습니다!`);
    } catch (err) {
      alert(`알림 발송 실패: ${err.message}`);
    }
  };

  // 카카오톡/단톡방 공유용 텍스트 복사 (학생별 그룹핑 및 통합 시간 출력)
  const handleCopyKakaoSummary = () => {
    if (!currentSchedule) return;
    const bookings = (currentSchedule.bookings || []).filter((b) => b.status !== 'CANCELLED');

    // 학생별로 그룹화
    const studentMap = new Map();
    bookings.forEach((b) => {
      const sId = b.student_id;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          name: b.users?.name || '학생',
          bookings: [],
          subjects: [],
        });
      }
      const entry = studentMap.get(sId);
      entry.bookings.push(b);
      if (b.subject && !entry.subjects.includes(b.subject)) {
        entry.subjects.push(b.subject);
      }
    });

    const studentList = Array.from(studentMap.values());
    studentList.sort((a, b) => {
      const minA = Math.min(...a.bookings.map((x) => timeToMinutes(x.start_time)));
      const minB = Math.min(...b.bookings.map((x) => timeToMinutes(x.start_time)));
      return minA - minB;
    });

    let text = `[품수학 ⏰ ${currentSchedule.date} 클리닉 시간표]\n`;
    text += `운영시간: ${currentSchedule.start_time} ~ ${currentSchedule.end_time}\n`;
    text += `총 신청 인원: ${studentList.length}명\n\n`;

    studentList.forEach((s) => {
      const timeRanges = s.bookings
        .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
        .map((b) => `${b.start_time}~${b.end_time}`);
      const totalDur = s.bookings.reduce((acc, b) => acc + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)), 0);
      const subject = s.subjects.length > 0 ? ` (${s.subjects.join(', ')})` : '';
      text += `▪️ ${s.name} : ${timeRanges.join(' + ')} (${formatDurationLabel(totalDur)})${subject}\n`;
    });

    if (currentSchedule.notice) {
      text += `\n📝 안내사항: ${currentSchedule.notice}`;
    }

    navigator.clipboard.writeText(text).then(() => {
      alert('💬 카카오톡 단톡방 공유용 클리닉 시간표가 복사되었습니다!\n원하는 곳에 붙여넣기(Ctrl+V) 하세요.');
    }).catch(() => {
      prompt('아래 내용을 복사하세요:', text);
    });
  };

  // ⚠️ 미신청 학생 명단 복사 (카톡 안내용)
  const handleCopyUnbookedKakao = () => {
    if (!currentSchedule || unbookedStudents.length === 0) return;
    let text = `[품수학 ⏰ ${currentSchedule.date} 클리닉 미신청 학생 (${unbookedStudents.length}명)]\n`;
    unbookedStudents.forEach((s) => {
      text += `▪️ ${s.name}${s.class_name ? ` (${s.class_name})` : ''}\n`;
    });
    text += `\n아직 신청하지 않은 학생은 앱에 접속하여 원하시는 시간대를 신청해 주세요!`;

    navigator.clipboard.writeText(text).then(() => {
      alert('📋 미신청 학생 명단이 복사되었습니다!\n단톡방 등에 붙여넣기(Ctrl+V)하여 안내하실 수 있습니다.');
    }).catch(() => {
      prompt('아래 내용을 복사하세요:', text);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 (모바일 컴팩트) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-lg sm:text-xl">
              ⏰
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>클리닉 시간표 및 예약 관리</span>
                <span className="text-[11px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold hidden sm:inline-block">
                  30분 단위 자유 선택제
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-indigo-200 mt-0.5">
                클리닉 일정을 개설하고 학생들의 실시간 예약 현황 및 출결을 관리합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('TIMETABLE')}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs sm:text-sm transition flex items-center gap-1.5 ${
              activeTab === 'TIMETABLE'
                ? 'bg-white text-indigo-950 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📊</span>
            <span>실시간 시간표 & 예약 현황</span>
            {schedules.length > 0 && (
              <span className="text-[11px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full">
                {schedules.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('CREATE')}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs sm:text-sm transition flex items-center gap-1.5 ${
              activeTab === 'CREATE'
                ? 'bg-white text-indigo-950 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>➕</span>
            <span>새 클리닉 일정 개설</span>
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* ⚠️ DB 테이블 미생성 알림 */}
          {tableNotCreated && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs space-y-2">
              <div className="font-black flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Supabase DB에 clinic_schedules 테이블이 아직 생성되지 않았습니다.</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                `scripts/clinic_schema.sql` 스크립트를 Supabase SQL Editor에서 실행하시면 즉시 데이터 저장이 활성화됩니다.
              </p>
            </div>
          )}

          {/* 1️⃣ 탭 1: 실시간 시간표 및 현황 */}
          {activeTab === 'TIMETABLE' && (
            <div className="space-y-5">
              {loading ? (
                <div className="py-16 text-center text-sm font-bold text-slate-400">
                  클리닉 시간표를 불러오는 중입니다...
                </div>
              ) : schedules.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                  <div className="text-3xl">📅</div>
                  <p className="text-sm font-bold text-slate-600">개설된 클리닉 일정이 없습니다.</p>
                  <button
                    onClick={() => setActiveTab('CREATE')}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl shadow-xs transition"
                  >
                    + 새 클리닉 일정 개설하기
                  </button>
                </div>
              ) : (
                <>
                  {/* 날짜 선택 칩 리스트 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {schedules.map((s) => {
                      const uniqueCount = new Set(
                        (s.bookings || []).filter((b) => b.status !== 'CANCELLED').map((b) => b.student_id)
                      ).size;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedScheduleId(s.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
                            selectedScheduleId === s.id
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span>📅</span>
                          <span>{s.date} ({s.title})</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                            selectedScheduleId === s.id
                              ? 'bg-indigo-800 text-white'
                              : 'bg-white text-slate-600'
                          }`}>
                            {uniqueCount}명
                          </span>
                          {!s.is_active && (
                            <span className="text-[10px] bg-rose-500 text-white px-1.5 rounded">마감</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {currentSchedule && (
                    <div className="bg-slate-50/80 rounded-3xl p-4 sm:p-5 border border-slate-200 space-y-4">
                      
                      {/* 선택된 클리닉 일정 요약 헤더 및 컨트롤 바 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-900">
                              {currentSchedule.date} {currentSchedule.title}
                            </h3>
                            <span className="text-xs bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-lg border border-blue-200">
                              ⏰ {currentSchedule.start_time} ~ {currentSchedule.end_time}
                            </span>
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg border ${
                              currentSchedule.max_capacity
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {currentSchedule.max_capacity ? `👤 타임당 최대 ${currentSchedule.max_capacity}명` : '👥 무제한 수용'}
                            </span>
                            <span className="text-xs bg-purple-50 text-purple-800 font-extrabold px-2.5 py-0.5 rounded-lg border border-purple-200">
                              🎯 대상:{' '}
                              {currentSchedule.target_type === 'CLASS'
                                ? `반 (${
                                    Array.isArray(currentSchedule.target_class_ids) && currentSchedule.target_class_ids.length > 0
                                      ? currentSchedule.target_class_ids
                                          .map((id) => classes.find((c) => c.id === id)?.name)
                                          .filter(Boolean)
                                          .join(', ') || '지정 반'
                                      : classes.find((c) => c.id === currentSchedule.target_class_id)?.name || '지정 반'
                                  })`
                                : currentSchedule.target_type === 'STUDENTS'
                                ? `지정 학생 (${Array.isArray(currentSchedule.target_student_ids) ? currentSchedule.target_student_ids.length : 0}명)`
                                : '내 담당 학생'}
                            </span>
                          </div>
                          {currentSchedule.notice && (
                            <p className="text-xs text-slate-600 font-semibold mt-1">
                              📝 전달 공지: {currentSchedule.notice}
                            </p>
                          )}
                        </div>

                        {/* 액션 버튼 그룹 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenProxyModal()}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-1.5 rounded-xl shadow-xs transition active:scale-95"
                          >
                            + 학생 직접 배정
                          </button>
                          <button
                            onClick={handleCopyKakaoSummary}
                            className="text-xs bg-amber-300 hover:bg-amber-400 text-amber-950 font-black px-3 py-1.5 rounded-xl shadow-xs transition active:scale-95"
                            title="단톡방 공지 텍스트 복사"
                          >
                            📋 명단 복사
                          </button>
                          <button
                            onClick={handleToggleScheduleActive}
                            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl transition"
                          >
                            {currentSchedule.is_active ? '🔒 마감하기' : '🔓 다시 열기'}
                          </button>
                          <button
                            onClick={handleDeleteSchedule}
                            className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2 py-1.5 rounded-xl transition border border-rose-200"
                            title="일정 삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* 현황 요약 및 뷰 모드 토글 바 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 text-xs font-black">
                          <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1 rounded-xl">
                            <span>👥 예약 완료:</span>
                            <span className="text-indigo-600 font-black text-sm">{bookedStudentIdSet.size}명</span>
                          </span>
                          <span className="flex items-center gap-1.5 bg-amber-50 text-amber-950 border border-amber-200 px-3 py-1 rounded-xl">
                            <span>⏳ 미신청:</span>
                            <span className="text-amber-700 font-black text-sm">{unbookedStudents.length}명</span>
                          </span>
                        </div>

                        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-black shrink-0">
                          <button
                            onClick={() => setViewMode('TIMELINE')}
                            className={`px-3 py-1 rounded-lg transition ${
                              viewMode === 'TIMELINE' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            📊 30분 타임라인
                          </button>
                          <button
                            onClick={() => setViewMode('LIST')}
                            className={`px-3 py-1 rounded-lg transition ${
                              viewMode === 'LIST' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            📋 예약자 명단
                          </button>
                        </div>
                      </div>

                      {/* ⏳ 미신청 학생 명단 패널 (접힘 기본) */}
                      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⏳</span>
                            <span className="text-xs sm:text-sm font-black text-amber-950">
                              클리닉 미신청 학생 ({unbookedStudents.length}명)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {unbookedStudents.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={handleSendUnbookedClinicReminder}
                                  className="text-xs bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-black px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95"
                                  title="미신청 학생들에게 푸시 알림 발송"
                                >
                                  <span>📲</span>
                                  <span>미신청 알림 발송</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCopyUnbookedKakao}
                                  className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-950 font-black px-2.5 py-1.5 rounded-xl transition shadow-2xs flex items-center gap-1"
                                  title="카카오톡 전송용 미신청 학생 명단 복사"
                                >
                                  <span>📋</span>
                                  <span>명단 복사</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowUnbookedList((prev) => !prev)}
                              className="text-xs bg-white text-amber-900 border border-amber-200 font-bold px-2.5 py-1.5 rounded-xl hover:bg-amber-50 transition"
                            >
                              {showUnbookedList ? '▲ 접기' : '▼ 펼치기'}
                            </button>
                          </div>
                        </div>

                        {showUnbookedList && (
                          <div className="space-y-2 pt-1">
                            {unbookedStudents.length === 0 ? (
                              <p className="text-xs text-emerald-700 font-bold py-3 text-center bg-emerald-50 rounded-xl border border-emerald-200">
                                🎉 모든 대상 학생이 클리닉 신청을 완료했습니다!
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                                {unbookedStudents.map((s) => (
                                  <div
                                    key={s.id}
                                    className="bg-white p-2.5 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs shadow-2xs"
                                  >
                                    <div>
                                      <div className="font-extrabold text-slate-800 flex items-center gap-1">
                                        <span>👤</span>
                                        <span>{s.name}</span>
                                      </div>
                                      <div className="text-[10.5px] text-slate-400 font-normal">
                                        {s.class_name ? `[${s.class_name}] ` : ''}
                                        {s.parent_phone || '연락처 없음'}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProxyModal(s.id)}
                                      className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2 py-1 rounded-lg border border-indigo-200 transition shrink-0 active:scale-95"
                                      title="선생님이 대신 일정 배정하기"
                                    >
                                      + 대리 배정
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 1. 타임라인(시간표) 뷰 */}
                      {viewMode === 'TIMELINE' && (
                        <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200">
                          {currentSchedule.timetableGrid?.map((interval, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                interval.count > 0
                                  ? 'bg-indigo-50/40 border-indigo-200/80'
                                  : 'bg-slate-50/50 border-slate-200/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="font-mono text-xs font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  ⏱️ {interval.label}
                                </span>
                                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                                  interval.count > 0
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-slate-100 text-slate-400'
                                }`}>
                                  재실: {interval.count}명
                                </span>
                              </div>

                              {/* 해당 30분 구간에 머무는 학생들 칩 */}
                              <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-start sm:justify-end">
                                {interval.bookings?.length === 0 ? (
                                  <span className="text-xs text-slate-400 font-medium italic">
                                    비어 있음
                                  </span>
                                ) : (
                                  interval.bookings.map((b) => (
                                    <div
                                      key={b.id}
                                      className={`text-xs px-2.5 py-1 rounded-xl font-bold border flex items-center gap-1.5 shadow-2xs ${
                                        b.status === 'ATTENDED'
                                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                          : b.status === 'ABSENT'
                                          ? 'bg-rose-50 text-rose-900 border-rose-300'
                                          : 'bg-white text-indigo-950 border-indigo-200'
                                      }`}
                                    >
                                      <span>👤 {b.users?.name || '학생'}</span>
                                      <span className="text-[10px] text-slate-400">
                                        ({b.start_time}~{b.end_time})
                                      </span>
                                      
                                      {/* 간편 상태 토글 */}
                                      <button
                                        onClick={() => handleUpdateBookingStatus(b.id, b.status === 'ATTENDED' ? 'BOOKED' : 'ATTENDED')}
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-black transition ${
                                          b.status === 'ATTENDED'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800'
                                        }`}
                                        title="출석 완료 체크"
                                      >
                                        {b.status === 'ATTENDED' ? '✓ 출석' : '출석'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBooking(b.id, b.users?.name)}
                                        className="text-slate-400 hover:text-rose-600 text-xs px-1 font-bold"
                                        title="예약 취소"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 2. 명단 테이블 뷰 */}
                      {viewMode === 'LIST' && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                                <tr>
                                  <th className="p-3">학생명</th>
                                  <th className="p-3">신청 시간</th>
                                  <th className="p-3">질문/학습 내용</th>
                                  <th className="p-3">출결 상태</th>
                                  <th className="p-3 text-right">관리</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                {currentSchedule.bookings?.filter((b) => b.status !== 'CANCELLED').length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                                      아직 신청한 학생이 없습니다.
                                    </td>
                                  </tr>
                                ) : (
                                  currentSchedule.bookings
                                    ?.filter((b) => b.status !== 'CANCELLED')
                                    .map((b) => (
                                      <tr key={b.id} className="hover:bg-slate-50 transition">
                                        <td className="p-3 font-extrabold text-slate-900">
                                          👤 {b.users?.name || '학생'}
                                        </td>
                                        <td className="p-3 font-mono font-bold text-indigo-700">
                                          ⏰ {b.start_time} ~ {b.end_time} ({formatDurationLabel(timeToMinutes(b.end_time) - timeToMinutes(b.start_time))})
                                        </td>
                                        <td className="p-3 text-slate-600 max-w-xs truncate">
                                          {b.subject || '-'}
                                        </td>
                                        <td className="p-3">
                                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                                            b.status === 'ATTENDED'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : b.status === 'ABSENT'
                                              ? 'bg-rose-100 text-rose-800'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}>
                                            {b.status === 'ATTENDED' ? '✅ 출석' : b.status === 'ABSENT' ? '🚨 결석' : '📅 예약완료'}
                                          </span>
                                        </td>
                                        <td className="p-3 text-right space-x-1">
                                          <button
                                            onClick={() => handleUpdateBookingStatus(b.id, 'ATTENDED')}
                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-lg transition"
                                          >
                                            출석
                                          </button>
                                          <button
                                            onClick={() => handleUpdateBookingStatus(b.id, 'ABSENT')}
                                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-lg transition"
                                          >
                                            결석
                                          </button>
                                          <button
                                            onClick={() => handleDeleteBooking(b.id, b.users?.name)}
                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-lg transition"
                                          >
                                            취소
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 2️⃣ 탭 2: 신규 클리닉 일정 개설 폼 */}
          {activeTab === 'CREATE' && (
            <form onSubmit={handleCreateSchedule} className="space-y-5 max-w-2xl mx-auto bg-slate-50/80 p-5 sm:p-6 rounded-3xl border border-slate-200">
              <div className="border-b border-slate-200/80 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>➕</span>
                  <span>새 클리닉 운영 일정 만들기</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  날짜와 시간대를 정해 오픈하면 학생들이 30분 단위로 원하는 시간대를 골라 예약할 수 있습니다.
                </p>
              </div>

              {/* 날짜 선택 */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">📅 클리닉 진행 날짜</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-indigo-500"
                  required
                />
              </div>

              {/* 제목 */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">🏷️ 클리닉 명칭</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 주말 클리닉, 시험대비 집중 클리닉"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-indigo-500"
                  required
                />
              </div>

              {/* 🎯 신청 대상 설정 (노출 범위) */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>신청 대상 설정 (누구에게 보일지 선택)</span>
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    {targetType === 'TEACHER_STUDENTS'
                      ? '내 담당 학생'
                      : targetType === 'CLASS'
                      ? `특정 반 (${targetClassIds.length}개 반)`
                      : `지정 학생 (${targetStudentIds.length}명)`}
                  </span>
                </div>

                {/* 3가지 대상 라디오 카드 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetType('TEACHER_STUDENTS')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                      targetType === 'TEACHER_STUDENTS'
                        ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 font-bold hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-base">👨‍🏫</span>
                      <span>내 담당 학생 (기본)</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-normal leading-tight">
                      내게 배정된 학생 및 내 반 학생 전체
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('CLASS')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                      targetType === 'CLASS'
                        ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 font-bold hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-base">🏫</span>
                      <span>특정 반 지정 (복수 선택 가능)</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-normal leading-tight">
                      선택한 반 소속 학생들에게만 노출
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('STUDENTS')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                      targetType === 'STUDENTS'
                        ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 font-bold hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-base">👤</span>
                      <span>특정 학생 개별 지정</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-normal leading-tight">
                      보충이 필요한 특정 학생들만 1:1 지정
                    </p>
                  </button>
                </div>

                {/* 복수 반 선택 서브 패널 */}
                {targetType === 'CLASS' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        대상 반 선택 ({targetClassIds.length}개 반 선택됨)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTargetClassIds(classes.map((c) => c.id))}
                          className="text-[11px] text-indigo-600 font-bold hover:underline"
                        >
                          전체 선택
                        </button>
                        <span className="text-slate-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => setTargetClassIds([])}
                          className="text-[11px] text-rose-600 font-bold hover:underline"
                        >
                          선택 초기화
                        </button>
                      </div>
                    </div>

                    {classes.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">개설된 반이 없습니다.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                        {classes.map((c) => {
                          const isChecked = targetClassIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition text-xs font-bold ${
                                isChecked
                                  ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 ring-1 ring-indigo-300 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTargetClassIds((prev) => [...prev, c.id]);
                                  } else {
                                    setTargetClassIds((prev) => prev.filter((id) => id !== c.id));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <span>🏫 {c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 특정 학생 선택 서브 패널 */}
                {targetType === 'STUDENTS' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        보충 대상 학생 선택 ({targetStudentIds.length}명 선택됨)
                      </label>
                      {targetStudentIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTargetStudentIds([])}
                          className="text-[10px] text-rose-600 font-bold hover:underline"
                        >
                          선택 초기화
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={studentSearchKeyword}
                      onChange={(e) => setStudentSearchKeyword(e.target.value)}
                      placeholder="학생 이름 또는 번호 검색..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                    />

                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 divide-y divide-slate-100 space-y-1">
                      {filteredStudentsForTarget.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-bold">
                          검색된 학생이 없습니다.
                        </div>
                      ) : (
                        filteredStudentsForTarget.map((s) => {
                          const isChecked = targetStudentIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-center justify-between p-1.5 hover:bg-white rounded-lg cursor-pointer transition text-xs font-bold text-slate-800"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTargetStudentIds((prev) => [...prev, s.id]);
                                    } else {
                                      setTargetStudentIds((prev) => prev.filter((id) => id !== s.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <span>{s.name}</span>
                              </div>
                              <span className="text-[10.5px] text-slate-400 font-normal">
                                {s.parent_phone || '전화번호 없음'}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 운영 시간대 (시작 ~ 종료) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">⏰ 시작 시간</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">⏰ 종료 시간</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* 👥 정원 제한 옵션 */}
              <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">👥 수용 정원 설정</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimitedCapacity}
                      onChange={(e) => setIsUnlimitedCapacity(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-xs font-black text-indigo-700">인원 제한 없음 (무제한 자유 신청)</span>
                  </label>
                </div>

                {!isUnlimitedCapacity && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600">시간대별 동시 수용 최대 정원:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={newMaxCapacity}
                        onChange={(e) => setNewMaxCapacity(e.target.value)}
                        className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-black text-center text-slate-900"
                        required
                      />
                      <span className="text-xs font-bold text-slate-600">명</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 전달 공지사항 */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">📝 학생 전달 공지 / 준비물</label>
                <textarea
                  value={newNotice}
                  onChange={(e) => setNewNotice(e.target.value)}
                  placeholder="학생들에게 전달할 준비물이나 안내사항을 입력하세요."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-indigo-500"
                />
              </div>

              {/* 푸시 알림 전송 옵션 */}
              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={sendPushOnCreate}
                  onChange={(e) => setSendPushOnCreate(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  📲 학생들에게 '클리닉 시간 선택 오픈' 스마트폰 푸시 알림 즉시 발송
                </span>
              </label>

              {/* 개설 완료 버튼 */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-md shadow-indigo-600/20 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? '일정 개설 중...' : '✨ 클리닉 일정 개설 및 오픈하기'}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* 👤 학생 직접 추가/대리 배정 팝업 모달 */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>👤</span>
                <span>학생 클리닉 대리 배정</span>
              </h4>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProxyAddStudent} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* 학생 선택 */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">배정 대상 학생</label>
                <select
                  value={proxyStudentId}
                  onChange={(e) => handleProxyStudentChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-indigo-500"
                  required
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.class_name ? `[${s.class_name}]` : ''} ({s.parent_phone || '번호 없음'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 30분 단위 블록 선택 (건너뛰기/다중 선택 가능) */}
              <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                    <span>⏱️</span>
                    <span>시간 블록 선택 (자유 다중/분리 선택)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const initStartM = timeToMinutes(currentSchedule?.start_time || '10:00');
                        const schedEndM = timeToMinutes(currentSchedule?.end_time || '18:00');
                        const blocks = [];
                        for (let m = initStartM; m < Math.min(initStartM + 120, schedEndM); m += 30) {
                          blocks.push(minutesToTime(m));
                        }
                        setProxySelectedBlocks(blocks);
                      }}
                      className="text-[10.5px] bg-white border border-slate-200 text-indigo-700 font-bold px-2 py-0.5 rounded-md hover:bg-indigo-50 transition"
                    >
                      기본 2시간
                    </button>
                    <button
                      type="button"
                      onClick={() => setProxySelectedBlocks([])}
                      className="text-[10.5px] bg-white border border-slate-200 text-rose-600 font-bold px-2 py-0.5 rounded-md hover:bg-rose-50 transition"
                    >
                      전체 해제
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  원하는 30분 블록을 터치하여 자유롭게 추가/제외하세요. (중간에 비는 시간도 건너뛰어 배정 가능)
                </p>

                {/* 블록 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 max-h-48 overflow-y-auto p-0.5">
                  {proxyIntervals.map((intv) => {
                    const isSelected = proxySelectedBlocks.includes(intv.startTime);
                    return (
                      <button
                        key={intv.startTime}
                        type="button"
                        onClick={() => handleToggleProxyBlock(intv.startTime)}
                        className={`p-2 rounded-xl text-left border transition flex flex-col justify-between gap-1 text-xs cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-black ring-2 ring-indigo-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 font-semibold'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px]">{intv.label}</span>
                          {isSelected && <span className="text-[10px]">✓</span>}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {intv.isUnlimited ? '재실 ' + intv.currentCount + '명' : '잔여 ' + intv.remaining + '석'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 선택 요약 */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">선택된 시간:</span>
                  <span className="font-black text-indigo-700 text-right">
                    {proxySummaryText || '선택된 시간 없음'}
                  </span>
                </div>
              </div>

              {/* 질문 / 학습 교재 */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">질문 / 학습 교재 (선택)</label>
                <input
                  type="text"
                  value={proxySubject}
                  onChange={(e) => setProxySubject(e.target.value)}
                  placeholder="예: 수2 적분 오답노트"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-indigo-500"
                />
              </div>

              {/* 버튼 그룹 */}
              <div className="flex justify-end gap-2 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting || proxySelectedBlocks.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-600/20 transition disabled:opacity-50 active:scale-95"
                >
                  {submitting ? '배정 중...' : `배정 완료 (${proxyTotalMinutes > 0 ? formatDurationLabel(proxyTotalMinutes) : '0분'})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

