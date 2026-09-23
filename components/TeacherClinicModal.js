'use client';

import { useState, useEffect, useMemo } from 'react';
import { timeToMinutes, minutesToTime, generateTimePoints, formatDurationLabel } from '@/lib/clinicUtils';

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
  const [newTitle, setNewTitle] = useState('주말 클리닉');
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('18:00');
  const [isUnlimitedCapacity, setIsUnlimitedCapacity] = useState(true);
  const [newMaxCapacity, setNewMaxCapacity] = useState(6);
  const [newTargetClassId, setNewTargetClassId] = useState('');
  const [newNotice, setNewNotice] = useState('질문할 교재 및 오답노트를 지참해 주세요.');
  const [sendPushOnCreate, setSendPushOnCreate] = useState(true);

  // 학생 대리 등록 모달 상태
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [proxyStudentId, setProxyStudentId] = useState('');
  const [proxyStartTime, setProxyStartTime] = useState('10:00');
  const [proxyEndTime, setProxyEndTime] = useState('12:00');
  const [proxySubject, setProxySubject] = useState('');

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
        // 이미 선택된 것이 없거나 유효하지 않으면 첫 번째 일정 선택
        if (!selectedScheduleId || !data.schedules.some((s) => s.id === selectedScheduleId)) {
          setSelectedScheduleId(data.schedules[0].id);
        }
      } else {
        setSelectedScheduleId(null);
        setActiveTab('CREATE'); // 개설된 일정이 없으면 개설 탭으로 자동 전환
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

  // 신규 일정 생성 핸들러
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!newDate) return alert('날짜를 선택해 주세요.');

    try {
      setSubmitting(true);
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
          targetClassId: newTargetClassId || null,
          notice: newNotice,
          sendPush: sendPushOnCreate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일정 개설 실패');

      alert('🎉 클리닉 일정이 성공적으로 개설되었습니다!');
      setActiveTab('TIMETABLE');
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

  // 선생님 대리 학생 등록
  const handleProxyAddStudent = async (e) => {
    e.preventDefault();
    if (!proxyStudentId) return alert('배정할 학생을 선택해 주세요.');
    if (!currentSchedule) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/clinic/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: currentSchedule.id,
          studentId: proxyStudentId,
          startTime: proxyStartTime,
          endTime: proxyEndTime,
          subject: proxySubject,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배정 실패');

      alert('학생이 성공적으로 클리닉에 배정되었습니다.');
      setShowAddStudentModal(false);
      setProxyStudentId('');
      setProxySubject('');
      await fetchClinicData();
    } catch (err) {
      alert(`배정 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 카카오톡/단톡방 공유용 텍스트 복사
  const handleCopyKakaoSummary = () => {
    if (!currentSchedule) return;
    const bookings = (currentSchedule.bookings || []).filter((b) => b.status !== 'CANCELLED');
    // 학생별 그룹화
    const studentMap = new Map();
    const sorted = [...bookings].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    sorted.forEach((b) => {
      const sId = b.student_id || b.users?.id || b.users?.name;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          name: b.users?.name || '학생',
          bookings: [],
          subjects: [],
        });
      }
      studentMap.get(sId).bookings.push(b);
      if (b.subject && !studentMap.get(sId).subjects.includes(b.subject)) {
        studentMap.get(sId).subjects.push(b.subject);
      }
    });

    let text = `[품수학 ⏰ ${currentSchedule.date} 클리닉 시간표]\n`;
    text += `운영시간: ${currentSchedule.start_time} ~ ${currentSchedule.end_time}\n`;
    text += `총 신청 학생: ${studentMap.size}명\n\n`;

    studentMap.forEach((data) => {
      const timeParts = data.bookings.map((b) => {
        const dur = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
        return `${b.start_time}~${b.end_time} (${formatDurationLabel(dur)})`;
      });
      const totalMins = data.bookings.reduce(
        (sum, b) => sum + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)),
        0
      );
      const totalStr = data.bookings.length > 1 ? ` [총 ${formatDurationLabel(totalMins)}]` : '';
      const subjectStr = data.subjects.length > 0 ? ` (${data.subjects.join(', ')})` : '';
      text += `▪️ ${data.name} : ${timeParts.join(' + ')}${totalStr}${subjectStr}\n`;
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

  // 대리 등록 시 선택 가능한 시간들
  const proxyStartTimes = useMemo(() => {
    if (!currentSchedule) return [];
    const points = generateTimePoints(currentSchedule.start_time, currentSchedule.end_time, 30);
    return points.slice(0, points.length - 1);
  }, [currentSchedule]);

  const proxyEndTimes = useMemo(() => {
    if (!currentSchedule || !proxyStartTime) return [];
    const startMins = timeToMinutes(proxyStartTime);
    const schedEndMins = timeToMinutes(currentSchedule.end_time);
    const endPoints = [];
    for (let s = startMins + 30; s <= schedEndMins; s += 30) {
      endPoints.push(minutesToTime(s));
    }
    return endPoints;
  }, [currentSchedule, proxyStartTime]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl">
              ⏰
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>주말 클리닉 시간표 및 예약 관리</span>
                <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">
                  30분 단위 자유 선택제
                </span>
              </h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                클리닉 일정을 개설하고 학생들의 실시간 예약 현황 및 출결을 관리합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition text-lg"
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
                    {schedules.map((s) => (
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
                          {s.bookings?.filter((b) => b.status !== 'CANCELLED').length || 0}명
                        </span>
                        {!s.is_active && (
                          <span className="text-[10px] bg-rose-500 text-white px-1.5 rounded">마감</span>
                        )}
                      </button>
                    ))}
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
                            onClick={() => setShowAddStudentModal(true)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-1.5 rounded-xl shadow-xs transition"
                          >
                            + 학생 직접 추가
                          </button>
                          <button
                            onClick={handleCopyKakaoSummary}
                            className="text-xs bg-amber-300 hover:bg-amber-400 text-amber-950 font-black px-3 py-1.5 rounded-xl shadow-xs transition"
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

                      {/* 뷰 모드 토글 (타임라인 뷰 vs 리스트 뷰) */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                          <span>👥 총 예약 학생:</span>
                          <span className="text-indigo-600 font-black text-sm">
                            {currentSchedule.bookings?.filter((b) => b.status !== 'CANCELLED').length || 0}명
                          </span>
                        </span>

                        <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-black">
                          <button
                            onClick={() => setViewMode('TIMELINE')}
                            className={`px-3 py-1 rounded-lg transition ${
                              viewMode === 'TIMELINE' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            📊 30분 타임라인 뷰
                          </button>
                          <button
                            onClick={() => setViewMode('LIST')}
                            className={`px-3 py-1 rounded-lg transition ${
                              viewMode === 'LIST' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            📋 예약자 명단 뷰
                          </button>
                        </div>
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

      {/* 👤 학생 직접 추가 팝업 모달 */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>👤</span>
                <span>학생 직접 클리닉 배정</span>
              </h4>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProxyAddStudent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">학생 선택</label>
                <select
                  value={proxyStudentId}
                  onChange={(e) => setProxyStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  required
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.parent_phone || '번호 없음'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">시작 시간</label>
                  <select
                    value={proxyStartTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setProxyStartTime(newStart);
                      const startMins = timeToMinutes(newStart);
                      const endMins = timeToMinutes(proxyEndTime);
                      if (endMins <= startMins) {
                        const schedEndMins = timeToMinutes(currentSchedule?.end_time || '18:00');
                        setProxyEndTime(minutesToTime(Math.min(startMins + 120, schedEndMins)));
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    required
                  >
                    {proxyStartTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">종료 시간</label>
                  <select
                    value={proxyEndTime}
                    onChange={(e) => setProxyEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    required
                  >
                    {proxyEndTimes.map((t) => {
                      const dur = timeToMinutes(t) - timeToMinutes(proxyStartTime);
                      return (
                        <option key={t} value={t}>
                          {t} ({formatDurationLabel(dur)})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">질문/학습 교재 (선택)</label>
                <input
                  type="text"
                  value={proxySubject}
                  onChange={(e) => setProxySubject(e.target.value)}
                  placeholder="예: 수2 적분 오답노트"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-xs"
                >
                  {submitting ? '배정 중...' : '배정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

