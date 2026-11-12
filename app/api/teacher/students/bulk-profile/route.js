import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  loadScoreStore,
  saveScoreStore,
  normalizeSchoolLevelAndGrade,
} from '@/lib/scoreStore';

// POST /api/teacher/students/bulk-profile
// 원생 여러 명(또는 1명 빠른 편집)의 학년(중1~고3) 및 학교명을 한 번에 저장
export async function POST(req) {
  const { error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const db = getSupabaseAdmin(req);
    const store = await loadScoreStore(db);

    // 1) updates 배열 방식: [{ studentId, gradeCode, schoolName }]
    // 2) 일괄 적용 방식: { studentIds: [...], gradeCode, schoolName, updateGrade, updateSchool }
    let items = [];
    if (Array.isArray(body.updates)) {
      items = body.updates;
    } else if (Array.isArray(body.studentIds)) {
      const { studentIds, gradeCode, schoolName, updateGrade, updateSchool } = body;
      items = studentIds.map((studentId) => ({
        studentId,
        gradeCode: updateGrade === false ? undefined : gradeCode,
        schoolName: updateSchool === false ? undefined : schoolName,
      }));
    }

    if (items.length === 0) {
      return NextResponse.json({ error: '적용할 학생을 선택해 주세요.' }, { status: 400 });
    }

    const updatedProfiles = {};
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const stId = String(item.studentId || '').trim();
      if (!stId) continue;

      const prev = store.studentProfiles[stId] || {};

      const nextSchoolName =
        item.schoolName !== undefined
          ? String(item.schoolName).trim()
          : prev.school_name || '';

      const hasGradeChange =
        item.gradeCode !== undefined &&
        item.gradeCode !== null &&
        item.gradeCode !== '' &&
        item.gradeCode !== 'KEEP';

      const targetGradeCode = hasGradeChange ? String(item.gradeCode).trim() : prev.grade_code;

      const norm = normalizeSchoolLevelAndGrade({
        school_name: nextSchoolName,
        grade_code: targetGradeCode,
        school_level: hasGradeChange ? undefined : prev.school_level,
        school_grade: hasGradeChange ? undefined : prev.school_grade,
        grade_system: prev.grade_system,
      });

      const nextProfile = {
        ...prev,
        school_name: nextSchoolName,
        school_level: norm.school_level,
        school_grade: norm.school_grade,
        grade_code: norm.grade_code,
        grade_system: norm.grade_system,
        updated_at: nowIso,
      };

      store.studentProfiles[stId] = nextProfile;

      const hasExplicitProfile = Boolean(
        nextProfile.school_name ||
          nextProfile.school_level ||
          nextProfile.school_grade ||
          nextProfile.grade_code
      );

      updatedProfiles[stId] = {
        school_name: nextProfile.school_name,
        school_level: norm.school_level,
        school_grade: norm.school_grade,
        grade_code: norm.grade_code,
        grade_label: hasExplicitProfile ? norm.grade_label : '',
        grade_system: norm.grade_system,
      };
    }

    await saveScoreStore(db, store);

    return NextResponse.json({
      ok: true,
      count: Object.keys(updatedProfiles).length,
      updatedProfiles,
    });
  } catch (e) {
    console.error('Failed to bulk update student profiles:', e);
    return NextResponse.json(
      { error: e.message || '학년·학교 일괄 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
