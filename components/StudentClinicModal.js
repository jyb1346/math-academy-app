'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  timeToMinutes,
  minutesToTime,
  generateTimePoints,
  formatDurationLabel,
  checkRangeCapacity,
} from '@/lib/clinicUtils';

export default function StudentClinicModal({ user, onClose, onBookingUpdated }) {
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);

  // 시간 선택 상태
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [subject, setSubject] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 클리닉 일정 및 슬롯 데이터 조회
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clinic/schedules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '조회 실패');

      const activeList = (data.schedules || []).filter((s) => s.is_active);
      setSchedules(activeList);

      if (activeList.length > 0) {
        const initial = activeList[0];
        setSelectedScheduleId(initial.id);

        if (initial.myBooking) {
          setStartTime(initial.myBooking.start_time);
          setEndTime(initial.myBooking.end_time);
          if (initial.myBooking.subject) setSubject(initial.myBooking.subject);
        } else {
          // 기본 시작시간 및 2시간 후 종료시간 설정
          const initStart = initial.start_time || '10:00';
          const initStartMins = timeToMinutes(initStart);
          const initEndMins = Math.min(initStartMins + 120, timeToMinutes(initial.end_time || '18:00'));
          setStartTime(initStart);
          setEndTime(minutesToTime(initEndMins));
          setSubject('');
        }
      }
    } catch (err) {
      console.error('fetchSchedules error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // 현재 선택된 일정
  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.id === selectedScheduleId) || schedules[0] || null;
  }, [schedules, selectedScheduleId]);

  // 일정 변경 시 시간 초기화
  const handleSelectSchedule = (sched) => {
    setSelectedScheduleId(sched.id);
    if (sched.myBooking) {
      setStartTime(sched.myBooking.start_time);
      setEndTime(sched.myBooking.end_time);
      setSubject(sched.myBooking.subject || '');
    } else {
      const initStart = sched.start_time || '10:00';
      const initStartMins = timeToMinutes(initStart);
      const initEndMins = Math.min(initStartMins + 120, timeToMinutes(sched.end_time || '18:00'));
      setStartTime(initStart);
      setEndTime(minutesToTime(initEndMins));
      setSubject('');
    }
  };

  // 시작 가능한 30분 단위 시간 목록
  const possibleStartTimes = useMemo(() => {
    if (!currentSchedule) return [];
    const points = generateTimePoints(currentSchedule.start_time, currentSchedule.end_time, 30);
    // 마지막 포인트(운영종료시간)는 시작 시간이 될 수 없음 (최소 30분 수업이므로)
    return points.slice(0, points.length - 1);
  }, [currentSchedule]);

  // 선택된 시작 시간 기준으로 선택 가능한 종료 시간 목록
  const possibleEndTimes = useMemo(() => {
    if (!currentSchedule || !startTime) return [];
    const startMins = timeToMinutes(startTime);
    const schedEndMins = timeToMinutes(currentSchedule.end_time);
    const endPoints = [];

    for (let s = startMins + 30; s <= schedEndMins; s += 30) {
      endPoints.push(minutesToTime(s));
    }
    return endPoints;
  }, [currentSchedule, startTime]);

  // 시작 시간 변경 핸들러
  const handleStartTimeChange = (newStart) => {
    setStartTime(newStart);
    const startMins = timeToMinutes(newStart);
    const currentEndMins = timeToMinutes(endTime);
    const schedEndMins = timeToMinutes(currentSchedule?.end_time || '18:00');

    // 만약 현재 종료 시간이 새로운 시작 시간보다 앞서거나 같으면 2시간 뒤(또는 운영종료시간)로 자동 보정
    if (currentEndMins <= startMins) {
      const nextEndMins = Math.min(startMins + 120, schedEndMins);
      setEndTime(minutesToTime(nextEndMins));
    }
  };

  // 빠른 참여 시간(Duration) 프리셋 클릭
  const handleQuickDuration = (durationMinutes) => {
    const startMins = timeToMinutes(startTime);
    const schedEndMins = timeToMinutes(currentSchedule?.end_time || '18:00');
    const targetEndMins = Math.min(startMins + durationMinutes, schedEndMins);
    setEndTime(minutesToTime(targetEndMins));
  };

  // 현재 선택된 총 참여 시간(분)
  const currentDurationMinutes = useMemo(() => {
    return Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
  }, [startTime, endTime]);

  // 현재 선택된 시간 범위에 대한 실시간 정원/잔여석 상태 검증
  const capacityCheck = useMemo(() => {
    if (!currentSchedule || !startTime || !endTime || currentDurationMinutes <= 0) {
      return { isAvailable: false, isFull: false, remainingCapacity: null, isUnlimited: true };
    }

    return checkRangeCapacity(
      startTime,
      endTime,
      currentSchedule.bookings || [],
      currentSchedule.max_capacity,
      currentSchedule.myBooking?.id
    );
  }, [currentSchedule, startTime, endTime, currentDurationMinutes]);

  // 예약 신청 핸들러
  const handleBook = async () => {
    if (!currentSchedule || !startTime || !endTime) return alert('원하시는 시간대를 선택해 주세요.');
    if (currentDurationMinutes <= 0) return alert('종료 시간은 시작 시간보다 늦어야 합니다.');

    if (capacityCheck.isFull) {
      return alert('선택하신 시간대 중 일부가 이미 정원 마감되었습니다. 다른 시간을 선택해 주세요.');
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/clinic/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: currentSchedule.id,
          startTime,
          endTime,
          subject: subject.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '예약 신청 실패');

      alert(`🎉 [${currentSchedule.date} ${startTime} ~ ${endTime} (${formatDurationLabel(currentDurationMinutes)})] 클리닉 예약이 완료되었습니다!`);
      await fetchSchedules();
      if (onBookingUpdated) onBookingUpdated();
    } catch (err) {
      alert(`예약 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 예약 취소 핸들러
  const handleCancelBooking = async () => {
    if (!currentSchedule?.myBooking) return;
    if (!confirm('현재 예약된 클리닉을 취소하시겠습니까?')) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/clinic/bookings/${currentSchedule.myBooking.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '취소 실패');

      alert('클리닉 예약이 취소되었습니다.');
      await fetchSchedules();
      if (onBookingUpdated) onBookingUpdated();
    } catch (err) {
      alert(`취소 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-xs">
              ⏰
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>주말 클리닉 시간 선택</span>
                <span className="text-xs bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full font-bold">
                  30분 단위 자유 선택
                </span>
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                원하는 시작 시간과 참여 시간을 자유롭게 선택하여 예약하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-sm font-bold text-slate-400">
              열려있는 클리닉 일정을 확인하는 중입니다...
            </div>
          ) : schedules.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
              <div className="text-4xl">🏖️</div>
              <p className="text-sm font-bold text-slate-700">현재 오픈된 클리닉 일정이 없습니다.</p>
              <p className="text-xs text-slate-400">선생님이 일정을 개설하면 알림과 함께 열립니다.</p>
            </div>
          ) : (
            <>
              {/* 날짜 선택 탭 */}
              {schedules.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {schedules.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSchedule(s)}
                      className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
                        selectedScheduleId === s.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>📅</span>
                      <span>{s.date} ({s.title})</span>
                      {s.myBooking && (
                        <span className="text-[10px] bg-emerald-400 text-slate-950 font-black px-1.5 rounded">
                          예약됨
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {currentSchedule && (
                <div className="space-y-4">
                  
                  {/* 일정 안내 카드 */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span>📅</span>
                        <span>{currentSchedule.date} {currentSchedule.title}</span>
                      </span>
                      <span className="text-xs bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-lg border border-indigo-200">
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
                  {currentSchedule.myBooking && (
                    <div className="bg-emerald-50 border border-emerald-300 p-4 sm:p-5 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5">
                          <span>⭐</span>
                          <span>내 예약 현황: {currentSchedule.myBooking.start_time} ~ {currentSchedule.myBooking.end_time}</span>
                        </span>
                        <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md ${
                          currentSchedule.myBooking.status === 'ATTENDED'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-200 text-emerald-900'
                        }`}>
                          {currentSchedule.myBooking.status === 'ATTENDED' ? '✅ 출석 완료' : '📅 예약 확정'}
                        </span>
                      </div>
                      
                      {currentSchedule.myBooking.subject && (
                        <p className="text-xs text-emerald-800 font-bold pl-1">
                          📖 질문 과목/교재: {currentSchedule.myBooking.subject}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-emerald-700 text-[11px] font-medium">
                          아래에서 시간을 다시 골라 [시간 변경]하거나 [예약 취소]할 수 있습니다.
                        </span>
                        <button
                          onClick={handleCancelBooking}
                          disabled={submitting}
                          className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-black px-3 py-1 rounded-xl transition shadow-2xs"
                        >
                          예약 취소
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1️⃣ 시작 시간 선택 */}
                  <div className="space-y-2 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                    <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>1️⃣</span>
                        <span>클리닉 시작 시간 선택</span>
                      </span>
                      <span className="text-indigo-600 font-bold font-mono">
                        선택: {startTime}
                      </span>
                    </label>

                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {possibleStartTimes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleStartTimeChange(t)}
                          className={`py-2 px-1 rounded-xl text-xs font-black font-mono transition border ${
                            startTime === t
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2️⃣ 참여 시간 / 종료 시간 선택 */}
                  <div className="space-y-3 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                        <span>2️⃣</span>
                        <span>참여할 시간 (종료 시간) 선택</span>
                      </label>
                      <span className="text-indigo-600 font-bold font-mono">
                        {startTime} ~ {endTime} ({formatDurationLabel(currentDurationMinutes)})
                      </span>
                    </div>

                    {/* 빠른 수업 시간 프리셋 */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500">빠른 선택:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[60, 90, 120, 150, 180, 240].map((dur) => {
                          const isMatch = currentDurationMinutes === dur;
                          const targetEndMins = timeToMinutes(startTime) + dur;
                          const schedEndMins = timeToMinutes(currentSchedule.end_time);
                          if (targetEndMins > schedEndMins) return null;

                          return (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => handleQuickDuration(dur)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                                isMatch
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {formatDurationLabel(dur)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 직접 종료 시간 선택 드롭다운 */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-600">직접 종료 시간 선택:</span>
                      <select
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-slate-800 focus:outline-indigo-500"
                      >
                        {possibleEndTimes.map((t) => {
                          const dur = timeToMinutes(t) - timeToMinutes(startTime);
                          return (
                            <option key={t} value={t}>
                              {t}까지 ({formatDurationLabel(dur)})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* 3️⃣ 실시간 좌석/정원 상태 요약 배너 */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    capacityCheck.isFull
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-blue-50 border-blue-200 text-blue-950'
                  }`}>
                    <div className="space-y-0.5">
                      <div className="text-xs font-black flex items-center gap-1.5">
                        <span>⏰</span>
                        <span>예약 희망 시간:</span>
                        <span className="text-sm font-black text-indigo-950">
                          {startTime} ~ {endTime} ({formatDurationLabel(currentDurationMinutes)})
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-600">
                        {capacityCheck.isUnlimited
                          ? '👥 인원 제한 없이 자유롭게 예약하실 수 있습니다.'
                          : capacityCheck.isFull
                          ? '🚫 해당 시간대 중 일부가 정원 초과로 마감되었습니다. 다른 시간대를 골라주세요.'
                          : `🟢 현재 해당 시간대 잔여 좌석: ${capacityCheck.remainingCapacity}석`}
                      </p>
                    </div>

                    <div className="shrink-0">
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

                  {/* 질문할 교재 / 학습 내용 (선택사항) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                      <span>📖 질문할 내용 또는 공부할 교재 (선택)</span>
                      <span className="text-[11px] text-slate-400 font-normal">선생님이 미리 준비할 수 있습니다</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="예: 쎈 수1 삼각함수 오답 질문, 마플 시너지, 기출 풀이 등"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-indigo-500 focus:bg-white"
                    />
                  </div>

                  {/* 예약 신청 / 시간 변경 버튼 */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={capacityCheck.isFull || submitting || currentDurationMinutes <= 0}
                      onClick={handleBook}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-md shadow-indigo-600/20 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting
                        ? '예약 처리 중...'
                        : currentSchedule.myBooking
                        ? (currentSchedule.myBooking.start_time === startTime && currentSchedule.myBooking.end_time === endTime)
                          ? '✨ 선택한 시간대로 예약 확정 상태 유지'
                          : `✨ ${startTime} ~ ${endTime} (${formatDurationLabel(currentDurationMinutes)}) (으)로 시간 변경`
                        : `✨ ${startTime} ~ ${endTime} (${formatDurationLabel(currentDurationMinutes)}) 클리닉 예약 신청`}
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
