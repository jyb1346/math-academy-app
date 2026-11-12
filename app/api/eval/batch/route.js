import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { parseEvaluationRecord } from '@/lib/evalUtils';

// POST /api/eval/batch — 판서수업 반 전체 일괄 등록 (다중 수강/특강 및 타 강사 동시 수강 분리 저장 지원)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { evalDate, targets, classId: batchClassId } = body;

  if (!evalDate || !Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: 'evalDate와 targets가 필요합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  // ⚡ 1) 대상 학생들의 해당 날짜 기존 피드백을 단 1번의 쿼리로 일괄 조회 (다중 반 레코드 배열로 그룹핑)
  const validStudentIds = [
    ...new Set(targets.map((t) => t?.studentId).filter(Boolean)),
  ];

  const existingRowsByStudent = new Map();
  if (validStudentIds.length > 0) {
    const { data: existingRows, error: findErr } = await db
      .from('daily_evaluations')
      .select('id, student_id, teacher_id, teacher_comment')
      .eq('eval_date', evalDate)
      .in('student_id', validStudentIds);

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }

    (existingRows || []).forEach((row) => {
      if (!existingRowsByStudent.has(row.student_id)) {
        existingRowsByStudent.set(row.student_id, []);
      }
      existingRowsByStudent.get(row.student_id).push(row);
    });
  }

  // ⚡ 2) 학생별 INSERT / UPDATE 작업을 병렬(Promise.all)로 동시 처리하되 개별 try/catch로 격리
  const results = await Promise.all(
    targets.map(async (target) => {
      const { studentId, payload, classId: targetClassIdParam } = target || {};
      if (!studentId || !payload) {
        return { studentId, ok: false, error: 'invalid target' };
      }

      try {
        const parsedPayload = parseEvaluationRecord(payload);
        const targetClassId = String(
          targetClassIdParam || batchClassId || parsedPayload.classId || ''
        ).trim();

        const studentRows = existingRowsByStudent.get(studentId) || [];
        const myRows = studentRows.filter((r) => r.teacher_id === user.id);

        let matchedExisting = null;
        if (targetClassId) {
          matchedExisting =
            myRows.find((r) => String(parseEvaluationRecord(r).classId || '') === targetClassId) ||
            myRows.find((r) => !parseEvaluationRecord(r).classId) ||
            null;
        } else {
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
          const { error: updErr } = await db
            .from('daily_evaluations')
            .update(finalPayload)
            .eq('id', matchedExisting.id);
          if (updErr) throw updErr;
          return { studentId, ok: true, id: matchedExisting.id, updated: true };
        } else {
          const { data: inserted, error: insErr } = await db
            .from('daily_evaluations')
            .insert([finalPayload])
            .select('id')
            .single();
          if (insErr) {
            if (insErr.code === '23505' && myRows.length > 0) {
              const fallbackRow = myRows[0];
              const { error: fallbackUpdErr } = await db
                .from('daily_evaluations')
                .update(finalPayload)
                .eq('id', fallbackRow.id);
              if (!fallbackUpdErr) {
                return { studentId, ok: true, id: fallbackRow.id, updated: true };
              }
            }
            throw insErr;
          }
          return { studentId, ok: true, id: inserted.id, updated: false };
        }
      } catch (err) {
        return { studentId, ok: false, error: err.message };
      }
    })
  );

  return NextResponse.json({ results });
}
