import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isEvalMatchingClass } from '@/lib/evalUtils';

// GET /api/eval/class/[classId] — 반 소속 학생 목록 + 최근 과제표 일괄 조회 (판서수업 모드 및 반별/전체반 출석부·과제 검사)
export async function GET(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { classId } = await params;
  const db = getSupabaseAdmin(req);

  // 🌐 1. 반 구분 없이 전체 반 학생 및 평가 일괄 조회
  if (classId === 'all' || classId === 'ALL') {
    const { data: teacherClasses, error: tcErr } = await db
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user.id);

    if (tcErr) return NextResponse.json({ error: tcErr.message }, { status: 500 });

    const classesList = teacherClasses || [];
    const classIds = classesList.map((c) => c.id);
    const classMap = classesList.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});

    let csData = [];
    if (classIds.length > 0) {
      const { data: csRes, error: csErr } = await db
        .from('class_students')
        .select('class_id, student_id, users(id, name, email, parent_phone)')
        .in('class_id', classIds);
      if (csErr) return NextResponse.json({ error: csErr.message }, { status: 500 });
      csData = csRes || [];
    }

    const { data: directStudents, error: directErr } = await db
      .from('users')
      .select('id, name, email, parent_phone')
      .eq('role', 'STUDENT')
      .eq('teacher_id', user.id);

    if (directErr) return NextResponse.json({ error: directErr.message }, { status: 500 });

    const studentMap = new Map();
    csData.forEach((item) => {
      if (item.users) {
        const cName = classMap[item.class_id] || '반 소속';
        const existing = studentMap.get(item.users.id);
        if (existing) {
          if (!existing.classIds.includes(item.class_id)) {
            existing.classIds.push(item.class_id);
            existing.classNames.push(cName);
            existing.className = existing.classNames.join(' · ');
          }
        } else {
          studentMap.set(item.users.id, {
            ...item.users,
            className: cName,
            classId: item.class_id,
            classIds: [item.class_id],
            classNames: [cName],
          });
        }
      }
    });

    (directStudents || []).forEach((st) => {
      if (!studentMap.has(st.id)) {
        studentMap.set(st.id, {
          ...st,
          className: '1:1 개별',
          classId: null,
          classIds: [],
          classNames: ['1:1 개별'],
        });
      }
    });

    const students = Array.from(studentMap.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ko')
    );
    const studentIds = students.map((s) => s.id);

    let evaluations = [];
    if (studentIds.length > 0) {
      const { data: evalData, error: evalErr } = await db
        .from('daily_evaluations')
        .select('*')
        .in('student_id', studentIds)
        .order('eval_date', { ascending: false });

      if (evalErr) return NextResponse.json({ error: evalErr.message }, { status: 500 });
      // 전체 반 조회 시에도 본인(해당 선생님)이 작성한 피드백만 필터링하여 타 강사 특강 기록과 혼선 방지
      evaluations = (evalData || []).filter(
        (ev) => !ev.teacher_id || String(ev.teacher_id) === String(user.id)
      );
    }

    return NextResponse.json({ students, evaluations });
  }

  // 🏫 2. 특정 단일 반 조회
  const { data: classRow, error: classErr } = await db
    .from('classes')
    .select('id, name, teacher_id')
    .eq('id', classId)
    .maybeSingle();

  if (classErr) return NextResponse.json({ error: classErr.message }, { status: 500 });
  if (!classRow) return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
  if (classRow.teacher_id !== user.id) {
    return NextResponse.json({ error: '본인이 담당하는 반만 조회할 수 있습니다.' }, { status: 403 });
  }

  const { data: csData, error: csErr } = await db
    .from('class_students')
    .select('student_id, users(id, name, email, parent_phone)')
    .eq('class_id', classId);

  if (csErr) return NextResponse.json({ error: csErr.message }, { status: 500 });

  const students = (csData || [])
    .map((item) => (item.users ? { ...item.users, className: classRow.name, classId: classRow.id } : null))
    .filter(Boolean);
  students.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  const studentIds = students.map((s) => s.id);

  let evaluations = [];
  if (studentIds.length > 0) {
    const { data: evalData, error: evalErr } = await db
      .from('daily_evaluations')
      .select('*')
      .in('student_id', studentIds)
      .order('eval_date', { ascending: false });

    if (evalErr) return NextResponse.json({ error: evalErr.message }, { status: 500 });
    // 해당 반(classRow.id)에 속한 평가(또는 반 태그 없는 동일 강사의 기존 평가)만 필터링하여 정규반/특강반 분리
    evaluations = (evalData || []).filter((ev) =>
      isEvalMatchingClass(ev, classRow.id, classRow.teacher_id)
    );
  }

  return NextResponse.json({ students, evaluations });
}
