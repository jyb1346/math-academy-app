import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isStudentInTeacherScope } from '@/lib/teacherScope';

// PATCH /api/teacher/students/[id] — 담당 범위 내 원생 정보 수정 (담당 강사 재배정 포함)
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  if (!(await isStudentInTeacherScope(db, user.id, id))) {
    return NextResponse.json({ error: '본인 담당 범위의 학생만 수정할 수 있습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, parentPhone, teacherId } = body;

  const { error: updateErr } = await db
    .from('users')
    .update({
      name,
      email,
      parent_phone: parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '',
      teacher_id: teacherId || user.id,
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
