import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { deleteLuckyEvent, checkIfUserIsJangTeacherOrStudent } from '@/lib/luckyBugService';

// DELETE /api/lucky-bug/[eventId] — 장영배 원장님 전용, 이벤트 이력 삭제
export async function DELETE(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;
  if (!(await checkIfUserIsJangTeacherOrStudent(req, user))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { eventId } = await params;
  const result = await deleteLuckyEvent(req, eventId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
