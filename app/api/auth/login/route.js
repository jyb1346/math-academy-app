import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { comparePassword, hashPassword, isPasswordHashed } from '@/lib/securityUtils';
import { attachSessionCookie } from '@/lib/session';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 모두 입력해 주세요.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    const dbClient = getSupabaseAdmin(req);

    // 1. 서버에서 사용자 정보 조회 (비밀번호 컬럼은 클라이언트로 노출되지 않음)
    const { data: user, error } = await dbClient
      .from('users')
      .select('id, name, email, role, parent_phone, teacher_id, password, created_at')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 2. 비밀번호 검증 (평문 및 bcrypt 해시 모두 지원)
    const isValid = comparePassword(cleanPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 3. 🚀 점진적 보안 업그레이드: 기존 평문 비밀번호인 경우 자동으로 bcrypt 해싱하여 DB 갱신
    if (!isPasswordHashed(user.password)) {
      try {
        const hashedPassword = hashPassword(cleanPassword);
        await dbClient
          .from('users')
          .update({ password: hashedPassword })
          .eq('id', user.id);
      } catch (hashErr) {
        console.warn('Auto-hashing password failed silently:', hashErr);
      }
    }

    // 4. 클라이언트 반환 시 비밀번호 필드 완전 제거
    const { password: _, ...safeUser } = user;

    const res = NextResponse.json({
      ok: true,
      user: safeUser,
    });

    // 5. 서버 인증의 근거가 되는 httpOnly 세션 쿠키 발급 (localStorage는 화면 표시용 캐시일 뿐, 권한 판단에 쓰지 않음)
    attachSessionCookie(res, safeUser);

    return res;
  } catch (err) {
    console.error('Login auth error:', err);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
