import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/teacher/classes — 본인 담당 반 개설
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { name } = body;
  if (!name || !name.trim()) {
    return NextResponse.json({ error: '반 이름을 입력해 주세요.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);
  const { data, error: insertErr } = await db
    .from('classes')
    .insert([{ name: name.trim(), teacher_id: user.id }])
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
