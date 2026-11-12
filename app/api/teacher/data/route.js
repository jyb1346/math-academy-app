import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { loadScoreStore, enrichStudentsWithProfiles } from '@/lib/scoreStore';

// GET /api/teacher/data — 교사 대시보드 초기 데이터 일괄 조회 (본인 담당 반/학생 범위)
export async function GET(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  // 서로 무관한 조회 6개를 단일 병렬 라운드로 실행 (타 강사 학생의 특강 배정 및 다중 수강 조회 지원)
  const [allClassesRes, allStRes, allCSRes, teachersRes, qnaRes, repliedEvalRes, scoreStore] = await Promise.all([
    db.from('classes').select('*'),
    db.from('users').select('id, name, email, role, parent_phone, teacher_id, created_at').eq('role', 'STUDENT'),
    db.from('class_students').select('student_id, class_id'),
    db.from('users').select('id, name, email, role').in('role', ['TEACHER', 'HEAD_TEACHER', 'ADMIN']).order('name'),
    db.from('qna').select('id, status, replies').eq('teacher_id', user.id),
    db
      .from('daily_evaluations')
      .select('id, student_id, eval_date, parent_reply, parent_reply_at, teacher_comment, users!daily_evaluations_student_id_fkey(name)')
      .eq('teacher_id', user.id)
      .not('parent_reply', 'is', null)
      .order('parent_reply_at', { ascending: false }),
    loadScoreStore(db),
  ]);

  if (allClassesRes.error) return NextResponse.json({ error: allClassesRes.error.message }, { status: 500 });
  if (allStRes.error) return NextResponse.json({ error: allStRes.error.message }, { status: 500 });

  const allClasses = allClassesRes.data || [];
  const myClasses = allClasses.filter((c) => c.teacher_id === user.id);
  const myClassIds = new Set(myClasses.map((c) => c.id));

  const allClassStudents = allCSRes.data || [];
  const myClassStudents = allClassStudents.filter((cs) => myClassIds.has(cs.class_id));
  const enrolledStudentIds = new Set(myClassStudents.map((item) => item.student_id));

  const rawAllStudents = allStRes.data || [];
  rawAllStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

  const enrichedAllAcademyStudents = enrichStudentsWithProfiles(
    rawAllStudents,
    scoreStore?.studentProfiles || {}
  );

  // 내 담당 학생 = 주담당(teacher_id === user.id) 이거나 내 반(특강 포함)에 1개 이상 배정된 학생
  const enrichedStudents = enrichedAllAcademyStudents.filter(
    (s) => s.teacher_id === user.id || enrolledStudentIds.has(s.id)
  );

  const tData = teachersRes.data;
  const qnaData = qnaRes.data;
  const repliedEvaluations = (repliedEvalRes.data || []).filter(
    (ev) => ev.parent_reply && String(ev.parent_reply).trim()
  );

  return NextResponse.json({
    classes: myClasses,
    allClasses,
    students: enrichedStudents,
    allAcademyStudents: enrichedAllAcademyStudents,
    teachers: tData || [],
    classStudents: myClassStudents,
    allClassStudents,
    qna: qnaData || [],
    repliedEvaluations,
  });
}
