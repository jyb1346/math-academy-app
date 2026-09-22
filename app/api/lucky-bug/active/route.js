import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getActiveLuckyEvent, getRecentFinishedLuckyEvent, checkIfUserIsJangTeacherOrStudent } from '@/lib/luckyBugService';

// GET /api/lucky-bug/active?classIds=1,2,3 — 학생 전용, 현재 활성 이벤트 또는 최근 마감 이벤트 조회
export async function GET(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  if (!(await checkIfUserIsJangTeacherOrStudent(req, user))) {
    return NextResponse.json({ active: null, recentFinished: null });
  }

  const classIdsParam = req.nextUrl.searchParams.get('classIds') || '';
  const classIds = classIdsParam ? classIdsParam.split(',').filter(Boolean) : [];

  const active = await getActiveLuckyEvent(req, classIds, user.id);
  if (active) {
    return NextResponse.json({ active, recentFinished: null });
  }

  const recentFinished = await getRecentFinishedLuckyEvent(req, classIds, user.id);
  return NextResponse.json({ active: null, recentFinished });
}
