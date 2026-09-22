import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/teacher/students/[id]/assign — 학생을 본인 담당 반 하나로 배정 (기존 배정 전체 교체)
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { classId } = body;
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const db = getSupabaseAdmin(req);

  const { data: cls } = await db.from('classes').select('id, teacher_id').eq('id', classId).maybeSingle();
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json({ error: '본인이 담당하는 반에만 배정할 수 있습니다.' }, { status: 403 });
  }

  await db.from('class_students').delete().eq('student_id', id);
  const { error: insertErr } = await db.from('class_students').insert([{ student_id: id, class_id: classId }]);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
