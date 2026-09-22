import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/eval/class/[classId] — 반 소속 학생 목록 + 최근 과제표 일괄 조회 (판서수업 모드)
export async function GET(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { classId } = await params;
  const db = getSupabaseAdmin(req);

  const { data: classRow, error: classErr } = await db
    .from('classes')
    .select('id, teacher_id')
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

  const students = (csData || []).map((item) => item.users).filter(Boolean);
  const studentIds = students.map((s) => s.id);

  let evaluations = [];
  if (studentIds.length > 0) {
    const { data: evalData, error: evalErr } = await db
      .from('daily_evaluations')
      .select('*')
      .in('student_id', studentIds)
      .order('eval_date', { ascending: false });

    if (evalErr) return NextResponse.json({ error: evalErr.message }, { status: 500 });
    evaluations = evalData || [];
  }

  return NextResponse.json({ students, evaluations });
}
