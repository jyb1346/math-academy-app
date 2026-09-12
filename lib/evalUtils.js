/**
 * 📝 평가 항목, 시험 종류, 진도 및 교재별 과제 체크표 파싱/포맷팅 유틸리티
 */

export const DEFAULT_EVAL_KEYS = [
  { key: 'concept', name: '개념 이해도', icon: '📘', dbCol: 'concept_score' },
  { key: 'calc', name: '연산/계산 정확도', icon: '🔢', dbCol: 'calc_score' },
  { key: 'app', name: '응용/심화 해결력', icon: '💡', dbCol: 'app_score' },
  { key: 'attitude', name: '수업 태도/집중도', icon: '👀', dbCol: 'attitude_score' },
  { key: 'homework', name: '과제 완성도', icon: '📚', dbCol: 'homework_score' },
  { key: 'perseverance', name: '오답 복습 및 끈기', icon: '🔥', dbCol: 'perseverance_score' },
];

export const HOMEWORK_STATUS_OPTIONS = [
  { value: '미체크', label: '미체크', color: 'bg-slate-100 text-slate-600 border-slate-300' },
  { value: '완료', label: '완료 🟢', color: 'bg-emerald-600 text-white border-emerald-700' },
  { value: '일부완료', label: '일부완료 🔵', color: 'bg-sky-500 text-white border-sky-600' },
  { value: '미완료', label: '미완료 🔴', color: 'bg-rose-600 text-white border-rose-700' },
  { value: '질문남음', label: '질문남음 🟡', color: 'bg-amber-500 text-white border-amber-600' },
];

// 코멘트에 메타데이터(시험종류, 점수, 커스텀 항목, 진도/과제표) 포맷팅
export function formatTeacherCommentWithTestScoreAndItems({
  comment = '',
  testScore = '',
  testType = '단원평가',
  customItems = [],
  lessonProgress = '',
  homeworkBooks = [],
}) {
  let cleanComment = comment || '';

  // 반복적으로 앞부분에 있는 메타데이터 태그 제거
  let changed = true;
  while (changed) {
    changed = false;
    const testMatch = cleanComment.match(/^\[TEST_SCORE:(.+)\](?:\r?\n|$)/);
    if (testMatch) {
      cleanComment = cleanComment.slice(testMatch[0].length);
      changed = true;
      continue;
    }
    const legacyTestMatch = cleanComment.match(/^\[WEEKLY_TEST:(.+)\](?:\r?\n|$)/);
    if (legacyTestMatch) {
      cleanComment = cleanComment.slice(legacyTestMatch[0].length);
      changed = true;
      continue;
    }
    const customMatch = cleanComment.match(/^\[CUSTOM_ITEMS:(.+)\](?:\r?\n|$)/);
    if (customMatch) {
      cleanComment = cleanComment.slice(customMatch[0].length);
      changed = true;
      continue;
    }
    const hwMatch = cleanComment.match(/^\[HOMEWORK_PROGRESS:(.+)\](?:\r?\n|$)/);
    if (hwMatch) {
      cleanComment = cleanComment.slice(hwMatch[0].length);
      changed = true;
      continue;
    }
  }

  // 과거 파싱 버그로 저장된 찌꺼기 ('}]') 정제
  if (cleanComment === '}]') {
    cleanComment = '';
  } else {
    cleanComment = cleanComment.replace(/^\]\s*\n?/, '').trim();
    if (cleanComment === '}]') cleanComment = '';
  }

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

  // 진도 및 교재별 과제 메타데이터
  const trimmedProgress = (lessonProgress || '').trim();
  const validBooks = (homeworkBooks || [])
    .filter((b) => b.name && b.name.trim())
    .map((b) => ({
      name: b.name.trim(),
      range: (b.range || '').trim(),
      status: b.status || '미체크',
    }));

  if (trimmedProgress || validBooks.length > 0) {
    prefix += `[HOMEWORK_PROGRESS:${JSON.stringify({ lessonProgress: trimmedProgress, books: validBooks })}]\n`;
  }

  return prefix + cleanComment;
}

