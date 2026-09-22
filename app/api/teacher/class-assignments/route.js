import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/teacher/class-assignments — 본인 담당 반의 학생 명단 일괄 교체
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { classId, studentIds } = body;
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const db = getSupabaseAdmin(req);

  const { data: cls } = await db.from('classes').select('id, teacher_id').eq('id', classId).maybeSingle();
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json({ error: '본인이 담당하는 반만 배정할 수 있습니다.' }, { status: 403 });
  }

  const { error: deleteErr } = await db.from('class_students').delete().eq('class_id', classId);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  if (Array.isArray(studentIds) && studentIds.length > 0) {
    const insertPayloads = studentIds.map((stId) => ({ student_id: stId, class_id: classId }));
    const { error: insertErr } = await db.from('class_students').insert(insertPayloads);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: (studentIds || []).length });
}
