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
export function checkRangeCapacity(
  startTime,
  endTime,
  bookings = [],
  maxCapacity = null,
  excludeStudentId = null,
  excludeBookingId = null
) {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);

  const activeBookings = (bookings || []).filter(
    (b) =>
      (b.status === 'BOOKED' || b.status === 'ATTENDED') &&
      (!excludeStudentId || b.student_id !== excludeStudentId) &&
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
 * 30분 단위 블록 시작 시간 목록을 연속된 시간 범위(구간) 목록으로 변환
 * e.g. ["13:00", "13:30", "16:00", "16:30", "17:00"]
 *   -> [
 *        { startTime: "13:00", endTime: "14:00", durationMinutes: 60, startMins: 780, endMins: 840 },
 *        { startTime: "16:00", endTime: "17:30", durationMinutes: 90, startMins: 960, endMins: 1050 }
 *      ]
 */
export function blocksToRanges(blockStartTimes = []) {
  if (!blockStartTimes || blockStartTimes.length === 0) return [];

  const sortedMins = [...new Set(blockStartTimes.map(timeToMinutes))].sort((a, b) => a - b);
  if (sortedMins.length === 0) return [];

  const ranges = [];
  let currentStart = sortedMins[0];
  let currentEnd = sortedMins[0] + 30;

  for (let i = 1; i < sortedMins.length; i++) {
    const min = sortedMins[i];
    if (min === currentEnd) {
      currentEnd = min + 30;
    } else {
      ranges.push({
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(currentEnd),
        startMins: currentStart,
        endMins: currentEnd,
        durationMinutes: currentEnd - currentStart,
        label: `${minutesToTime(currentStart)} ~ ${minutesToTime(currentEnd)}`,
      });
      currentStart = min;
      currentEnd = min + 30;
    }
  }

  ranges.push({
    startTime: minutesToTime(currentStart),
    endTime: minutesToTime(currentEnd),
    startMins: currentStart,
    endMins: currentEnd,
    durationMinutes: currentEnd - currentStart,
    label: `${minutesToTime(currentStart)} ~ ${minutesToTime(currentEnd)}`,
  });

  return ranges;
}

/**
 * 다중 구간 요약 텍스트 포맷팅 (1차, 2차 접두사 제거 및 깔끔한 표현)
 * e.g. "10:00~12:00 (2시간) + 13:30~14:00 (30분) [총 2시간 30분]"
 */
export function formatRangesSummary(ranges = []) {
  if (!ranges || ranges.length === 0) return '';
  const totalMins = ranges.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);

  if (ranges.length === 1) {
    return `${ranges[0].startTime} ~ ${ranges[0].endTime} (${formatDurationLabel(ranges[0].durationMinutes)})`;
  }

  const parts = ranges.map(
    (r) => `${r.startTime}~${r.endTime} (${formatDurationLabel(r.durationMinutes)})`
  );
  return `${parts.join(' + ')} [총 ${formatDurationLabel(totalMins)}]`;
}

/**
 * 버튼용 컴팩트 텍스트 포맷팅 (모바일 버튼 줄바꿈/과밀 방지)
 * e.g. "총 4시간 (5개 타임) 예약 신청하기"
 */
export function formatRangesButtonLabel(ranges = [], actionType = 'BOOK') {
  if (!ranges || ranges.length === 0) return '시간대를 선택해 주세요';
  const totalMins = ranges.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
  const durStr = formatDurationLabel(totalMins);
  const countStr = ranges.length > 1 ? ` (${ranges.length}개 타임)` : '';

  if (actionType === 'RESCHEDULE_REQUEST') {
    return `총 ${durStr}${countStr} 시간 변경 승인 요청`;
  }
  if (actionType === 'CHANGE') {
    return `총 ${durStr}${countStr} 예약 변경 저장하기`;
  }
  if (actionType === 'PROXY') {
    return `배정 완료 (총 ${durStr})`;
  }
  return `총 ${durStr}${countStr} 클리닉 예약 신청하기`;
}

/**
 * 대시보드 카드용 컴팩트 요약 텍스트
 * e.g. "총 4시간 (10:00~12:00, 13:30~14:00 외 3개)"
 */
export function formatBookingsCompact(bookings = []) {
  if (!bookings || bookings.length === 0) return '';
  const ranges = bookings[0]?.start_time
    ? bookings.map((b) => ({
        startTime: b.start_time,
        endTime: b.end_time,
        durationMinutes: timeToMinutes(b.end_time) - timeToMinutes(b.start_time),
      }))
    : ranges;

  const totalMins = ranges.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
  const durStr = formatDurationLabel(totalMins);

  if (ranges.length === 1) {
    return `총 ${durStr} (${ranges[0].startTime}~${ranges[0].endTime})`;
  }
  if (ranges.length <= 2) {
    return `총 ${durStr} (${ranges.map((r) => `${r.startTime}~${r.endTime}`).join(', ')})`;
  }
  return `총 ${durStr} (${ranges[0].startTime}~${ranges[0].endTime}, ${ranges[1].startTime}~${ranges[1].endTime} 외 ${ranges.length - 2}개)`;
}

/**
 * 다중 구간 전체에 대한 정원 초과 여부 검증
 */
export function checkMultipleRangesCapacity(
  ranges = [],
  bookings = [],
  maxCapacity = null,
  excludeStudentId = null,
  excludeBookingId = null
) {
  if (!ranges || ranges.length === 0) {
    return { isAvailable: false, isFull: false, minRemainingCapacity: null, isUnlimited: true };
  }

  const isUnlimited = maxCapacity === null || maxCapacity === undefined || Number(maxCapacity) <= 0;
  let isAnyFull = false;
  let minRemaining = isUnlimited ? null : Infinity;

  for (const range of ranges) {
    const check = checkRangeCapacity(
      range.startTime,
      range.endTime,
      bookings,
      maxCapacity,
      excludeStudentId,
      excludeBookingId
    );

    if (check.isFull) {
      isAnyFull = true;
    }
    if (!isUnlimited && check.remainingCapacity !== null && check.remainingCapacity < minRemaining) {
      minRemaining = check.remainingCapacity;
    }
  }

  return {
    isUnlimited,
    maxCapacity: isUnlimited ? null : Number(maxCapacity),
    isFull: isAnyFull,
    isAvailable: !isAnyFull,
    remainingCapacity: isUnlimited ? null : (minRemaining === Infinity ? 0 : minRemaining),
  };
}

/**
 * 30분 단위 구간별 실시간 예약 가능 상태 목록 반환
 */
export function generateIntervalsWithAvailability(
  startTime,
  endTime,
  bookings = [],
  maxCapacity = null,
  excludeStudentId = null,
  excludeBookingId = null
) {
  const intervals = generateTimeIntervals(startTime, endTime, 30);
  return intervals.map((interval) => {
    const check = checkRangeCapacity(
      interval.startTime,
      interval.endTime,
      bookings,
      maxCapacity,
      excludeStudentId,
      excludeBookingId
    );
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
