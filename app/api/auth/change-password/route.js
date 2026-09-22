import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { comparePassword, hashPassword } from '@/lib/securityUtils';
import { requireSession } from '@/lib/session';

export async function POST(req) {
  try {
    const { user: sessionUser, error: sessionError } = requireSession(req);
    if (sessionError) return sessionError;

    const body = await req.json();
    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '모든 비밀번호 필드를 입력해 주세요.' },
        { status: 400 }
      );
    }

    // 본인 계정만 변경 가능 (세션의 사용자와 요청된 userId가 다르면 거부)
    if (userId !== sessionUser.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: '새 비밀번호는 최소 4자리 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const dbClient = getSupabaseAdmin(req);

    // 1. 현재 사용자 조회
    const { data: user, error: fetchErr } = await dbClient
      .from('users')
      .select('id, name, email, role, parent_phone, teacher_id, password')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 현재 비밀번호 검증
    const isCurrentValid = comparePassword(currentPassword.trim(), user.password);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: '현재 비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 3. 새 비밀번호 bcrypt 해싱 후 DB 저장
    const hashedNewPassword = hashPassword(newPassword.trim());
    const { error: updateErr } = await dbClient
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', userId);

    if (updateErr) {
      throw updateErr;
    }

    const { password: _, ...safeUser } = user;

    return NextResponse.json({
      ok: true,
      message: '비밀번호가 안전하게 변경되었습니다.',
      user: safeUser,
    });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json(
      { error: err.message || '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
