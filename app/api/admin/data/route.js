import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/admin/data — 관리자 대시보드 초기 데이터 일괄 조회 (원장 전용)
export async function GET(req) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  const { data: tData, error: tErr } = await db
    .from('users')
    .select('id, name, email, role, parent_phone, teacher_id, created_at')
    .in('role', ['TEACHER', 'HEAD_TEACHER']);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const { data: cData, error: cErr } = await db.from('classes').select('*');
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: stData, error: stErr } = await db
    .from('users')
    .select('id, name, email, role, parent_phone, teacher_id, created_at')
    .eq('role', 'STUDENT');
  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

  const { data: csData, error: csErr } = await db.from('class_students').select('*');
  if (csErr) return NextResponse.json({ error: csErr.message }, { status: 500 });

  return NextResponse.json({
    teachers: tData || [],
    classes: cData || [],
    students: stData || [],
    classStudents: csData || [],
  });
}
