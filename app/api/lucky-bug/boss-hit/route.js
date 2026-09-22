import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { hitBossRaid, checkIfUserIsJangTeacherOrStudent } from '@/lib/luckyBugService';

// POST /api/lucky-bug/boss-hit — 학생 전용, 보스 레이드 타격
export async function POST(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  if (!(await checkIfUserIsJangTeacherOrStudent(req, user))) {
    return NextResponse.json({ success: false, reason: 'FORBIDDEN', message: '참여 대상이 아닙니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { eventId, damage } = body;
  if (!eventId) return NextResponse.json({ error: 'eventId가 필요합니다.' }, { status: 400 });

  const result = await hitBossRaid(req, eventId, user.id, user.name, damage ?? null);
  return NextResponse.json(result);
}
