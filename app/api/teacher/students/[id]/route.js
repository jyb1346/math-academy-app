import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isStudentInTeacherScope } from '@/lib/teacherScope';
import {
  loadScoreStore,
  saveScoreStore,
  normalizeSchoolLevelAndGrade,
} from '@/lib/scoreStore';

// PATCH /api/teacher/students/[id] — 담당 범위 내 원생 정보 수정 (담당 강사 재배정 및 학년/학교 프로필 포함)
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  if (!(await isStudentInTeacherScope(db, user.id, id))) {
    return NextResponse.json({ error: '본인 담당 범위의 학생만 수정할 수 있습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, parentPhone, teacherId, schoolName, gradeCode, schoolLevel, schoolGrade } = body;

  const { error: updateErr } = await db
    .from('users')
    .update({
      name,
      email,
      parent_phone: parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '',
      teacher_id: teacherId || user.id,
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (
    schoolName !== undefined ||
    gradeCode !== undefined ||
    schoolLevel !== undefined ||
    schoolGrade !== undefined
  ) {
    try {
      const store = await loadScoreStore(db);
      const prev = store.studentProfiles[id] || {};
      const cleanSchool =
        schoolName !== undefined ? String(schoolName).trim() : prev.school_name || '';
      const norm = normalizeSchoolLevelAndGrade({
        school_name: cleanSchool,
        grade_code: gradeCode ?? prev.grade_code,
        school_level: schoolLevel ?? prev.school_level,
        school_grade: schoolGrade ?? prev.school_grade,
        grade_system: prev.grade_system,
      });
      store.studentProfiles[id] = {
        ...prev,
        school_name: cleanSchool,
        school_level: norm.school_level,
        school_grade: norm.school_grade,
        grade_code: norm.grade_code,
        grade_system: norm.grade_system,
        updated_at: new Date().toISOString(),
      };
      await saveScoreStore(db, store);
    } catch (e) {
      console.error('Failed to update student profile in teacher PATCH:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
