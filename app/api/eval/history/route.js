import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/eval/history — 담당 강사의 전체 학생 명단 + 본인이 작성한 과제표 히스토리
export async function GET(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  // 1) 직속 학생
  const { data: directStData } = await db
    .from('users')
    .select('id, name, email')
    .eq('role', 'STUDENT')
    .eq('teacher_id', user.id);

  // 2) 내가 담당하는 반
  const { data: cData } = await db.from('classes').select('*').eq('teacher_id', user.id);
  const myClasses = cData || [];

  // 3) 전체 배정 정보 중 내 반에 해당하는 것만
  const { data: csData } = await db.from('class_students').select('*');
  const myClassIds = myClasses.map((c) => c.id);
  const enrolledStudentIds = myClassIds.length > 0
    ? (csData || []).filter((cs) => myClassIds.includes(cs.class_id)).map((cs) => cs.student_id)
    : [];

  let allTeacherStudents = directStData || [];
  const missingIds = enrolledStudentIds.filter((id) => !allTeacherStudents.some((s) => s.id === id));

  if (missingIds.length > 0) {
    const { data: extraStData } = await db.from('users').select('id, name, email').in('id', missingIds);
    if (extraStData) {
      allTeacherStudents = [...allTeacherStudents, ...extraStData];
    }
  }

  const { data: evalData, error: evalError } = await db
    .from('daily_evaluations')
    .select('*, users!daily_evaluations_student_id_fkey(name, email, parent_phone)')
    .eq('teacher_id', user.id)
    .order('eval_date', { ascending: false });

  if (evalError) return NextResponse.json({ error: evalError.message }, { status: 500 });

  return NextResponse.json({
    students: allTeacherStudents,
    classes: myClasses,
    classStudents: (csData || []).filter((cs) => myClassIds.includes(cs.class_id)),
    evaluations: evalData || [],
  });
}
