/**
 * ⏰ 주말 클리닉 시간 계산 및 타임테이블 유틸리티 (30분 단위 자유 선택제)
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

// 분 -> "2시간 30분" 포맷
export function formatDurationLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/**
 * 30분 단위 시간 목록 생성 (시작~종료)
 * e.g. "10:00" ~ "18:00" -> ["10:00", "10:30", "11:00", ..., "18:00"]
 */
export function generateTimePoints(startTime, endTime, intervalMinutes = 30) {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const points = [];

  for (let s = startMins; s <= endMins; s += intervalMinutes) {
    points.push(minutesToTime(s));
  }

  return points;
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
 * 특정 시간 범위 [startTime, endTime]에 대한 정원 및 잔여석 검증
 */
export function checkRangeCapacity(startTime, endTime, bookings = [], maxCapacity = null, excludeBookingId = null) {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);

  const activeBookings = (bookings || []).filter(
    (b) => (b.status === 'BOOKED' || b.status === 'ATTENDED') &&
           (!excludeBookingId || b.id !== excludeBookingId)
  );

  const isUnlimited = maxCapacity === null || maxCapacity === undefined || Number(maxCapacity) <= 0;
  const capacityLimit = isUnlimited ? null : Number(maxCapacity);

  let peakCount = 0;
  const intervalMinutes = 30;

  for (let t = startMins; t < endMins; t += intervalMinutes) {
    const segStart = t;
    const segEnd = t + intervalMinutes;

    const countInSegment = activeBookings.filter((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return bStart < segEnd && bEnd > segStart;
    }).length;

    if (countInSegment > peakCount) {
      peakCount = countInSegment;
    }
  }

  const isFull = !isUnlimited && peakCount >= capacityLimit;
  const remainingCapacity = isUnlimited ? null : Math.max(0, capacityLimit - peakCount);

  return {
    isUnlimited,
    maxCapacity: capacityLimit,
    peakCount,
    isFull,
    remainingCapacity,
    isAvailable: !isFull,
  };
}

/**
 * 30분 단위 구간별 실시간 예약 가능 상태 목록 반환
 */
export function generateIntervalsWithAvailability(startTime, endTime, bookings = [], maxCapacity = null, excludeBookingId = null) {
  const intervals = generateTimeIntervals(startTime, endTime, 30);
  return intervals.map((interval) => {
    const check = checkRangeCapacity(interval.startTime, interval.endTime, bookings, maxCapacity, excludeBookingId);
    return {
      ...interval,
      ...check,
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
