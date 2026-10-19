const BUCKET_NAME = 'attachments';
const STORE_PATH = 'system_store/high_school_scores_v1.json';

/**
 * 학년 코드('M1'~'M3', 'H1'~'H3') 정규화 헬퍼
 * - 기존 데이터(school_level이 없고 school_grade가 1,2,3인 경우)는 100% 'HIGH'(고1~고3)로 보존
 */
export function normalizeSchoolLevelAndGrade(rawProfile = {}) {
  let level = rawProfile.school_level;
  let grade = Number(rawProfile.school_grade) || 1;

  if (typeof rawProfile.grade_code === 'string') {
    const code = rawProfile.grade_code.trim().toUpperCase();
    if (code.startsWith('M')) {
      level = 'MIDDLE';
      grade = Math.max(1, Math.min(3, Number(code.slice(1)) || 1));
    } else if (code.startsWith('H')) {
      level = 'HIGH';
      grade = Math.max(1, Math.min(3, Number(code.slice(1)) || 1));
    }
  }

  if (level !== 'MIDDLE' && level !== 'HIGH') {
    const schoolName = (rawProfile.school_name || '').trim();
    if (schoolName.endsWith('중') || schoolName.endsWith('중학교')) {
      level = 'MIDDLE';
    } else {
      level = 'HIGH';
    }
  }

  grade = Math.max(1, Math.min(3, grade));
  const gradeCode = `${level === 'MIDDLE' ? 'M' : 'H'}${grade}`;
  const gradeLabel = `${level === 'MIDDLE' ? '중' : '고'}${grade}`;

  // 학년별 기본 등급제 자동 판별 (중1~고1: 5등급제, 고2~고3: 9등급제)
  let defaultSystem = 9;
  if (level === 'MIDDLE' || (level === 'HIGH' && grade === 1)) {
    defaultSystem = 5;
  }

  const gradeSystem =
    rawProfile.grade_system !== undefined &&
    rawProfile.grade_system !== null &&
    rawProfile.grade_system !== ''
      ? Number(rawProfile.grade_system) === 5
        ? 5
        : 9
      : defaultSystem;

  return {
    school_level: level,
    school_grade: grade,
    grade_code: gradeCode,
    grade_label: gradeLabel,
    grade_system: gradeSystem,
  };
}

/**
 * 📦 Supabase Storage 기반 성적 및 학생 학년·학교 프로필 저장소 로드
 */
export async function loadScoreStore(db) {
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
  } catch {
    return { scores: [], studentProfiles: {} };
  }
}

/**
 * 📦 Supabase Storage에 성적 및 학생 학교 프로필 영구 저장
 */
export async function saveScoreStore(db, storeData) {
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
 * 학생 배열에 저장된 학교·학년 프로필 정보를 병합하여 반환
 */
export function enrichStudentsWithProfiles(students = [], studentProfiles = {}) {
  return (students || []).map((st) => {
    const prof = studentProfiles[st.id] || {};
    const norm = normalizeSchoolLevelAndGrade(prof);
    const hasExplicitProfile = Boolean(
      prof.school_name || prof.school_level || prof.school_grade || prof.grade_code
    );
    return {
      ...st,
      school_name: prof.school_name || st.school_name || '',
      school_level: norm.school_level,
      school_grade: norm.school_grade,
      grade_code: norm.grade_code,
      grade_label: hasExplicitProfile ? norm.grade_label : '',
      grade_system: norm.grade_system,
      target_grade: prof.target_grade ?? null,
      target_score: prof.target_score ?? null,
    };
  });
}

