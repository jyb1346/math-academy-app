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
  const results = [];

  for (const target of targets) {
    const { studentId, payload } = target;
    if (!studentId || !payload) {
      results.push({ studentId, ok: false, error: 'invalid target' });
      continue;
    }

    try {
      const { data: existing, error: findErr } = await db
        .from('daily_evaluations')
        .select('id, teacher_id')
        .eq('student_id', studentId)
        .eq('eval_date', evalDate)
        .maybeSingle();

      if (findErr) throw findErr;

      if (existing && existing.teacher_id !== user.id) {
        results.push({ studentId, ok: false, error: '다른 강사가 이미 이 날짜에 기록을 남겼습니다.' });
        continue;
      }

      const finalPayload = {
        ...payload,
        teacher_id: user.id,
        student_id: studentId,
        eval_date: evalDate,
      };

      if (existing) {
        const { error: updErr } = await db.from('daily_evaluations').update(finalPayload).eq('id', existing.id);
        if (updErr) throw updErr;
        results.push({ studentId, ok: true, id: existing.id, updated: true });
      } else {
        const { data: inserted, error: insErr } = await db
          .from('daily_evaluations')
          .insert([finalPayload])
          .select('id')
          .single();
        if (insErr) throw insErr;
        results.push({ studentId, ok: true, id: inserted.id, updated: false });
      }
    } catch (err) {
      results.push({ studentId, ok: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