// 레코드에서 항목 리스트, 시험정보, 진도 및 과제표, 코멘트 파싱
export function parseEvaluationRecord(evalRecord) {
  if (!evalRecord) {
    return {
      items: [],
      testType: '단원평가',
      testScore: null,
      weeklyScore: null,
      lessonProgress: '',
      homeworkBooks: [],
      comment: '',
      customItems: [],
    };
  }

  let text = evalRecord.teacher_comment || '';
  let testType = '단원평가';
  let testScore = null;
  let customItems = [];
  let lessonProgress = '';
  let homeworkBooks = [];

  let changed = true;
  while (changed) {
    changed = false;
    // 1. [TEST_SCORE:타입|점수]
    const testMatch = text.match(/^\[TEST_SCORE:(.+)\](?:\r?\n|$)/);
    if (testMatch) {
      const parts = testMatch[1].split('|');
      testType = parts[0]?.trim() || '단원평가';
      testScore = parts.slice(1).join('|').trim();
      text = text.slice(testMatch[0].length);
      changed = true;
      continue;
    }

    // 2. [WEEKLY_TEST:점수] (레거시 호환)
    const legacyTestMatch = text.match(/^\[WEEKLY_TEST:(.+)\](?:\r?\n|$)/);
    if (legacyTestMatch) {
      testType = '주간테스트';
      testScore = legacyTestMatch[1].trim();
      text = text.slice(legacyTestMatch[0].length);
      changed = true;
      continue;
    }

    // 3. [CUSTOM_ITEMS:[...]]
    const customMatch = text.match(/^\[CUSTOM_ITEMS:(.+)\](?:\r?\n|$)/);
    if (customMatch) {
      try {
        customItems = JSON.parse(customMatch[1]);
      } catch (e) {
        customItems = [];
      }
      text = text.slice(customMatch[0].length);
      changed = true;
      continue;
    }

    // 4. [HOMEWORK_PROGRESS:{...}]
    const hwMatch = text.match(/^\[HOMEWORK_PROGRESS:(.+)\](?:\r?\n|$)/);
    if (hwMatch) {
      try {
        const parsedHw = JSON.parse(hwMatch[1]);
        lessonProgress = parsedHw.lessonProgress || '';
        homeworkBooks = Array.isArray(parsedHw.books) ? parsedHw.books : [];
      } catch (e) {
        lessonProgress = '';
        homeworkBooks = [];
      }
      text = text.slice(hwMatch[0].length);
      changed = true;
      continue;
    }
  }

  // Fallback for weekly_test_score from DB column if testScore wasn't in comment
  if (!testScore && evalRecord.weekly_test_score && String(evalRecord.weekly_test_score).trim()) {
    testType = '주간테스트';
    testScore = String(evalRecord.weekly_test_score).trim();
  }

  // 코멘트 정리
  let cleanComment = text.trim();
  // 과거 파싱 버그로 저장된 찌꺼기 ('}]') 정제
  if (cleanComment === '}]') {
    cleanComment = '';
  } else {
    cleanComment = cleanComment.replace(/^\]\s*\n?/, '').trim();
    if (cleanComment === '}]') cleanComment = '';
  }

  // 단일 리스트로 모든 활성화 항목(기본 6개 중 non-null + 커스텀 항목) 조합
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
    lessonProgress,
    homeworkBooks,
    comment: cleanComment,
    customItems: Array.isArray(customItems) ? customItems : [],
  };
}

// 특정 과제 도서의 상태(status)만 빠르게 업데이트한 코멘트 반환
export function updateBookStatusInComment(rawComment, bookName, newStatus) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  const updatedBooks = (parsed.homeworkBooks || []).map((b) =>
    b.name === bookName ? { ...b, status: newStatus } : b
  );
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: parsed.testScore,
    testType: parsed.testType,
    customItems: parsed.customItems,
    lessonProgress: parsed.lessonProgress,
    homeworkBooks: updatedBooks,
  });
}

// 진도 내용 및 전체 교재 범위를 수정하여 업데이트한 코멘트 반환
export function updateEvaluationProgressAndBooksInComment(rawComment, newLessonProgress, newHomeworkBooks) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: parsed.testScore,
    testType: parsed.testType,
    customItems: parsed.customItems,
    lessonProgress: newLessonProgress !== undefined ? newLessonProgress : parsed.lessonProgress,
    homeworkBooks: newHomeworkBooks !== undefined ? newHomeworkBooks : parsed.homeworkBooks,
  });
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
