import { NextResponse } from 'next/server';
import { requireSession, attachSessionCookie } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  // role/name 변경이 즉시 반영되도록 세션 페이로드가 아닌 DB에서 최신 값을 다시 조회
  const db = getSupabaseAdmin(req);
  const { data: freshUser } = await db
    .from('users')
    .select('id, name, email, role, parent_phone, teacher_id, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!freshUser) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 401 });
  }

  const res = NextResponse.json({ user: freshUser });
  // Sliding session: 접속할 때마다 쿠키 만료일을 다시 180일로 연장
  attachSessionCookie(res, freshUser);
  return res;
}
