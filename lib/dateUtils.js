/**
 * ⏰ 한국 표준시(KST, Asia/Seoul, UTC+9) 기준 날짜 및 시간 유틸리티
 */

export function getKSTDateString(date = new Date()) {
  try {
    const target = date instanceof Date ? date : new Date(date);
    if (isNaN(target.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(target);
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

export function getKSTNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (9 * 3600000));
}
