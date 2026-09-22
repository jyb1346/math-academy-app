import crypto from 'crypto';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.');
  }
  return secret;
}

function base64urlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(body) {
  return crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
}

/**
 * 로그인 성공 시 발급하는 HMAC 서명 세션 토큰 생성
 */
export function createSessionToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

/**
 * 세션 토큰 서명 및 만료 검증. 통과 시 { id, role, name } 반환, 실패 시 null.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const expectedSignature = sign(body);
    const bufA = Buffer.from(signature);
    const bufB = Buffer.from(expectedSignature);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.id || !payload.exp || payload.exp < Date.now()) return null;

    return { id: payload.id, role: payload.role, name: payload.name };
  } catch (e) {
    return null;
  }
}

/**
 * 요청(NextRequest)의 세션 쿠키에서 로그인 사용자 정보 추출
 */
export function getSessionUser(req) {
  const token = req.cookies?.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * 로그인 성공 응답에 httpOnly 세션 쿠키를 부착
 */
export function attachSessionCookie(res, user) {
  res.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return res;
}

/**
 * 로그아웃 응답에서 세션 쿠키 제거
 */
export function clearSessionCookie(res) {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

/**
 * 세션이 없으면 401 응답을 돌려주는 가드.
 * 사용: const { user, error } = requireSession(req); if (error) return error;
 */
export function requireSession(req) {
  const user = getSessionUser(req);
  if (!user) {
    return { user: null, error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  return { user, error: null };
}

/**
 * 세션 + 역할 제한 가드. roles는 허용 역할 배열.
 */
export function requireRole(req, roles) {
  const { user, error } = requireSession(req);
  if (error) return { user: null, error };
  if (!roles.includes(user.role)) {
    return { user: null, error: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }) };
  }
  return { user, error: null };
}
