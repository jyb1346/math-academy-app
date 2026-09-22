import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// DELETE /api/teacher/classes/[id] — 본인 담당 반 삭제
export async function DELETE(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: cls, error: findErr } = await db.from('classes').select('id, teacher_id').eq('id', id).maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!cls) return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
  if (cls.teacher_id !== user.id) {
    return NextResponse.json({ error: '본인이 담당하는 반만 삭제할 수 있습니다.' }, { status: 403 });
  }

  await db.from('class_students').delete().eq('class_id', id);
  const { error: deleteErr } = await db.from('classes').delete().eq('id', id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
