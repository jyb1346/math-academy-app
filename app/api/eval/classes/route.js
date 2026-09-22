import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/eval/classes — 내가 담당하는 반 목록, 없으면 직속 학생 목록 (1:1 개별수업 초기 로드용)
export async function GET(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  const { data: cData, error: classErr } = await db.from('classes').select('*').eq('teacher_id', user.id);
  if (classErr) return NextResponse.json({ error: classErr.message }, { status: 500 });

  const classes = cData || [];
  let directStudents = [];

  if (classes.length === 0) {
    const { data: stData, error: stErr } = await db
      .from('users')
      .select('id, name, email, parent_phone')
      .eq('role', 'STUDENT')
      .eq('teacher_id', user.id);

    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });
    directStudents = stData || [];
  }

  return NextResponse.json({ classes, directStudents });
}
