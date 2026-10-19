import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword } from '@/lib/securityUtils';
import {
  loadScoreStore,
  saveScoreStore,
  normalizeSchoolLevelAndGrade,
} from '@/lib/scoreStore';

// POST /api/teacher/students/batch — 학생 계정 일괄 등록 (본인 담당으로 생성 + 학년/학교 프로필 저장)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { students } = body; // [{ name, phone, grade_code, school_name }]
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

  const { data: insertedRows, error: insertErr } = await db
    .from('users')
    .insert(payloads)
    .select('id, name, email');
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 학년(중1~고3) 또는 학교명이 함께 전달된 경우 scoreStore.studentProfiles에 즉시 저장
  const hasProfileInfo = students.some((s) => s.grade_code || s.school_name || s.school_grade);
  if (hasProfileInfo && Array.isArray(insertedRows) && insertedRows.length > 0) {
    try {
      const store = await loadScoreStore(db);
      const now = new Date().toISOString();
      insertedRows.forEach((createdUser, idx) => {
        const src = students[idx] || {};
        if (!src.grade_code && !src.school_name && !src.school_grade) return;
        const cleanSchool = (src.school_name || '').trim();
        const norm = normalizeSchoolLevelAndGrade({
          school_name: cleanSchool,
          grade_code: src.grade_code,
          school_level: src.school_level,
          school_grade: src.school_grade,
        });
        store.studentProfiles[createdUser.id] = {
          ...(store.studentProfiles[createdUser.id] || {}),
          school_name: cleanSchool,
          school_level: norm.school_level,
          school_grade: norm.school_grade,
          grade_code: norm.grade_code,
          grade_system: norm.grade_system,
          updated_at: now,
        };
      });
      await saveScoreStore(db, store);
    } catch (e) {
      console.error('Failed to save initial student profiles:', e);
    }
  }

  return NextResponse.json({ ok: true, count: payloads.length });
}
