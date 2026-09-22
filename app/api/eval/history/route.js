import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/eval/history — 담당 강사의 전체 학생 명단 + 본인이 작성한 과제표 히스토리
export async function GET(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  // 서로 무관한 조회 4개를 병렬 실행
  const [directStRes, classesRes, csRes, evalRes] = await Promise.all([
    db.from('users').select('id, name, email').eq('role', 'STUDENT').eq('teacher_id', user.id),
    db.from('classes').select('*').eq('teacher_id', user.id),
    db.from('class_students').select('*'),
    db.from('daily_evaluations').select('*, users!daily_evaluations_student_id_fkey(name, email, parent_phone)').eq('teacher_id', user.id).order('eval_date', { ascending: false }),
  ]);

  if (evalRes.error) return NextResponse.json({ error: evalRes.error.message }, { status: 500 });

  const myClasses = classesRes.data || [];
  const csData = csRes.data;
  const myClassIds = myClasses.map((c) => c.id);
  const enrolledStudentIds = myClassIds.length > 0
    ? (csData || []).filter((cs) => myClassIds.includes(cs.class_id)).map((cs) => cs.student_id)
    : [];

  let allTeacherStudents = directStRes.data || [];
  const missingIds = enrolledStudentIds.filter((id) => !allTeacherStudents.some((s) => s.id === id));

  if (missingIds.length > 0) {
    const { data: extraStData } = await db.from('users').select('id, name, email').in('id', missingIds);
    if (extraStData) {
      allTeacherStudents = [...allTeacherStudents, ...extraStData];
    }
  }

  const evalData = evalRes.data;

  return NextResponse.json({
    students: allTeacherStudents,
    classes: myClasses,
    classStudents: (csData || []).filter((cs) => myClassIds.includes(cs.class_id)),
    evaluations: evalData || [],
  });
}
