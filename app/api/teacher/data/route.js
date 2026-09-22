import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/teacher/data — 교사 대시보드 초기 데이터 일괄 조회 (본인 담당 반/학생 범위)
export async function GET(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  // 서로 무관한 조회 4개를 병렬 실행
  const [classesRes, directStRes, teachersRes, qnaRes] = await Promise.all([
    db.from('classes').select('*').eq('teacher_id', user.id),
    db.from('users').select('id, name, email, role, parent_phone, teacher_id, created_at').eq('role', 'STUDENT').eq('teacher_id', user.id),
    db.from('users').select('id, name, email, role').in('role', ['TEACHER', 'HEAD_TEACHER', 'ADMIN']).order('name'),
    db.from('qna').select('id, status, replies').eq('teacher_id', user.id),
  ]);

  if (classesRes.error) return NextResponse.json({ error: classesRes.error.message }, { status: 500 });
  if (directStRes.error) return NextResponse.json({ error: directStRes.error.message }, { status: 500 });

  const myClasses = classesRes.data || [];
  const myClassIds = myClasses.map((c) => c.id);

  let enrolledStudentIds = [];
  let myClassStudents = [];
  if (myClassIds.length > 0) {
    const { data: enrolledCS } = await db
      .from('class_students')
      .select('student_id, class_id')
      .in('class_id', myClassIds);
    myClassStudents = enrolledCS || [];
    enrolledStudentIds = myClassStudents.map((item) => item.student_id);
  }

  let allTeacherStudents = directStRes.data || [];
  const missingIds = enrolledStudentIds.filter((id) => !allTeacherStudents.some((s) => s.id === id));

  if (missingIds.length > 0) {
    const { data: extraStData } = await db
      .from('users')
      .select('id, name, email, role, parent_phone, teacher_id, created_at')
      .in('id', missingIds);
    if (extraStData) {
      allTeacherStudents = [...allTeacherStudents, ...extraStData];
    }
  }

  const tData = teachersRes.data;
  const qnaData = qnaRes.data;

  return NextResponse.json({
    classes: myClasses,
    students: allTeacherStudents,
    teachers: tData || [],
    classStudents: myClassStudents,
    qna: qnaData || [],
  });
}
