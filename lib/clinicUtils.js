/**
 * ⏰ 주말 클리닉 시간 계산 및 타임테이블 유틸리티
 */

// "14:30" -> 870분
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// 870분 -> "14:30"
export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 운영 시간(시작~종료) 내에서 가능한 2시간 슬롯 후보들을 생성
 * @param {string} startTime - e.g. "10:00"
 * @param {string} endTime - e.g. "18:00"
 * @param {number} intervalMinutes - 시작 간격 (기본 30분)
 * @param {number} durationMinutes - 수업 시간 (기본 120분 = 2시간)
 */
export function generateCandidateSlots(startTime, endTime, intervalMinutes = 30, durationMinutes = 120) {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const slots = [];

  for (let s = startMins; s + durationMinutes <= endMins; s += intervalMinutes) {
    const e = s + durationMinutes;
    slots.push({
      startTime: minutesToTime(s),
      endTime: minutesToTime(e),
      startMins: s,
      endMins: e,
    });
  }

  return slots;
}

/**
 * 30분 단위 기본 구간(Intervals) 생성
 */
export function generateTimeIntervals(startTime, endTime, intervalMinutes = 30) {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const intervals = [];

  for (let s = startMins; s < endMins; s += intervalMinutes) {
    intervals.push({
      startMins: s,
      endMins: s + intervalMinutes,
      startTime: minutesToTime(s),
      endTime: minutesToTime(s + intervalMinutes),
      label: `${minutesToTime(s)} ~ ${minutesToTime(s + intervalMinutes)}`,
    });
  }

  return intervals;
}

/**
 * 특정 슬롯들의 실시간 동시 재실 인원 및 예약 가능 여부 계산
 * @param {Array} candidateSlots - generateCandidateSlots 결과
 * @param {Array} bookings - 기존 예약 목록 (status !== 'CANCELLED')
 * @param {number|null} maxCapacity - null 또는 0이면 무제한
 */
export function calculateSlotAvailability(candidateSlots, bookings = [], maxCapacity = null) {
  const activeBookings = (bookings || []).filter(
    (b) => b.status === 'BOOKED' || b.status === 'ATTENDED'
  );

  const isUnlimited = maxCapacity === null || maxCapacity === undefined || Number(maxCapacity) <= 0;
  const capacityLimit = isUnlimited ? null : Number(maxCapacity);

  return candidateSlots.map((slot) => {
    // 30분 단위로 세부 체크 (예: 10:00~12:00 이면 10:00~10:30, 10:30~11:00, 11:00~11:30, 11:30~12:00)
    let peakCount = 0;
    const intervalMinutes = 30;

    for (let t = slot.startMins; t < slot.endMins; t += intervalMinutes) {
      const segStart = t;
      const segEnd = t + intervalMinutes;

      // 이 30분 구간에 걸쳐있는 활성 예약자 수
      const countInSegment = activeBookings.filter((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        // 겹치는 조건: bStart < segEnd && bEnd > segStart
        return bStart < segEnd && bEnd > segStart;
      }).length;

      if (countInSegment > peakCount) {
        peakCount = countInSegment;
      }
    }

    const isFull = !isUnlimited && peakCount >= capacityLimit;
    const remainingCapacity = isUnlimited ? null : Math.max(0, capacityLimit - peakCount);

    return {
      ...slot,
      isUnlimited,
      maxCapacity: capacityLimit,
      peakCount,
      isFull,
      remainingCapacity,
      isAvailable: !isFull,
    };
  });
}

/**
 * 선생님 타임테이블 뷰용 데이터 생성
 * 30분 간격별로 현재 머무는 학생 목록 반환
 */
export function generateTeacherTimetableGrid(startTime, endTime, bookings = []) {
  const intervals = generateTimeIntervals(startTime, endTime, 30);
  const activeBookings = (bookings || []).filter((b) => b.status !== 'CANCELLED');

  return intervals.map((interval) => {
    const presentBookings = activeBookings.filter((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return bStart < interval.endMins && bEnd > interval.startMins;
    });

    return {
      ...interval,
      bookings: presentBookings,
      count: presentBookings.length,
    };
  });
}
