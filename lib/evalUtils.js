/**
 * 📝 평가 항목(기본 6개 선택적 온/오프 + 커스텀 추가 항목) 및 시험 종류/점수 파싱/포맷팅 유틸리티
 */

export const DEFAULT_EVAL_KEYS = [
  { key: 'concept', name: '개념 이해도', icon: '📘', dbCol: 'concept_score' },
  { key: 'calc', name: '연산/계산 정확도', icon: '🔢', dbCol: 'calc_score' },
  { key: 'app', name: '응용/심화 해결력', icon: '💡', dbCol: 'app_score' },
  { key: 'attitude', name: '수업 태도/집중도', icon: '👀', dbCol: 'attitude_score' },
  { key: 'homework', name: '과제 완성도', icon: '📚', dbCol: 'homework_score' },
  { key: 'perseverance', name: '오답 복습 및 끈기', icon: '🔥', dbCol: 'perseverance_score' },
];

// 코멘트에 메타데이터(시험종류, 점수, 커스텀 항목) 포맷팅
export function formatTeacherCommentWithTestScoreAndItems({
  comment = '',
  testScore = '',
  testType = '단원평가',
  customItems = [],
}) {
  let cleanComment = (comment || '')
    .replace(/^\[TEST_SCORE:[^\]]*\]\n?/, '')
    .replace(/^\[WEEKLY_TEST:[^\]]*\]\n?/, '')
    .replace(/^\[CUSTOM_ITEMS:[^\]]*\]\n?/, '')
    .trim();

  const trimmedScore = (testScore || '').trim();
  const trimmedType = (testType || '단원평가').trim();

  let prefix = '';

  if (trimmedScore) {
    prefix += `[TEST_SCORE:${trimmedType}|${trimmedScore}]\n`;
  }

  if (customItems && customItems.length > 0) {
    const validCustom = customItems
      .filter((it) => it.name && it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        score: Number(it.score) || 8,
      }));
    if (validCustom.length > 0) {
      prefix += `[CUSTOM_ITEMS:${JSON.stringify(validCustom)}]\n`;
    }
  }

  return prefix + cleanComment;
}

// 레코드에서 항목 리스트(기본 항목 중 선택된 것 + 커스텀 항목), 시험정보, 코멘트 파싱
export function parseEvaluationRecord(evalRecord) {
  if (!evalRecord) {
    return {
      items: [],
      testType: '단원평가',
      testScore: null,
      weeklyScore: null,
      comment: '',
      customItems: [],
    };
  }

  const rawComment = evalRecord.teacher_comment || '';
  let cleanComment = rawComment;
  let testType = '단원평가';
  let testScore = null;
  let customItems = [];

  // 1. 시험 정보 파싱 [TEST_SCORE:타입|점수] or [WEEKLY_TEST:점수]
  const testMatch = cleanComment.match(/^\[TEST_SCORE:([^|\]]+)\|([^\]]+)\]\n?/);
  if (testMatch) {
    testType = testMatch[1].trim();
    testScore = testMatch[2].trim();
    cleanComment = cleanComment.replace(testMatch[0], '');
  } else {
    const legacyTestMatch = cleanComment.match(/^\[WEEKLY_TEST:([^\]]+)\]\n?/);
    if (legacyTestMatch) {
      testType = '주간테스트';
      testScore = legacyTestMatch[1].trim();
      cleanComment = cleanComment.replace(legacyTestMatch[0], '');
    } else if (evalRecord.weekly_test_score && String(evalRecord.weekly_test_score).trim()) {
      testType = '주간테스트';
      testScore = String(evalRecord.weekly_test_score).trim();
    }
  }

  // 2. 커스텀 항목 파싱 [CUSTOM_ITEMS:[{name, score}, ...]]
  const customMatch = cleanComment.match(/^\[CUSTOM_ITEMS:([^\]]+)\]\n?/);
  if (customMatch) {
    try {
      customItems = JSON.parse(customMatch[1]);
    } catch (e) {
      customItems = [];
    }
    cleanComment = cleanComment.replace(customMatch[0], '');
  }

  // 3. 단일 리스트로 모든 활성화 항목(기본 6개 중 non-null + 커스텀 항목) 조합
  const items = [];

  DEFAULT_EVAL_KEYS.forEach((def) => {
    const val = evalRecord[def.dbCol];
    if (val !== null && val !== undefined) {
      items.push({
        key: def.key,
        name: def.name,
        score: Number(val),
        icon: def.icon,
        isCustom: false,
      });
    }
  });

  if (Array.isArray(customItems)) {
    customItems.forEach((c, idx) => {
      items.push({
        key: `custom_${idx}`,
        name: c.name,
        score: Number(c.score) || 8,
        icon: '✨',
        isCustom: true,
      });
    });
  }

  return {
    items,
    testType,
    testScore,
    weeklyScore: testScore,
    comment: cleanComment.trim(),
    customItems: Array.isArray(customItems) ? customItems : [],
  };
}

// 하위 호환 래퍼 함수들
export function formatTeacherCommentWithTestScore(comment, testScore, testType = '단원평가') {
  return formatTeacherCommentWithTestScoreAndItems({ comment, testScore, testType });
}

export function parseTeacherCommentAndTestScore(rawComment, dbWeeklyScore = null) {
  return parseEvaluationRecord({ teacher_comment: rawComment, weekly_test_score: dbWeeklyScore });
}

export function formatTeacherCommentWithWeeklyScore(comment, weeklyScore) {
  return formatTeacherCommentWithTestScore(comment, weeklyScore, '주간테스트');
}

export function parseTeacherCommentAndWeeklyScore(rawComment, dbWeeklyScore = null) {
  return parseEvaluationRecord({ teacher_comment: rawComment, weekly_test_score: dbWeeklyScore });
}
