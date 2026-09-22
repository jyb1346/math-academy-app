import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword } from '@/lib/securityUtils';

// POST /api/teacher/students/batch — 학생 계정 일괄 등록 (본인 담당으로 생성)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { students } = body; // [{ name, phone }]
  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: 'students가 필요합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  const payloads = students.map(({ name, phone }) => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return {
      name,
      email: `${name.toLowerCase()}${randomNum}@poom.com`,
      password: hashPassword('1234'),
      role: 'STUDENT',
      teacher_id: user.id,
      parent_phone: cleanPhone,
    };
  });

  const { error: insertErr } = await db.from('users').insert(payloads);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: payloads.length });
}
