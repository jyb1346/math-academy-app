import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getStudentBugDex } from '@/lib/luckyBugService';

// GET /api/lucky-bug/dex — 학생 본인의 벌레 도감 조회
export async function GET(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  const dex = await getStudentBugDex(req, user.id);
  return NextResponse.json({ dex });
}
