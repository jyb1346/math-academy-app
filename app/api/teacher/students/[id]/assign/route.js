import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/teacher/students/[id]/assign — 학생에게 반 추가 배정 또는 특정 반 배정 해제 (다중 수강/특강 지원)
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { classId, action } = body;
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const db = getSupabaseAdmin(req);

  const { data: cls } = await db.from('classes').select('id, teacher_id').eq('id', classId).maybeSingle();
  if (!cls || (cls.teacher_id !== user.id && user.role !== 'HEAD_TEACHER')) {
    return NextResponse.json({ error: '본인이 담당하는 반에만 배정/해제할 수 있습니다.' }, { status: 403 });
  }

  // 특정 반에서만 배정 해제 (다른 반 수강 정보는 그대로 보존)
  if (action === 'remove') {
    const { error: delErr } = await db
      .from('class_students')
      .delete()
      .eq('student_id', id)
      .eq('class_id', classId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, removed: true });
  }

  // 이미 해당 반에 배정되어 있는지 확인 (중복 방지 + 다른 반 배정 유지)
  const { data: existing } = await db
    .from('class_students')
    .select('student_id, class_id')
    .eq('student_id', id)
    .eq('class_id', classId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyAssigned: true });
  }

  const { error: insertErr } = await db
    .from('class_students')
    .insert([{ student_id: id, class_id: classId }]);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, added: true });
}
