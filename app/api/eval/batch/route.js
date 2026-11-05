import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/eval/batch — 판서수업 반 전체 일괄 등록
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { evalDate, targets } = body;

  if (!evalDate || !Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: 'evalDate와 targets가 필요합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  // ⚡ 1) 대상 학생들의 해당 날짜 기존 피드백을 단 1번의 쿼리로 일괄 조회
  const validStudentIds = [
    ...new Set(targets.map((t) => t?.studentId).filter(Boolean)),
  ];

  const existingMap = new Map();
  if (validStudentIds.length > 0) {
    const { data: existingRows, error: findErr } = await db
      .from('daily_evaluations')
      .select('id, student_id, teacher_id')
      .eq('eval_date', evalDate)
      .in('student_id', validStudentIds);

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }

    (existingRows || []).forEach((row) => {
      existingMap.set(row.student_id, row);
    });
  }

  // ⚡ 2) 학생별 INSERT / UPDATE 작업을 병렬(Promise.all)로 동시 처리하되 개별 try/catch로 격리
  const results = await Promise.all(
    targets.map(async (target) => {
      const { studentId, payload } = target || {};
      if (!studentId || !payload) {
        return { studentId, ok: false, error: 'invalid target' };
      }

      try {
        const existing = existingMap.get(studentId);

        if (existing && existing.teacher_id !== user.id) {
          return { studentId, ok: false, error: '다른 강사가 이미 이 날짜에 기록을 남겼습니다.' };
        }

        const finalPayload = {
          ...payload,
          teacher_id: user.id,
          student_id: studentId,
          eval_date: evalDate,
        };

        if (existing) {
          const { error: updErr } = await db
            .from('daily_evaluations')
            .update(finalPayload)
            .eq('id', existing.id);
          if (updErr) throw updErr;
          return { studentId, ok: true, id: existing.id, updated: true };
        } else {
          const { data: inserted, error: insErr } = await db
            .from('daily_evaluations')
            .insert([finalPayload])
            .select('id')
            .single();
          if (insErr) throw insErr;
          return { studentId, ok: true, id: inserted.id, updated: false };
        }
      } catch (err) {
        return { studentId, ok: false, error: err.message };
      }
    })
  );

  return NextResponse.json({ results });
}
