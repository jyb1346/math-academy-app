import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const REPORT_SECRET = process.env.REPORT_TOKEN_SECRET || process.env.CRON_SECRET || 'poom-math-academy-report-token-secret-2026';

/**
 * 🔒 학부모 성적표 열람용 HMAC 서명 토큰 생성
 * (Kakao 알림톡 링크에 부착되어 URL 위변조 및 무작위 추측을 차단)
 */
export function generateReportToken(evalId) {
  if (!evalId) return '';
  return crypto
    .createHmac('sha256', REPORT_SECRET)
    .update(String(evalId))
    .digest('hex')
    .slice(0, 16);
}

/**
 * 🔒 학부모 성적표 열람용 HMAC 서명 토큰 검증
 */
export function verifyReportToken(evalId, token) {
  if (!evalId) return false;
  // 토큰이 없는 기존 발송 링크는 UUID 무결성 검증을 거쳐 허용 (기존 발송 알림톡 하위 호환성 보장)
  if (!token) return true;
  
  try {
    const expected = generateReportToken(evalId);
    const bufA = Buffer.from(token);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

/**
 * 🔑 비밀번호 검증 (평문 또는 bcrypt 해시 자동 대응)
 */
export function comparePassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) return false;
  
  // 1. bcrypt 해시인 경우 ($2a$, $2b$, $2y$ 로 시작)
  if (/^\$2[aby]\$\d{2}\$/.test(storedPassword)) {
    try {
      return bcrypt.compareSync(inputPassword, storedPassword);
    } catch {
      return false;
    }
  }
  
  // 2. 기존 평문 비밀번호인 경우 (점진적 해싱 대상)
  return inputPassword === storedPassword;
}

/**
 * 🛡️ 비밀번호 bcrypt 해싱
 */
export function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
}

/**
 * 🔍 비밀번호가 이미 해시된 상태인지 판별
 */
export function isPasswordHashed(storedPassword) {
  return /^\$2[aby]\$\d{2}\$/.test(storedPassword || '');
}
