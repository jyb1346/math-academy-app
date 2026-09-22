import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET /api/admin/data — 관리자 대시보드 초기 데이터 일괄 조회 (원장 전용)
export async function GET(req) {
  const { error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  const [teachersRes, classesRes, studentsRes, csRes] = await Promise.all([
    db.from('users').select('id, name, email, role, parent_phone, teacher_id, created_at').in('role', ['TEACHER', 'HEAD_TEACHER']),
    db.from('classes').select('*'),
    db.from('users').select('id, name, email, role, parent_phone, teacher_id, created_at').eq('role', 'STUDENT'),
    db.from('class_students').select('*'),
  ]);

  const firstError = teachersRes.error || classesRes.error || studentsRes.error || csRes.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  return NextResponse.json({
    teachers: teachersRes.data || [],
    classes: classesRes.data || [],
    students: studentsRes.data || [],
    classStudents: csRes.data || [],
  });
}
