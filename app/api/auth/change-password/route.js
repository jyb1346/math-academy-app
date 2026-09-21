import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { comparePassword, hashPassword } from '@/lib/securityUtils';

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '모든 비밀번호 필드를 입력해 주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: '새 비밀번호는 최소 4자리 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 1. 현재 사용자 조회
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id, name, email, role, phone, parent_phone, teacher_id, password')
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
    const { error: updateErr } = await supabase
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
