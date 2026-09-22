import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { synthesizeBugs } from '@/lib/luckyBugService';

// POST /api/lucky-bug/synthesize — 학생 전용, 벌레 3마리 합성
export async function POST(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  const body = await req.json();
  const { tier } = body;
  const result = await synthesizeBugs(req, user.id, tier);
  return NextResponse.json(result);
}
