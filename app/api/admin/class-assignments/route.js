import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/admin/class-assignments — 반 학생 일괄 배정 (기존 배정 전부 교체, 원장 전용)
export async function POST(req) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { classId, studentIds } = body;
  if (!classId) {
    return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  const { error: deleteErr } = await db.from('class_students').delete().eq('class_id', classId);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  if (Array.isArray(studentIds) && studentIds.length > 0) {
    const insertPayloads = studentIds.map((stId) => ({ student_id: stId, class_id: classId }));
    const { error: insertErr } = await db.from('class_students').insert(insertPayloads);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: (studentIds || []).length });
}
