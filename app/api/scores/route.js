import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateAutoGrade } from '@/lib/scoreUtils';

const BUCKET_NAME = 'attachments';
const STORE_PATH = 'system_store/high_school_scores_v1.json';

/**
 * 📦 Supabase Storage 기반 클라우드 영구 저장소 로드 (스키마 변경/컬럼 누락 에러 원천 차단)
 */
async function loadScoreStore(db) {
  try {
    const { data, error } = await db.storage.from(BUCKET_NAME).download(STORE_PATH);
    if (error || !data) {
      return { scores: [], studentProfiles: {} };
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    return {
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      studentProfiles:
        parsed.studentProfiles && typeof parsed.studentProfiles === 'object'
          ? parsed.studentProfiles
          : {},
    };
  } catch (err) {
    return { scores: [], studentProfiles: {} };
  }
}

/**
 * 📦 Supabase Storage에 성적 및 학생 학교 프로필 영구 저장
 */
async function saveScoreStore(db, storeData) {
  const payload = JSON.stringify(
    {
      scores: storeData.scores || [],
      studentProfiles: storeData.studentProfiles || {},
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );
  const buffer = Buffer.from(payload, 'utf-8');

  let { error } = await db.storage.from(BUCKET_NAME).upload(STORE_PATH, buffer, {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  });

  // 만약 테스트 DB에 버킷이 아직 없다면 자동 생성 후 재시도
  if (
    error &&
    (error.message?.includes('Bucket not found') ||
      error.statusCode === '404' ||
      error.status === 404)
  ) {
    await db.storage.createBucket(BUCKET_NAME, { public: true }).catch(() => {});
    const retry = await db.storage.from(BUCKET_NAME).upload(STORE_PATH, buffer, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '0',
    });
    error = retry.error;
  }

  if (error) {
    throw new Error(`성적 데이터 저장 오류: ${error.message}`);
  }
}

/**
 * 선생님 권한에 따른 학생/반 목록 조회
 */
async function fetchAccessibleStudentsAndClasses(db, user) {
  const isHeadOrAdmin = user.role === 'HEAD_TEACHER' || user.role === 'ADMIN';

  if (isHeadOrAdmin) {
    const [classesRes, studentsRes, csRes, teachersRes] = await Promise.all([
      db.from('classes').select('*'),
      db
        .from('users')
        .select('id, name, email, role, parent_phone, teacher_id, created_at')
        .eq('role', 'STUDENT'),
      db.from('class_students').select('*'),
      db
        .from('users')
        .select('id, name, role')
        .in('role', ['TEACHER', 'HEAD_TEACHER', 'ADMIN']),
    ]);

    const students = (studentsRes.data || []).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ko')
    );
    const classes = (classesRes.data || []).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ko')
    );

    return {
      students,
      classes,
      classStudents: csRes.data || [],
      teachers: teachersRes.data || [],
    };
  }

  // 일반 강사: 본인 담당 반 + 본인 직접 담당 학생
  const [classesRes, directStRes, teachersRes] = await Promise.all([
    db.from('classes').select('*').eq('teacher_id', user.id),
    db
      .from('users')
      .select('id, name, email, role, parent_phone, teacher_id, created_at')
      .eq('role', 'STUDENT')
      .eq('teacher_id', user.id),
    db
      .from('users')
      .select('id, name, role')
      .in('role', ['TEACHER', 'HEAD_TEACHER', 'ADMIN']),
  ]);

  const myClasses = (classesRes.data || []).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ko')
  );
  const myClassIds = myClasses.map((c) => c.id);

  let myClassStudents = [];
  if (myClassIds.length > 0) {
    const { data: enrolledCS } = await db
      .from('class_students')
      .select('student_id, class_id')
      .in('class_id', myClassIds);
    myClassStudents = enrolledCS || [];
  }

  const enrolledIds = myClassStudents.map((cs) => cs.student_id);
  let allStudents = directStRes.data || [];
  const missingIds = enrolledIds.filter((id) => !allStudents.some((s) => s.id === id));

  if (missingIds.length > 0) {
    const { data: extraSt } = await db
      .from('users')
      .select('id, name, email, role, parent_phone, teacher_id, created_at')
      .in('id', missingIds);
    if (extraSt) {
      allStudents = [...allStudents, ...extraSt];
    }
  }

  allStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

  return {
    students: allStudents,
    classes: myClasses,
    classStudents: myClassStudents,
    teachers: teachersRes.data || [],
  };
}

