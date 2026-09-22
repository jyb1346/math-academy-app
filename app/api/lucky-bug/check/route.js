import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkIfUserIsJangTeacherOrStudent } from '@/lib/luckyBugService';

// GET /api/lucky-bug/check — 이 기능 사용 자격(장영배 원장님 본인 또는 그 담당 학생) 확인
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const isEligible = await checkIfUserIsJangTeacherOrStudent(req, user);
  if (!isEligible) return NextResponse.json({ isEligible: false, classIds: [] });

  let classIds = [];
  if (user.role === 'STUDENT') {
    const db = getSupabaseAdmin(req);
    const { data: csData } = await db.from('class_students').select('class_id').eq('student_id', user.id);
    classIds = (csData || []).map((cs) => String(cs.class_id));
  }

  return NextResponse.json({ isEligible: true, classIds });
}
