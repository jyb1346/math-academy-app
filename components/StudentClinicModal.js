'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  timeToMinutes,
  minutesToTime,
  formatDurationLabel,
  generateIntervalsWithAvailability,
  checkRangeCapacity,
} from '@/lib/clinicUtils';

export default function StudentClinicModal({ user, onClose, onBookingUpdated }) {
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);

  // 선택된 30분 블록들의 시작 시간 목록 (예: ['10:00', '10:30', '11:00', '11:30'])
  const [selectedBlocks, setSelectedBlocks] = useState(['10:00', '10:30', '11:00', '11:30']);
  const [subject, setSubject] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
        const initial = activeList[0];
        setSelectedScheduleId(initial.id);

        if (initial.myBooking) {
          // 기존 예약이 있으면 해당 시간대 블록들 선택
          const startM = timeToMinutes(initial.myBooking.start_time);
          const endM = timeToMinutes(initial.myBooking.end_time);
          const blocks = [];
          for (let m = startM; m < endM; m += 30) {
            blocks.push(minutesToTime(m));
          }
          setSelectedBlocks(blocks);
          if (initial.myBooking.subject) setSubject(initial.myBooking.subject);
        } else {
          // 기본 2시간 (4개 블록) 또는 첫 번째 블록 선택
          const initStartM = timeToMinutes(initial.start_time || '10:00');
          const schedEndM = timeToMinutes(initial.end_time || '18:00');
          const blocks = [];
          for (let m = initStartM; m < Math.min(initStartM + 120, schedEndM); m += 30) {
            blocks.push(minutesToTime(m));
          }
          setSelectedBlocks(blocks.length > 0 ? blocks : [initial.start_time]);
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

  // 30분 단위 블록 목록 및 각 블록별 잔여석/마감 상태
  const intervals = useMemo(() => {
    if (!currentSchedule) return [];
    return generateIntervalsWithAvailability(
      currentSchedule.start_time,
      currentSchedule.end_time,
      currentSchedule.bookings || [],
      currentSchedule.max_capacity,
      currentSchedule.myBooking?.id
    );
  }, [currentSchedule]);

  // 일정 변경 시
  const handleSelectSchedule = (sched) => {
    setSelectedScheduleId(sched.id);
    if (sched.myBooking) {
      const startM = timeToMinutes(sched.myBooking.start_time);
      const endM = timeToMinutes(sched.myBooking.end_time);
      const blocks = [];
      for (let m = startM; m < endM; m += 30) {
        blocks.push(minutesToTime(m));
      }
      setSelectedBlocks(blocks);
      setSubject(sched.myBooking.subject || '');
    } else {
      const initStartM = timeToMinutes(sched.start_time || '10:00');
      const schedEndM = timeToMinutes(sched.end_time || '18:00');
      const blocks = [];
      for (let m = initStartM; m < Math.min(initStartM + 120, schedEndM); m += 30) {
        blocks.push(minutesToTime(m));
      }
      setSelectedBlocks(blocks.length > 0 ? blocks : [sched.start_time]);
      setSubject('');
    }
  };

  // 30분 블록 클릭 핸들러 (연속 구간 자동 선택)
  const handleToggleBlock = (blockStartTime, isBlockFull) => {
    if (isBlockFull) return;

    if (selectedBlocks.length === 0) {
      setSelectedBlocks([blockStartTime]);
      return;
    }

    const clickedMins = timeToMinutes(blockStartTime);
    const sortedSelectedMins = [...selectedBlocks]
      .map(timeToMinutes)
      .sort((a, b) => a - b);

    const minMins = sortedSelectedMins[0];
    const maxMins = sortedSelectedMins[sortedSelectedMins.length - 1];

    if (clickedMins === minMins && clickedMins === maxMins) {
      // 단일 선택된 상태에서 다시 누르면 유지
      return;
    }

    if (clickedMins < minMins) {
      // 앞쪽으로 확장
      const newBlocks = [];
      for (let m = clickedMins; m <= maxMins; m += 30) {
        newBlocks.push(minutesToTime(m));
      }
      setSelectedBlocks(newBlocks);
    } else if (clickedMins > maxMins) {
      // 뒤쪽으로 확장
      const newBlocks = [];
      for (let m = minMins; m <= clickedMins; m += 30) {
        newBlocks.push(minutesToTime(m));
      }
      setSelectedBlocks(newBlocks);
    } else {
      // 선택 구간 내부를 클릭한 경우
      if (clickedMins === minMins) {
        // 시작점 축소
        const newBlocks = [];
        for (let m = minMins + 30; m <= maxMins; m += 30) {
          newBlocks.push(minutesToTime(m));
        }
        setSelectedBlocks(newBlocks);
      } else if (clickedMins === maxMins) {
        // 끝점 축소
        const newBlocks = [];
        for (let m = minMins; m <= maxMins - 30; m += 30) {
          newBlocks.push(minutesToTime(m));
        }
        setSelectedBlocks(newBlocks);
      } else {
        // 중간을 클릭한 경우 해당 지점까지로 끝점 단축
        const newBlocks = [];
        for (let m = minMins; m <= clickedMins; m += 30) {
          newBlocks.push(minutesToTime(m));
        }
        setSelectedBlocks(newBlocks);
      }
    }
  };

  // 선택된 시작 시간 및 종료 시간 계산
  const { startTime, endTime, totalMinutes } = useMemo(() => {
    if (selectedBlocks.length === 0) {
      return { startTime: '', endTime: '', totalMinutes: 0 };
    }
    const sorted = [...selectedBlocks]
      .map(timeToMinutes)
      .sort((a, b) => a - b);

    const startM = sorted[0];
    const endM = sorted[sorted.length - 1] + 30;

    return {
      startTime: minutesToTime(startM),
      endTime: minutesToTime(endM),
      totalMinutes: endM - startM,
    };
  }, [selectedBlocks]);

  // 전체 선택된 구간의 정원 체크
  const capacityCheck = useMemo(() => {
    if (!currentSchedule || !startTime || !endTime || totalMinutes <= 0) {
      return { isAvailable: false, isFull: false, remainingCapacity: null, isUnlimited: true };
    }

    return checkRangeCapacity(
      startTime,
      endTime,
      currentSchedule.bookings || [],
      currentSchedule.max_capacity,
      currentSchedule.myBooking?.id
    );
  }, [currentSchedule, startTime, endTime, totalMinutes]);

  // 예약 신청 핸들러
  const handleBook = async () => {
    if (!currentSchedule || !startTime || !endTime || totalMinutes <= 0) {
      return alert('원하시는 시간 블록을 1개 이상 선택해 주세요.');
    }

    if (capacityCheck.isFull) {
      return alert('선택하신 시간대 중 일부가 이미 정원 마감되었습니다. 다른 블록을 선택해 주세요.');
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

      alert(`🎉 [${currentSchedule.date} ${startTime} ~ ${endTime} (${formatDurationLabel(totalMinutes)})] 클리닉 예약이 완료되었습니다!`);
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
                  시간 선택
                </span>
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                원하는 30분 단위 시간 블록들을 터치하여 예약하세요.
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
                          아래 블록을 다시 골라 [시간 변경]하거나 [예약 취소]할 수 있습니다.
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

                  {/* ⏰ 30분 단위 블록 선택 영역 */}
                  <div className="space-y-2.5 bg-slate-50/90 p-4 sm:p-5 rounded-3xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span>⏰</span>
                        <span>참여할 시간 블록 선택 (터치하여 구간 지정)</span>
                      </label>
                      <span className="text-[11px] font-bold text-slate-500">
                        {currentSchedule.max_capacity ? `타임당 정원 ${currentSchedule.max_capacity}명` : '인원 제한 없음'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {intervals.map((item) => {
                        const isSelected = selectedBlocks.includes(item.startTime);
                        const isFull = item.isFull;

                        return (
                          <button
                            key={item.startTime}
                            type="button"
                            disabled={isFull}
                            onClick={() => handleToggleBlock(item.startTime, isFull)}
                            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 relative select-none ${
                              isFull
                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-700 shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
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
                                <span className="bg-white/20 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                  ✓ 선택
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className={`font-semibold ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                30분
                              </span>
                              {isFull ? (
                                <span className="font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  마감
                                </span>
                              ) : isSelected ? (
                                <span className="font-bold text-white bg-white/20 px-1.5 py-0.2 rounded">
                                  선택됨
                                </span>
                              ) : item.isUnlimited ? (
                                <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                                  신청 가능
                                </span>
                              ) : (
                                <span className={`font-bold px-1.5 py-0.2 rounded ${
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
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      capacityCheck.isFull
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-blue-50 border-blue-200 text-blue-950'
                    }`}>
                      <div className="space-y-0.5">
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <span>⏰</span>
                          <span>선택한 시간:</span>
                          <span className="text-sm font-black text-indigo-950">
                            {startTime} ~ {endTime} ({formatDurationLabel(totalMinutes)})
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600">
                          {capacityCheck.isUnlimited
                            ? '👥 인원 제한 없이 자유롭게 예약하실 수 있습니다.'
                            : capacityCheck.isFull
                            ? '🚫 선택한 구간 중 마감된 시간대가 포함되어 있습니다.'
                            : `🟢 예약 가능 (해당 구간 최소 잔여: ${capacityCheck.remainingCapacity}석)`}
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
                  )}

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
                      disabled={capacityCheck.isFull || submitting || totalMinutes <= 0}
                      onClick={handleBook}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-md shadow-indigo-600/20 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting
                        ? '예약 처리 중...'
                        : currentSchedule.myBooking
                        ? (currentSchedule.myBooking.start_time === startTime && currentSchedule.myBooking.end_time === endTime)
                          ? '✨ 선택한 시간대로 예약 확정 상태 유지'
                          : `✨ ${startTime} ~ ${endTime} (${formatDurationLabel(totalMinutes)}) (으)로 시간 변경`
                        : `✨ ${startTime} ~ ${endTime} (${formatDurationLabel(totalMinutes)}) 클리닉 예약 신청`}
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
