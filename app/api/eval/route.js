import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { parseEvaluationRecord } from '@/lib/evalUtils';

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

  // 담당 강사 이름 매핑 (다중 수강/타 강사 특강 구분용)
  const teacherIds = [...new Set(evaluations.map((e) => e.teacher_id).filter(Boolean))];
  let teacherMap = {};
  if (teacherIds.length > 0) {
    const { data: teachers } = await db.from('users').select('id, name').in('id', teacherIds);
    teacherMap = (teachers || []).reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
  }
  const evaluationsWithTeacherName = evaluations.map((e) => ({
    ...e,
    teacher_name: teacherMap[e.teacher_id] || '',
  }));

  return NextResponse.json({ evaluations: evaluationsWithTeacherName });
}

// POST /api/eval — 1:1 개별 피드백 저장 (동일 날짜 다중 반/특강 및 타 강사 수업 분리 저장 지원)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { studentId, evalDate, payload, evalId, classId: bodyClassId } = body;

  if (!studentId || !evalDate || !payload) {
    return NextResponse.json({ error: 'studentId, evalDate, payload가 필요합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  const parsedPayload = parseEvaluationRecord(payload);
  const targetClassId = String(bodyClassId || parsedPayload.classId || '').trim();

  const { data: existingRows, error: findErr } = await db
    .from('daily_evaluations')
    .select('id, teacher_id, teacher_comment')
    .eq('student_id', studentId)
    .eq('eval_date', evalDate);

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  const allRowsOnDate = existingRows || [];
  const myRows = allRowsOnDate.filter((r) => r.teacher_id === user.id);

  // 본인 기록 중에서 동일 반(classId) 기록이 있는지 탐색
  let matchedExisting = null;
  if (evalId) {
    matchedExisting = myRows.find((r) => String(r.id) === String(evalId)) || null;
  }
  if (!matchedExisting && targetClassId) {
    // 1순위: 정확히 같은 classId로 태그된 내 기록
    matchedExisting =
      myRows.find((r) => String(parseEvaluationRecord(r).classId || '') === targetClassId) || null;
    // 2순위: 아직 classId 태그가 없는 레거시 내 기록 (단, 다른 반 태그 기록이 아닌 경우)
    if (!matchedExisting) {
      matchedExisting = myRows.find((r) => !parseEvaluationRecord(r).classId) || null;
    }
  } else if (!matchedExisting && !targetClassId) {
    // 반 미지정(1:1 단독) 저장 시: 반 태그 없는 내 기록 우선 매칭, 없으면 내 첫 기록 매칭
    matchedExisting =
      myRows.find((r) => !parseEvaluationRecord(r).classId) || myRows[0] || null;
  }

  const finalPayload = {
    ...payload,
    teacher_id: user.id,
    student_id: studentId,
    eval_date: evalDate,
  };

  if (matchedExisting) {
    const { error: updateError } = await db
      .from('daily_evaluations')
      .update(finalPayload)
      .eq('id', matchedExisting.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ id: matchedExisting.id, updated: true });
  }

  // 새로운 반(예: 정규반 외 특강반) 또는 다른 선생님의 같은 날 수업 -> 신규 레코드 INSERT
  const { data: inserted, error: insertError } = await db
    .from('daily_evaluations')
    .insert([finalPayload])
    .select('id')
    .single();

  if (insertError) {
    // 만약 DB에 구버전 (student_id, eval_date) UNIQUE 제약이 남아있어 23505 에러가 발생한 경우
    if (insertError.code === '23505' && myRows.length > 0) {
      const fallbackRow = myRows[0];
      const { error: fallbackUpdErr } = await db
        .from('daily_evaluations')
        .update(finalPayload)
        .eq('id', fallbackRow.id);
      if (!fallbackUpdErr) {
        return NextResponse.json({ id: fallbackRow.id, updated: true });
      }
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  return NextResponse.json({ id: inserted.id, updated: false });
}
