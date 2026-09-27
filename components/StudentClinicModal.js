'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  timeToMinutes,
  minutesToTime,
  formatDurationLabel,
  generateIntervalsWithAvailability,
  blocksToRanges,
  formatRangesSummary,
  formatRangesButtonLabel,
  checkMultipleRangesCapacity,
} from '@/lib/clinicUtils';

export default function StudentClinicModal({ user, initialScheduleId = null, onClose, onBookingUpdated }) {
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);

  // 선택된 30분 블록들의 시작 시간 목록 (예: ['13:00', '13:30', '16:00', '16:30', '17:00'])
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [subject, setSubject] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  // 클리닉 일정 조회
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clinic/schedules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '조회 실패');

      const activeList = (data.schedules || []).filter((s) => s.is_active);
      setSchedules(activeList);

      if (activeList.length > 0) {
        let initial = null;
        if (initialScheduleId) {
          initial = activeList.find((s) => s.id === initialScheduleId);
        }
        if (!initial) {
          // 미신청 일정이 있다면 미신청 일정을 기본 선택
          const unbooked = activeList.find(
            (s) => !s.myBooking && (!s.myBookings || s.myBookings.length === 0)
          );
          initial = unbooked || activeList[0];
        }
        setSelectedScheduleId(initial.id);
        applyScheduleSelection(initial);
      }
    } catch (err) {
      console.error('fetchSchedules error:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyScheduleSelection = (sched) => {
    const myBookings = sched.myBookings || (sched.myBooking ? [sched.myBooking] : []);
    if (myBookings.length > 0) {
      // 기존 예약이 있으면 해당 시간대 블록들 모두 채우기
      const blocks = [];
      let initialSubject = '';
      myBookings.forEach((b) => {
        const startM = timeToMinutes(b.start_time);
        const endM = timeToMinutes(b.end_time);
        for (let m = startM; m < endM; m += 30) {
          blocks.push(minutesToTime(m));
        }
        if (b.subject && !initialSubject) initialSubject = b.subject;
      });
      setSelectedBlocks([...new Set(blocks)]);
      setSubject(initialSubject);
      setRescheduleReason('');
    } else {
      // 기존 예약이 없으면 기본 2시간 (4개 블록) 또는 첫 2블록 선택
      const initStartM = timeToMinutes(sched.start_time || '10:00');
      const schedEndM = timeToMinutes(sched.end_time || '18:00');
      const blocks = [];
      for (let m = initStartM; m < Math.min(initStartM + 120, schedEndM); m += 30) {
        blocks.push(minutesToTime(m));
      }
      setSelectedBlocks(blocks.length > 0 ? blocks : [sched.start_time]);
      setSubject('');
      setRescheduleReason('');
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // 현재 선택된 일정
  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.id === selectedScheduleId) || schedules[0] || null;
  }, [schedules, selectedScheduleId]);

  // 기존 내 예약 목록
  const myExistingBookings = useMemo(() => {
    if (!currentSchedule) return [];
    return currentSchedule.myBookings || (currentSchedule.myBooking ? [currentSchedule.myBooking] : []);
  }, [currentSchedule]);

  // 기존 예약 블록 목록 (정렬됨)
  const existingBookedBlocks = useMemo(() => {
    if (!myExistingBookings || myExistingBookings.length === 0) return [];
    const blocks = [];
    myExistingBookings.forEach((b) => {
      const startM = timeToMinutes(b.start_time);
      const endM = timeToMinutes(b.end_time);
      for (let m = startM; m < endM; m += 30) {
        blocks.push(minutesToTime(m));
      }
    });
    return [...new Set(blocks)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }, [myExistingBookings]);

  // 기존 예약이 있고, 선택된 블록이 기존 예약과 다른지 여부 (즉, 시간 변경 요청 상태인지)
  const isRescheduleMode = useMemo(() => {
    if (myExistingBookings.length === 0) return false;
    if (selectedBlocks.length !== existingBookedBlocks.length) return true;
    const sortedSel = [...selectedBlocks].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    return sortedSel.some((b, i) => b !== existingBookedBlocks[i]);
  }, [myExistingBookings, selectedBlocks, existingBookedBlocks]);

  // 현재 대기 중인 시간 변경 요청
  const pendingReschedule = currentSchedule?.pendingReschedule || null;

  // 30분 단위 블록 목록 및 각 블록별 잔여석/마감 상태
  const intervals = useMemo(() => {
    if (!currentSchedule) return [];
    return generateIntervalsWithAvailability(
      currentSchedule.start_time,
      currentSchedule.end_time,
      currentSchedule.bookings || [],
      currentSchedule.max_capacity,
      user.id
    );
  }, [currentSchedule, user.id]);

  // 선택된 블록들을 연속된 구간들(Ranges)로 변환
  const ranges = useMemo(() => {
    return blocksToRanges(selectedBlocks);
  }, [selectedBlocks]);

  // 총 선택 분 수
  const totalMinutes = useMemo(() => {
    return ranges.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
  }, [ranges]);

  // 전체 선택 요약 문구
  const summaryText = useMemo(() => {
    return formatRangesSummary(ranges);
  }, [ranges]);

  // 전체 선택된 구간의 정원 체크
  const capacityCheck = useMemo(() => {
    if (!currentSchedule || ranges.length === 0) {
      return { isAvailable: false, isFull: false, remainingCapacity: null, isUnlimited: true };
    }

    return checkMultipleRangesCapacity(
      ranges,
      currentSchedule.bookings || [],
      currentSchedule.max_capacity,
      user.id
    );
  }, [currentSchedule, ranges, user.id]);

  // 일정 변경 시
  const handleSelectSchedule = (sched) => {
    setSelectedScheduleId(sched.id);
    applyScheduleSelection(sched);
  };

  // 30분 블록 토글 클릭 핸들러
  const handleToggleBlock = (blockStartTime, isBlockFull) => {
    if (isBlockFull) return;

    setSelectedBlocks((prev) => {
      if (prev.includes(blockStartTime)) {
        return prev.filter((t) => t !== blockStartTime);
      } else {
        return [...prev, blockStartTime];
      }
    });
  };

  // 전체 선택 해제
  const handleClearBlocks = () => {
    setSelectedBlocks([]);
  };

  // 예약 신청 또는 시간 변경 승인 요청 핸들러
  const handleBookOrReschedule = async () => {
    if (!currentSchedule || ranges.length === 0 || totalMinutes <= 0) {
      return alert('원하시는 시간 블록을 1개 이상 선택해 주세요.');
    }

    if (capacityCheck.isFull) {
      return alert('선택하신 시간대 중 일부가 이미 정원 마감되었습니다. 다른 블록을 선택해 주세요.');
    }

    // 1. 시간 변경 모드인 경우 (선생님 승인 요청)
    if (isRescheduleMode) {
      if (!rescheduleReason || !rescheduleReason.trim()) {
        return alert('시간 변경 사유를 반드시 입력해 주세요.\n(선생님께서 사유를 확인 후 승인해 주십니다)');
      }

      if (!confirm(`[${currentSchedule.date}]\n새로운 시간대(${summaryText})로 시간 변경 승인을 요청하시겠습니까?\n\n사유: ${rescheduleReason.trim()}`)) {
        return;
      }

      try {
        setSubmitting(true);
        const res = await fetch('/api/clinic/reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId: currentSchedule.id,
            ranges,
            selectedBlocks,
            subject: subject.trim(),
            reason: rescheduleReason.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '시간 변경 요청 실패');

        alert('📩 선생님께 시간 변경 승인 요청이 전송되었습니다!\n선생님이 승인하시면 예약 시간이 최종 변경됩니다.');
        setRescheduleReason('');
        await fetchSchedules();
        if (onBookingUpdated) onBookingUpdated();
      } catch (err) {
        alert(`요청 실패: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 2. 최초 신규 예약인 경우
    try {
      setSubmitting(true);
      const res = await fetch('/api/clinic/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: currentSchedule.id,
          ranges,
          selectedBlocks,
          subject: subject.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '예약 신청 실패');

      alert(`🎉 [${currentSchedule.date} ${summaryText}] 클리닉 예약이 완료되었습니다!`);
      await fetchSchedules();
      if (onBookingUpdated) onBookingUpdated();
    } catch (err) {
      alert(`예약 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 대기 중인 시간 변경 요청 취소
  const handleCancelRescheduleRequest = async () => {
    if (!pendingReschedule) return;
    if (!confirm('신청하신 클리닉 시간 변경 요청을 취소하시겠습니까?')) return;

    try {
      setCancellingRequest(true);
      const res = await fetch(`/api/clinic/reschedule?requestId=${pendingReschedule.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '취소 실패');

      alert('시간 변경 요청이 취소되었습니다.');
      await fetchSchedules();
    } catch (err) {
      alert(`취소 실패: ${err.message}`);
    } finally {
      setCancellingRequest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg sm:text-xl shadow-xs">
              ⏰
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>클리닉 시간 선택</span>
                <span className="text-[11px] bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full font-bold hidden sm:inline-block">
                  자유 시간 선택
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-blue-100 mt-0.5">
                원하는 30분 단위 블록들을 터치하여 시간대를 자유롭게 선택하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition text-base"
          >
            ✕
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-sm font-bold text-slate-400">
              열려있는 클리닉 일정을 확인하는 중입니다...
            </div>
          ) : schedules.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
              <div className="text-4xl">🏖️</div>
              <p className="text-sm font-bold text-slate-700">현재 참여 가능한 클리닉 일정이 없습니다.</p>
              <p className="text-xs text-slate-400">선생님이 일정을 개설하면 알림과 함께 열립니다.</p>
            </div>
          ) : (
            <>
              {/* 날짜 선택 탭 */}
              {schedules.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {schedules.map((s) => {
                    const hasMyBooking = (s.myBookings && s.myBookings.length > 0) || !!s.myBooking;
                    const isPending = !!s.pendingReschedule;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSchedule(s)}
                        className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
                          selectedScheduleId === s.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>📅</span>
                        <span>{s.date} ({s.title})</span>
                        {isPending ? (
                          <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded animate-pulse">
                            ⏳ 변경대기
                          </span>
                        ) : hasMyBooking ? (
                          <span className="text-[10px] bg-emerald-400 text-slate-950 font-black px-1.5 py-0.2 rounded shadow-2xs">
                            ✅ 예약됨
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-300 text-slate-950 font-black px-1.5 py-0.2 rounded shadow-2xs">
                            🚨 미신청
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentSchedule && (
                <div className="space-y-3.5">
                  
                  {/* ⏳ 대기 중인 시간 변경 승인 요청 배너 */}
                  {pendingReschedule && (
                    <div className="bg-amber-50 border-2 border-amber-300 p-3.5 rounded-2xl space-y-1.5 text-xs shadow-xs animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-amber-950 flex items-center gap-1.5 text-xs sm:text-sm">
                          <span>⏳</span>
                          <span>선생님 시간 변경 승인 대기 중</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelRescheduleRequest}
                          disabled={cancellingRequest}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-amber-300 shadow-2xs"
                        >
                          {cancellingRequest ? '취소 중...' : '요청 취소'}
                        </button>
                      </div>
                      <div className="text-amber-900 space-y-0.5 font-semibold text-[11.5px]">
                        <p>
                          희망 시간: <strong className="font-black text-indigo-900">{formatRangesSummary(pendingReschedule.requested_ranges)}</strong>
                        </p>
                        <p>사유: {pendingReschedule.reason}</p>
                        <p className="text-[10.5px] text-amber-800 font-normal pt-0.5">
                          💡 선생님께서 사유를 검토 중입니다. 승인 시 예약 시간이 자동으로 변경됩니다.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 일정 안내 카드 */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span>📅</span>
                        <span>{currentSchedule.date} {currentSchedule.title}</span>
                      </span>
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-lg border border-indigo-200">
                        운영시간: {currentSchedule.start_time} ~ {currentSchedule.end_time}
                      </span>
                    </div>
                    {currentSchedule.notice && (
                      <p className="text-xs text-slate-600 font-semibold pl-1">
                        📝 {currentSchedule.notice}
                      </p>
                    )}
                  </div>

                  {/* ⭐ 이미 예약된 경우: 내 예약 상태 강조 박스 */}
                  {myExistingBookings.length > 0 && (
                    <div className="bg-emerald-50/80 border border-emerald-300 p-3.5 sm:p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <span>⭐</span>
                          <span>현재 확정된 내 예약 시간</span>
                        </span>
                        <span className="text-[10.5px] font-black px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900">
                          📅 예약 확정
                        </span>
                      </div>

                      {/* 예약된 시간대 목록 */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {myExistingBookings.map((b, idx) => {
                          const dur = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
                          return (
                            <span
                              key={b.id || idx}
                              className="bg-white text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-xl text-xs font-black font-mono shadow-2xs"
                            >
                              {b.start_time} ~ {b.end_time} ({formatDurationLabel(dur)})
                            </span>
                          );
                        })}
                      </div>
                      
                      {myExistingBookings[0]?.subject && (
                        <p className="text-xs text-emerald-800 font-bold pl-1">
                          📖 질문 과목/교재: {myExistingBookings[0].subject}
                        </p>
                      )}

                      <div className="pt-1 text-[11px] text-emerald-800 font-medium">
                        💡 다른 시간대로 변경을 원하시면 아래 블록을 선택 후 사유를 입력하여 변경 요청을 제출하세요.
                      </div>
                    </div>
                  )}

                  {/* ⏰ 30분 단위 블록 선택 영역 */}
                  <div className="space-y-2 bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span>⏰</span>
                        <span>참여할 시간 블록 터치 (중간 건너뛰기 가능)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {selectedBlocks.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearBlocks}
                            className="text-[10px] text-slate-500 hover:text-rose-600 font-bold underline"
                          >
                            선택 초기화
                          </button>
                        )}
                        <span className="text-[10.5px] font-bold text-slate-500">
                          {currentSchedule.max_capacity ? `타임당 정원 ${currentSchedule.max_capacity}명` : '인원 제한 없음'}
                        </span>
                      </div>
                    </div>

                    {/* 블록 그리드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {intervals.map((item) => {
                        const isSelected = selectedBlocks.includes(item.startTime);
                        const isFull = item.isFull;

                        return (
                          <button
                            key={item.startTime}
                            type="button"
                            disabled={isFull}
                            onClick={() => handleToggleBlock(item.startTime, isFull)}
                            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 relative select-none cursor-pointer ${
                              isFull
                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-700 shadow-sm shadow-indigo-600/20 ring-2 ring-indigo-400'
                                : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-800 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-black font-mono ${
                                isSelected ? 'text-white' : 'text-slate-900'
                              }`}>
                                {item.label}
                              </span>
                              {isSelected && (
                                <span className="bg-white text-indigo-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                  ✓
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`font-semibold ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                30분
                              </span>
                              {isFull ? (
                                <span className="font-extrabold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                                  마감
                                </span>
                              ) : isSelected ? (
                                <span className="font-bold text-white bg-white/20 px-1 py-0.2 rounded">
                                  선택됨
                                </span>
                              ) : item.isUnlimited ? (
                                <span className="font-bold text-blue-600 bg-blue-50 px-1 py-0.2 rounded">
                                  신청 가능
                                </span>
                              ) : (
                                <span className={`font-bold px-1 py-0.2 rounded ${
                                  item.remainingCapacity <= 2
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-50 text-emerald-800'
                                }`}>
                                  잔여 {item.remainingCapacity}석
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 📊 실시간 선택 요약 배너 */}
                  {selectedBlocks.length > 0 && (
                    <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      capacityCheck.isFull
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : isRescheduleMode
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-blue-50 border-blue-200 text-blue-950'
                    }`}>
                      <div className="space-y-1">
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <span>⏰</span>
                          <span>
                            {isRescheduleMode ? '새로 변경할 희망 시간' : '선택된 시간'}:
                            <strong className="text-indigo-700 ml-1 font-black">
                              총 {formatDurationLabel(totalMinutes)} ({ranges.length}개 타임)
                            </strong>
                          </span>
                        </div>

                        {/* 구간별 상세 뱃지 리스트 */}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {ranges.map((r, idx) => (
                            <span
                              key={idx}
                              className="bg-white text-indigo-900 font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs"
                            >
                              {r.startTime} ~ {r.endTime} ({formatDurationLabel(r.durationMinutes)})
                            </span>
                          ))}
                        </div>

                        <p className="text-[10.5px] font-semibold text-slate-600 pt-0.5">
                          {capacityCheck.isUnlimited
                            ? '👥 인원 제한 없이 자유롭게 예약하실 수 있습니다.'
                            : capacityCheck.isFull
                            ? '🚫 선택한 구간 중 마감된 시간대가 포함되어 있습니다.'
                            : `🟢 예약 가능 (해당 구간 최소 잔여: ${capacityCheck.remainingCapacity}석)`}
                        </p>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        {capacityCheck.isFull ? (
                          <span className="text-xs bg-rose-600 text-white font-black px-2.5 py-1 rounded-lg">
                            마감됨
                          </span>
                        ) : (
                          <span className="text-xs bg-emerald-600 text-white font-black px-2.5 py-1 rounded-lg">
                            예약 가능
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 📝 시간 변경 사유 입력창 (기존 예약이 있고 시간을 바꿀 때만 필수 노출) */}
                  {isRescheduleMode && (
                    <div className="bg-amber-50/90 border border-amber-300 p-3.5 rounded-2xl space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                          <span>📝</span>
                          <span>시간 변경 사유 (필수 입력)</span>
                        </label>
                        <span className="text-[10.5px] font-bold text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded">
                          선생님 승인 필요
                        </span>
                      </div>
                      <p className="text-[10.5px] text-amber-900 font-medium">
                        시간을 임의로 변경할 수 없으므로, 변경이 필요한 사유를 작성해 주세요. (선생님께서 승인하시면 변경됩니다)
                      </p>
                      <textarea
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="예: 타 과목 보강 일정이 겹쳐 부득이하게 15시로 변경 요청드립니다."
                        rows={2}
                        className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-indigo-500"
                        required
                      />
                    </div>
                  )}

                  {/* 질문할 교재 / 학습 내용 (선택사항) */}
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                      <span>📖 질문할 내용 또는 공부할 교재 (선택)</span>
                      <span className="text-[10.5px] text-slate-400 font-normal">선생님이 미리 준비할 수 있습니다</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="예: 쎈 수1 삼각함수 오답 질문, 마플 시너지, 기출 풀이 등"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-indigo-500 focus:bg-white"
                    />
                  </div>

                  {/* 예약 신청 / 시간 변경 버튼 */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={capacityCheck.isFull || submitting || totalMinutes <= 0 || (isRescheduleMode && !rescheduleReason.trim())}
                      onClick={handleBookOrReschedule}
                      className={`w-full text-white font-black py-3 rounded-2xl shadow-md transition text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${
                        isRescheduleMode
                          ? 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 shadow-amber-600/20'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-indigo-600/20'
                      }`}
                    >
                      {submitting
                        ? '처리 중...'
                        : isRescheduleMode
                        ? `📩 ${formatRangesButtonLabel(ranges, 'RESCHEDULE_REQUEST')}`
                        : `✨ ${formatRangesButtonLabel(ranges, 'BOOK')}`}
                    </button>
                  </div>

                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
