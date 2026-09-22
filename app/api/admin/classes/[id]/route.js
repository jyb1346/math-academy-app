import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// DELETE /api/admin/classes/[id] — 반 삭제 (원장 전용, 배정 정보도 함께 정리)
export async function DELETE(req, { params }) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  await db.from('class_students').delete().eq('class_id', id);
  const { error: deleteErr } = await db.from('classes').delete().eq('id', id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