/**
 * GET /api/scores — 고교 성적 데이터 및 학생 학교/학년 프로필 일괄 조회
 */
export async function GET(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN', 'STUDENT']);
  if (error) return error;

  try {
    const db = getSupabaseAdmin(req);

    // 학생 본인 로그인 시 본인의 성적과 학교 프로필만 반환
    if (user.role === 'STUDENT') {
      const { scores, studentProfiles } = await loadScoreStore(db);
      const myScores = scores.filter((sc) => String(sc.student_id) === String(user.id));
      const myProfile = studentProfiles[user.id] || {
        school_name: '',
        school_grade: 1,
        grade_system: 9,
      };
      return NextResponse.json({
        scores: myScores,
        profile: myProfile,
      });
    }

    const [{ scores, studentProfiles }, roster] = await Promise.all([
      loadScoreStore(db),
      fetchAccessibleStudentsAndClasses(db, user),
    ]);

    const allowedStudentIdSet = new Set(roster.students.map((s) => s.id));
    const isHeadOrAdmin = user.role === 'HEAD_TEACHER' || user.role === 'ADMIN';

    // 권한 범위 내 학생 성적만 필터링 (원장은 전체 조회)
    const filteredScores = isHeadOrAdmin
      ? scores
      : scores.filter((sc) => allowedStudentIdSet.has(sc.student_id));

    // 학생 목록에 학교 프로필 병합
    const enrichedStudents = roster.students.map((s) => {
      const prof = studentProfiles[s.id] || {};
      return {
        ...s,
        school_name: prof.school_name || '',
        school_grade: Number(prof.school_grade) || 1,
        grade_system: Number(prof.grade_system) || 9,
        target_grade: prof.target_grade ? Number(prof.target_grade) : null,
        target_score: prof.target_score ? Number(prof.target_score) : null,
      };
    });

    return NextResponse.json({
      scores: filteredScores,
      studentProfiles,
      students: enrichedStudents,
      classes: roster.classes,
      classStudents: roster.classStudents,
      teachers: roster.teachers,
    });
  } catch (err) {
    console.error('GET /api/scores error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 단일 성적 레코드 정규화
 */
function normalizeScoreRecord(input, existingId, teacherId) {
  const now = new Date().toISOString();
  const id =
    existingId || input.id || `score_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const rawScore =
    input.raw_score !== '' && input.raw_score !== null && input.raw_score !== undefined
      ? Number(input.raw_score)
      : null;

  const objScore =
    input.objective_score !== '' &&
    input.objective_score !== null &&
    input.objective_score !== undefined
      ? Number(input.objective_score)
      : null;

  const essayScore =
    input.essay_score !== '' && input.essay_score !== null && input.essay_score !== undefined
      ? Number(input.essay_score)
      : null;

  const rank =
    input.rank !== '' && input.rank !== null && input.rank !== undefined
      ? Number(input.rank)
      : null;

  const totalStudents =
    input.total_students !== '' &&
    input.total_students !== null &&
    input.total_students !== undefined
      ? Number(input.total_students)
      : null;

  const schoolMean =
    input.school_mean !== '' && input.school_mean !== null && input.school_mean !== undefined
      ? Number(input.school_mean)
      : null;

  const schoolStdDev =
    input.school_std_dev !== '' &&
    input.school_std_dev !== null &&
    input.school_std_dev !== undefined
      ? Number(input.school_std_dev)
      : null;

  const percentile =
    input.percentile !== '' && input.percentile !== null && input.percentile !== undefined
      ? Number(input.percentile)
      : null;

  const standardScore =
    input.standard_score !== '' &&
    input.standard_score !== null &&
    input.standard_score !== undefined
      ? Number(input.standard_score)
      : null;

  const manualGrade =
    input.manual_grade !== '' && input.manual_grade !== null && input.manual_grade !== undefined
      ? Number(input.manual_grade)
      : null;

  const examCategory = input.exam_category === 'MOCK' ? 'MOCK' : 'INTERNAL';
  const gradeSystem = Number(input.grade_system) === 5 ? 5 : 9;

  // 🎯 등수/수강자수 또는 백분위/Z점수 기반 자동 산출 (+ 수동/예상 등급 보정값 반영)
  const autoGradeRes = calculateAutoGrade(
    {
      exam_category: examCategory,
      rank,
      total_students: totalStudents,
      raw_score: rawScore,
      school_mean: schoolMean,
      school_std_dev: schoolStdDev,
      percentile,
      manual_grade: manualGrade,
      grade: input.grade,
    },
    gradeSystem
  );
  const grade = autoGradeRes.grade;

  const eb = input.error_breakdown || {};
  const errorBreakdown = {
    mistake_calc: Number(eb.mistake_calc) || 0,
    mistake_cond: Number(eb.mistake_cond) || 0,
    mistake_essay: Number(eb.mistake_essay) || 0,
    skill_concept: Number(eb.skill_concept) || 0,
    skill_approach: Number(eb.skill_approach) || 0,
    skill_killer: Number(eb.skill_killer) || 0,
  };

  return {
    id,
    student_id: String(input.student_id),
    school_name: (input.school_name || '').trim(),
    school_grade: Number(input.school_grade) || 1,
    exam_year: Number(input.exam_year) || new Date().getFullYear(),
    exam_category: examCategory,
    exam_period: input.exam_period || '1_MID',
    subject: (input.subject || '공통수학1').trim(),
    raw_score: rawScore,
    objective_score: objScore,
    essay_score: essayScore,
    grade,
    manual_grade: manualGrade,
    rank,
    total_students: totalStudents,
    school_mean: schoolMean,
    school_std_dev: schoolStdDev,
    percentile,
    standard_score: standardScore,
    error_breakdown: errorBreakdown,
    memo: (input.memo || '').trim(),
    updated_by: teacherId,
    created_at: input.created_at || now,
    updated_at: now,
  };
}

// 동시 저장 요청 시 덮어쓰기(Race Condition)를 방지하기 위한 직렬화 작업 큐
let writeQueue = Promise.resolve();
function runWithStoreLock(taskFn) {
  const next = writeQueue.then(() => taskFn());
  writeQueue = next.catch(() => {});
  return next;
}

/**
 * POST /api/scores — 성적 저장(단건/일괄) 및 학생 학교/학년 프로필 업데이트
 */
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const action = body.action || 'SAVE_SCORE';
    const db = getSupabaseAdmin(req);

    return await runWithStoreLock(async () => {
      const store = await loadScoreStore(db);

      // 1. 학생 학교/학년/목표 프로필만 단독 저장
      if (action === 'SAVE_PROFILE') {
        const {
          student_id,
          school_name,
          school_grade,
          grade_system,
          target_grade,
          target_score,
        } = body;
        if (!student_id) {
          return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 });
        }
        const prev = store.studentProfiles[student_id] || {};
        store.studentProfiles[student_id] = {
          ...prev,
          school_name: (school_name ?? prev.school_name ?? '').trim(),
          school_grade: Number(school_grade) || prev.school_grade || 1,
          grade_system: Number(grade_system) || prev.grade_system || 9,
          target_grade:
            target_grade !== undefined
              ? target_grade !== '' && target_grade !== null
                ? Number(target_grade)
                : null
              : prev.target_grade ?? null,
          target_score:
            target_score !== undefined
              ? target_score !== '' && target_score !== null
                ? Number(target_score)
                : null
              : prev.target_score ?? null,
          updated_at: new Date().toISOString(),
        };

        // 해당 학생의 기존 내신 기록에도 학교명이 비어있다면 동기화
        if (school_name) {
          const cleanSchool = school_name.trim();
          store.scores = store.scores.map((sc) =>
            sc.student_id === student_id && !sc.school_name
              ? { ...sc, school_name: cleanSchool }
              : sc
          );
        }

        await saveScoreStore(db, store);
        return NextResponse.json({
          success: true,
          profile: store.studentProfiles[student_id],
          studentProfiles: store.studentProfiles,
        });
      }

      // 1-2. 여러 학생의 학교/학년/등급제/목표 일괄 저장 (BATCH_SAVE_PROFILES)
      if (action === 'BATCH_SAVE_PROFILES') {
        const { profiles = [] } = body;
        if (!Array.isArray(profiles) || profiles.length === 0) {
          return NextResponse.json(
            { error: '저장할 학생 프로필 목록이 없습니다.' },
            { status: 400 }
          );
        }

        const now = new Date().toISOString();
        let updatedCount = 0;

        profiles.forEach((p) => {
          if (!p.student_id) return;
          const prev = store.studentProfiles[p.student_id] || {};
          const cleanSchool =
            p.school_name !== undefined ? String(p.school_name).trim() : prev.school_name || '';
          const nextGrade = Number(p.school_grade) || prev.school_grade || 1;
          const nextSys = Number(p.grade_system) === 5 ? 5 : 9;
          const nextTargetGrade =
            p.target_grade !== undefined
              ? p.target_grade !== '' && p.target_grade !== null
                ? Number(p.target_grade)
                : null
              : prev.target_grade ?? null;
          const nextTargetScore =
            p.target_score !== undefined
              ? p.target_score !== '' && p.target_score !== null
                ? Number(p.target_score)
                : null
              : prev.target_score ?? null;

          store.studentProfiles[p.student_id] = {
            ...prev,
            school_name: cleanSchool,
            school_grade: nextGrade,
            grade_system: nextSys,
            target_grade: nextTargetGrade,
            target_score: nextTargetScore,
            updated_at: now,
          };
          updatedCount++;

          // 기존 성적 레코드의 학교명이 비어있으면 채워주고, 등급제 변경 시 자동등급 재계산 반영
          store.scores = store.scores.map((sc) => {
            if (String(sc.student_id) !== String(p.student_id)) return sc;
            const mergedSchool = sc.school_name || cleanSchool;
            const autoRes = calculateAutoGrade(sc, nextSys);
            return {
              ...sc,
              school_name: mergedSchool,
              grade: autoRes.grade ?? sc.grade,
            };
          });
        });

        await saveScoreStore(db, store);
        return NextResponse.json({
          success: true,
          updatedCount,
          studentProfiles: store.studentProfiles,
          scores: store.scores,
        });
      }

      // 2. 단건 성적 저장 또는 수정
      if (action === 'SAVE_SCORE') {
        const recordInput = body.score;
        if (!recordInput || !recordInput.student_id) {
          return NextResponse.json({ error: '학생 정보가 누락되었습니다.' }, { status: 400 });
        }

        // 학생 프로필의 학교/학년도 함께 최신화
        if (recordInput.school_name || recordInput.school_grade || recordInput.grade_system) {
          const prevProf = store.studentProfiles[recordInput.student_id] || {};
          store.studentProfiles[recordInput.student_id] = {
            ...prevProf,
            school_name: (recordInput.school_name || prevProf.school_name || '').trim(),
            school_grade: Number(recordInput.school_grade) || prevProf.school_grade || 1,
            grade_system: Number(recordInput.grade_system) || prevProf.grade_system || 9,
            updated_at: new Date().toISOString(),
          };
        }

        const schoolName = (
          recordInput.school_name ||
          store.studentProfiles[recordInput.student_id]?.school_name ||
          ''
        ).trim();

        // 기존 동일 시험(학생 + 연도 + 학년 + 시험구분 + 시험시기 + 과목) 또는 ID 매칭 확인
        const existingIdx = store.scores.findIndex(
          (sc) =>
            (recordInput.id && sc.id === recordInput.id) ||
            (sc.student_id === recordInput.student_id &&
              Number(sc.exam_year) === Number(recordInput.exam_year) &&
              Number(sc.school_grade) === Number(recordInput.school_grade) &&
              sc.exam_category === recordInput.exam_category &&
              sc.exam_period === recordInput.exam_period &&
              sc.subject === recordInput.subject)
        );

        const normalized = normalizeScoreRecord(
          { ...recordInput, school_name: schoolName },
          existingIdx >= 0 ? store.scores[existingIdx].id : null,
          user.id
        );

        if (existingIdx >= 0) {
          store.scores[existingIdx] = normalized;
        } else {
          store.scores.push(normalized);
        }

        // 동일 학교·동일 시험 학생들에게 학교 평균/표준편차/수강자수 자동 공유 (syncSchoolStats 옵션 기본 활성)
        if (
          body.syncSchoolStats !== false &&
          normalized.exam_category === 'INTERNAL' &&
          normalized.school_name
        ) {
          store.scores = store.scores.map((sc) => {
            if (
              sc.id !== normalized.id &&
              sc.exam_category === 'INTERNAL' &&
              sc.school_name === normalized.school_name &&
              Number(sc.exam_year) === Number(normalized.exam_year) &&
              Number(sc.school_grade) === Number(normalized.school_grade) &&
              sc.exam_period === normalized.exam_period &&
              sc.subject === normalized.subject
            ) {
              const nextMean =
                normalized.school_mean !== null ? normalized.school_mean : sc.school_mean;
              const nextStdDev =
                normalized.school_std_dev !== null ? normalized.school_std_dev : sc.school_std_dev;
              const nextTotal =
                normalized.total_students !== null ? normalized.total_students : sc.total_students;
              const peerGradeSys =
                Number(store.studentProfiles[sc.student_id]?.grade_system) || 9;
              const peerAutoGrade = calculateAutoGrade(
                {
                  ...sc,
                  school_mean: nextMean,
                  school_std_dev: nextStdDev,
                  total_students: nextTotal,
                },
                peerGradeSys
              );

              return {
                ...sc,
                school_mean: nextMean,
                school_std_dev: nextStdDev,
                total_students: nextTotal,
                grade: peerAutoGrade.grade ?? sc.grade,
              };
            }
            return sc;
          });
        }

        await saveScoreStore(db, store);
        return NextResponse.json({
          success: true,
          score: normalized,
          scores: store.scores,
          studentProfiles: store.studentProfiles,
        });
      }

      // 3. 시험별 엑셀형 일괄 저장 (BATCH_SAVE)
      if (action === 'BATCH_SAVE') {
        const { examMeta, rows = [], syncSchoolStats = true } = body;
        if (!examMeta || !Array.isArray(rows)) {
          return NextResponse.json(
            { error: '일괄 저장할 데이터가 올바르지 않습니다.' },
            { status: 400 }
          );
        }

        let savedCount = 0;
        let deletedCount = 0;
        const schoolStatsMap = {};

        for (const row of rows) {
          if (!row.student_id) continue;

          // 학교명/학년 프로필 업데이트
          if (row.school_name !== undefined || examMeta.school_grade) {
            const prevProf = store.studentProfiles[row.student_id] || {};
            store.studentProfiles[row.student_id] = {
              ...prevProf,
              school_name:
                row.school_name !== undefined
                  ? row.school_name.trim()
                  : prevProf.school_name || '',
              school_grade: Number(examMeta.school_grade) || prevProf.school_grade || 1,
              grade_system: Number(row.grade_system) || prevProf.grade_system || 9,
              updated_at: new Date().toISOString(),
            };
          }

          const existingIdx = store.scores.findIndex(
            (sc) =>
              (row.id && sc.id === row.id) ||
              (sc.student_id === row.student_id &&
                Number(sc.exam_year) === Number(examMeta.exam_year) &&
                Number(sc.school_grade) === Number(examMeta.school_grade) &&
                sc.exam_category === examMeta.exam_category &&
                sc.exam_period === examMeta.exam_period &&
                sc.subject === examMeta.subject)
          );

          const hasScoreData =
            !row.delete_row &&
            ((row.raw_score !== '' && row.raw_score !== null && row.raw_score !== undefined) ||
              (row.manual_grade !== '' &&
                row.manual_grade !== null &&
                row.manual_grade !== undefined) ||
              (row.rank !== '' && row.rank !== null && row.rank !== undefined) ||
              (row.percentile !== '' && row.percentile !== null && row.percentile !== undefined));

          // 기존에 성적이 있던 행인데 점수를 모두 비웠거나 삭제 표시한 경우 기존 성적 레코드 삭제
          if (!hasScoreData) {
            if (existingIdx >= 0) {
              store.scores.splice(existingIdx, 1);
              deletedCount++;
            }
            continue;
          }

          const mergedInput = {
            ...examMeta,
            ...row,
            school_name: (
              row.school_name ??
              store.studentProfiles[row.student_id]?.school_name ??
              ''
            ).trim(),
          };

          const normalized = normalizeScoreRecord(
            mergedInput,
            existingIdx >= 0 ? store.scores[existingIdx].id : null,
            user.id
          );

          if (existingIdx >= 0) {
            store.scores[existingIdx] = normalized;
          } else {
            store.scores.push(normalized);
          }
          savedCount++;

          // 학교별 평균/표준편차/전교생수 수집 (타 반 동교생 자동 동기화용)
          if (normalized.exam_category === 'INTERNAL' && normalized.school_name) {
            const prevStats = schoolStatsMap[normalized.school_name] || {};
            schoolStatsMap[normalized.school_name] = {
              school_mean:
                normalized.school_mean !== null
                  ? normalized.school_mean
                  : prevStats.school_mean ?? null,
              school_std_dev:
                normalized.school_std_dev !== null
                  ? normalized.school_std_dev
                  : prevStats.school_std_dev ?? null,
              total_students:
                normalized.total_students !== null
                  ? normalized.total_students
                  : prevStats.total_students ?? null,
            };
          }
        }

        // 일괄 저장 후 다른 반에 속한 동일 학교·동일 시험 학생들의 기존 기록에도 평균/표준편차/전교생수 동기화
        if (
          syncSchoolStats !== false &&
          examMeta.exam_category === 'INTERNAL' &&
          Object.keys(schoolStatsMap).length > 0
        ) {
          store.scores = store.scores.map((sc) => {
            if (
              sc.exam_category === 'INTERNAL' &&
              sc.school_name &&
              schoolStatsMap[sc.school_name] &&
              Number(sc.exam_year) === Number(examMeta.exam_year) &&
              Number(sc.school_grade) === Number(examMeta.school_grade) &&
              sc.exam_period === examMeta.exam_period &&
              sc.subject === examMeta.subject
            ) {
              const donor = schoolStatsMap[sc.school_name];
              const nextMean = sc.school_mean !== null ? sc.school_mean : donor.school_mean;
              const nextStdDev =
                sc.school_std_dev !== null ? sc.school_std_dev : donor.school_std_dev;
              const nextTotal =
                sc.total_students !== null ? sc.total_students : donor.total_students;
              const peerGradeSys =
                Number(store.studentProfiles[sc.student_id]?.grade_system) || 9;
              const peerAutoGrade = calculateAutoGrade(
                {
                  ...sc,
                  school_mean: nextMean,
                  school_std_dev: nextStdDev,
                  total_students: nextTotal,
                },
                peerGradeSys
              );

              return {
                ...sc,
                school_mean: nextMean,
                school_std_dev: nextStdDev,
                total_students: nextTotal,
                grade: peerAutoGrade.grade ?? sc.grade,
              };
            }
            return sc;
          });
        }

        await saveScoreStore(db, store);
        return NextResponse.json({
          success: true,
          savedCount,
          deletedCount,
          scores: store.scores,
          studentProfiles: store.studentProfiles,
        });
      }

      return NextResponse.json({ error: '지원하지 않는 요청 액션입니다.' }, { status: 400 });
    });
  } catch (err) {
    console.error('POST /api/scores error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/scores?id=... — 성적 레코드 삭제
 */
export async function DELETE(req) {
  const { error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '삭제할 성적 ID가 필요합니다.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);
    return await runWithStoreLock(async () => {
      const store = await loadScoreStore(db);
      const beforeLen = store.scores.length;
      store.scores = store.scores.filter((sc) => sc.id !== id);

      if (store.scores.length === beforeLen) {
        return NextResponse.json({ error: '해당 성적 기록을 찾을 수 없습니다.' }, { status: 404 });
      }

      await saveScoreStore(db, store);
      return NextResponse.json({
        success: true,
        scores: store.scores,
      });
    });
  } catch (err) {
    console.error('DELETE /api/scores error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
