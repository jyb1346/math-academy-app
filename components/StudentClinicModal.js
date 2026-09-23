'use client';

import { useState, useEffect, useMemo } from 'react';

export default function StudentClinicModal({ user, onClose, onBookingUpdated }) {
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
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
        // 첫 번째 일정 자동 선택
        const initial = activeList[0];
        setSelectedScheduleId(initial.id);

        // 만약 이미 예약된 슬롯이 있다면 그 슬롯을 기본 선택
        if (initial.myBooking) {
          const matched = initial.slots?.find((sl) => sl.startTime === initial.myBooking.start_time);
          if (matched) setSelectedSlot(matched);
          if (initial.myBooking.subject) setSubject(initial.myBooking.subject);
        } else if (initial.slots?.length > 0) {
          // 첫 번째 예약 가능한 슬롯 선택
          const firstAvail = initial.slots.find((sl) => sl.isAvailable) || initial.slots[0];
          setSelectedSlot(firstAvail);
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

  // 일정 변경 시 슬롯 및 메모 동기화
  const handleSelectSchedule = (sched) => {
    setSelectedScheduleId(sched.id);
    if (sched.myBooking) {
      const matched = sched.slots?.find((sl) => sl.startTime === sched.myBooking.start_time);
      setSelectedSlot(matched || null);
      setSubject(sched.myBooking.subject || '');
    } else {
      const firstAvail = sched.slots?.find((sl) => sl.isAvailable) || sched.slots?.[0] || null;
      setSelectedSlot(firstAvail);
      setSubject('');
    }
  };

  // 예약 신청 핸들러
  const handleBook = async () => {
    if (!currentSchedule || !selectedSlot) return alert('원하시는 시간대를 선택해 주세요.');

    try {
      setSubmitting(true);
      const res = await fetch('/api/clinic/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: currentSchedule.id,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          subject: subject.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '예약 신청 실패');

      alert(`🎉 [${currentSchedule.date} ${selectedSlot.startTime} ~ ${selectedSlot.endTime}] 2시간 클리닉 예약이 완료되었습니다!`);
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
                  2시간 수업
                </span>
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                원하는 시작 시간을 선택하시면 2시간 동안 맞춤 개별 학습이 진행됩니다.
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
              <p className="text-xs text-slate-400">선생님이 일정을 개설하면 푸시 알림과 함께 열립니다.</p>
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
                          <span>내 예약 현황: {currentSchedule.myBooking.start_time} ~ {currentSchedule.myBooking.end_time} (2시간)</span>
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
                          다른 시간대를 클릭하여 [시간 변경]하거나 [예약 취소]할 수 있습니다.
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

                  {/* 30분 단위 슬롯 선택 영역 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                        <span>⏰</span>
                        <span>원하는 수업 시간대 선택 (2시간 단위)</span>
                      </label>
                      <span className="text-[11px] font-bold text-slate-500">
                        {currentSchedule.max_capacity ? `타임당 정원 ${currentSchedule.max_capacity}명` : '인원 제한 없음'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {currentSchedule.slots?.map((slot) => {
                        const isSelected = selectedSlot?.startTime === slot.startTime;
                        const isMyBookedSlot = currentSchedule.myBooking?.start_time === slot.startTime;
                        const isFull = !slot.isAvailable && !isMyBookedSlot;

                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            disabled={isFull}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 relative ${
                              isFull
                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500 shadow-sm'
                                : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-black ${
                                isSelected ? 'text-indigo-950' : 'text-slate-800'
                              }`}>
                                {slot.startTime} ~ {slot.endTime}
                              </span>
                              {isSelected && (
                                <span className="text-indigo-600 text-xs font-black">✓</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="text-slate-500 font-bold">2시간</span>
                              {isFull ? (
                                <span className="font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  마감
                                </span>
                              ) : isMyBookedSlot ? (
                                <span className="font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                  내 예약
                                </span>
                              ) : slot.isUnlimited ? (
                                <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                                  신청 가능
                                </span>
                              ) : (
                                <span className={`font-bold px-1.5 py-0.2 rounded ${
                                  slot.remainingCapacity <= 2
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-50 text-emerald-800'
                                }`}>
                                  잔여 {slot.remainingCapacity}명
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 질문할 교재 / 학습 내용 (선택사항) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                      <span>📖 질문할 내용 또는 교재 (선택)</span>
                      <span className="text-[11px] text-slate-400 font-normal">선생님이 미리 준비할 수 있습니다</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="예: 쎈 수1 삼각함수 오답 질문, 마플 시너지 등"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-indigo-500 focus:bg-white"
                    />
                  </div>

                  {/* 예약 신청 / 시간 변경 버튼 */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!selectedSlot || submitting || (!selectedSlot.isAvailable && currentSchedule.myBooking?.start_time !== selectedSlot.startTime)}
                      onClick={handleBook}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-md shadow-indigo-600/20 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting
                        ? '예약 처리 중...'
                        : currentSchedule.myBooking
                        ? selectedSlot?.startTime === currentSchedule.myBooking.start_time
                          ? '✨ 선택한 시간대로 예약 확정 상태 유지'
                          : `✨ ${selectedSlot?.startTime} ~ ${selectedSlot?.endTime} (으)로 시간 변경하기`
                        : `✨ ${selectedSlot?.startTime} ~ ${selectedSlot?.endTime} 2시간 클리닉 예약 신청`}
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
