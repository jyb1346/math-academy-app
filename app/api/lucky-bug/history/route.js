import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getLuckyEventHistory, checkIfUserIsJangTeacherOrStudent } from '@/lib/luckyBugService';

// GET /api/lucky-bug/history — 장영배 원장님 전용, 소환 이력 + 당첨자 명단
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;
  if (!(await checkIfUserIsJangTeacherOrStudent(req, user))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const data = await getLuckyEventHistory(req, user.id);
  return NextResponse.json({ history: data });
}
