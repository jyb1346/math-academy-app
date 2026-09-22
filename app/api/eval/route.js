import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/eval?studentId=xxx  — 특정 학생의 전체 과제표 히스토리 조회
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
  }

  // 학생은 본인 기록만, 교사/원장은 제한 없이 조회 가능 (기존 클라이언트 동작과 동일)
  if (user.role === 'STUDENT' && user.id !== studentId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const db = getSupabaseAdmin(req);
  const { data, error: dbError } = await db
    .from('daily_evaluations')
    .select('*')
    .eq('student_id', studentId)
    .order('eval_date', { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const evaluations = data || [];

  // 학생 화면에서 "OO 선생님" 표시를 위한 담당 강사 이름 매핑 (학생 role 요청일 때만)
  let evaluationsWithTeacherName = evaluations;
  if (user.role === 'STUDENT') {
    const teacherIds = [...new Set(evaluations.map((e) => e.teacher_id).filter(Boolean))];
    let teacherMap = {};
    if (teacherIds.length > 0) {
      const { data: teachers } = await db.from('users').select('id, name').in('id', teacherIds);
      teacherMap = (teachers || []).reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
    }
    evaluationsWithTeacherName = evaluations.map((e) => ({ ...e, teacher_name: teacherMap[e.teacher_id] || '' }));
  }

  return NextResponse.json({ evaluations: evaluationsWithTeacherName });
}

// POST /api/eval — 1:1 개별 피드백 저장 (신규 생성 또는 본인 소유 레코드 덮어쓰기)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { studentId, evalDate, payload } = body;

  if (!studentId || !evalDate || !payload) {
    return NextResponse.json({ error: 'studentId, evalDate, payload가 필요합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  const { data: existing, error: findErr } = await db
    .from('daily_evaluations')
    .select('id, teacher_id')
    .eq('student_id', studentId)
    .eq('eval_date', evalDate)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  // 🛑 이미 다른 강사가 같은 날짜에 기록을 남겼다면 덮어쓰기 금지 (교사 간 데이터 하이재킹 방지)
  if (existing && existing.teacher_id !== user.id) {
    return NextResponse.json(
      { error: '이미 다른 강사가 이 날짜에 기록을 남겼습니다.' },
      { status: 409 }
    );
  }

  const finalPayload = {
    ...payload,
    teacher_id: user.id,
    student_id: studentId,
    eval_date: evalDate,
  };

  if (existing) {
    const { error: updateError } = await db
      .from('daily_evaluations')
      .update(finalPayload)
      .eq('id', existing.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ id: existing.id, updated: true });
  }

  const { data: inserted, error: insertError } = await db
    .from('daily_evaluations')
    .insert([finalPayload])
    .select('id')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ id: inserted.id, updated: false });
}
