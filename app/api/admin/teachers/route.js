import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword } from '@/lib/securityUtils';

// POST /api/admin/teachers — 신규 강사 계정 생성 (원장 전용)
export async function POST(req) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { name, email } = body;
  if (!name || !name.trim() || !email || !email.trim()) {
    return NextResponse.json({ error: '강사 이름과 이메일/아이디를 입력해 주세요.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);
  const payload = {
    name: name.trim(),
    email: email.trim(),
    password: hashPassword('1234'),
    role: 'TEACHER',
  };

  const { error: insertErr } = await db.from('users').insert([payload]);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
