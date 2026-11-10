import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function loadOwnedEval(db, id, userId) {
  const { data: existing, error } = await db
    .from('daily_evaluations')
    .select('id, teacher_id')
    .eq('id', id)
    .maybeSingle();

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!existing) return { error: NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 }) };

  // 🛑 원장님 예외 없이 오직 해당 레코드를 작성한 담당 강사 본인만 수정/삭제 가능
  if (existing.teacher_id !== userId) {
    return { error: NextResponse.json({ error: '본인이 작성한 기록만 수정/삭제할 수 있습니다.' }, { status: 403 }) };
  }

  return { existing };
}

// PATCH /api/eval/[id] — 과제 상태 인라인 변경 / 진도·교재 수정 (teacher_comment 갱신)
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { error: ownershipError } = await loadOwnedEval(db, id, user.id);
  if (ownershipError) return ownershipError;

  const body = await req.json();
  const updatePayload = {};

  if (typeof body.teacherComment === 'string') {
    updatePayload.teacher_comment = body.teacherComment;
  }
  if (body.attendance_status) {
    updatePayload.attendance_status = body.attendance_status;
  }
  if (body.lateness_minutes !== undefined) {
    updatePayload.lateness_minutes = parseInt(body.lateness_minutes, 10) || 0;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: '수정할 데이터가 없습니다.' }, { status: 400 });
  }

  const { error: updateError } = await db
    .from('daily_evaluations')
    .update(updatePayload)
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/eval/[id]
export async function DELETE(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { error: ownershipError } = await loadOwnedEval(db, id, user.id);
  if (ownershipError) return ownershipError;

  const { error: deleteError } = await db.from('daily_evaluations').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
