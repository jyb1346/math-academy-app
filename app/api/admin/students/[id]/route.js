import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH /api/admin/students/[id] — 원생 상세 정보 수정 또는 담당 강사 원클릭 변경 (원장 전용)
export async function PATCH(req, { params }) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const db = getSupabaseAdmin(req);

  // 담당 강사만 변경하는 경우
  if (body.teacherId !== undefined && body.name === undefined) {
    const { error: updateErr } = await db.from('users').update({ teacher_id: body.teacherId }).eq('id', id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { name, email, parentPhone, teacherId } = body;
  const { error: updateErr } = await db
    .from('users')
    .update({
      name,
      email,
      parent_phone: parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '',
      teacher_id: teacherId,
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/students/[id] — 원생 삭제 (반 배정/구독 정보까지 정리, 원장 전용)
export async function DELETE(req, { params }) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  await db.from('class_students').delete().eq('student_id', id);
  await db.from('push_subscriptions').delete().eq('user_id', id);
  const { error: deleteErr } = await db.from('users').delete().eq('id', id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
