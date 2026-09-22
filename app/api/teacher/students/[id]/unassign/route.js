import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/teacher/students/[id]/unassign — 본인 담당 수업(반)에서만 학생 제외 (계정/성적은 유지)
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: myClasses } = await db.from('classes').select('id').eq('teacher_id', user.id);
  const myClassIds = (myClasses || []).map((c) => c.id);

  if (myClassIds.length > 0) {
    await db.from('class_students').delete().eq('student_id', id).in('class_id', myClassIds);
  }

  const { data: student } = await db.from('users').select('teacher_id').eq('id', id).maybeSingle();
  if (student?.teacher_id === user.id) {
    await db.from('users').update({ teacher_id: null }).eq('id', id);
  }

  return NextResponse.json({ ok: true });
}
