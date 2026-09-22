import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getMonthlyBugLeaderboard } from '@/lib/luckyBugService';

// GET /api/lucky-bug/leaderboard — 월간 명예의 전당 (로그인 사용자 누구나)
export async function GET(req) {
  const { error } = requireSession(req);
  if (error) return error;

  const leaderboard = await getMonthlyBugLeaderboard(req);
  return NextResponse.json({ leaderboard });
}
