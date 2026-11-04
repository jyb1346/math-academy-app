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

/**
 * 한국 시간(KST) 기준 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
export function getTodayKstDateString() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/**
 * 과제 상태 변경 시 최초 검사 상태/일시 및 최종 완료 일시를 자동으로 보존·기록하는 헬퍼
 * @param {Object} existingBook - 기존 교재 과제 객체
 * @param {string} newStatus - 변경할 새 상태 ('미체크' | '완료' | '일부완료' | '미완료' | '질문남음')
 * @param {string} checkDateStr - 검사 기준 날짜 (YYYY-MM-DD)
 */
export function applyBookStatusTransition(
  existingBook = {},
  newStatus = '미체크',
  checkDateStr = getTodayKstDateString()
) {
  const prevStatus = existingBook.status || '미체크';

  // '미체크'로 되돌리는 경우 검사 이력 초기화
  if (newStatus === '미체크') {
    return {
      ...existingBook,
      status: '미체크',
      firstStatus: null,
      firstCheckedAt: null,
      completedAt: null,
      lastUpdatedAt: checkDateStr,
    };
  }

  // 최초 검사 상태 보존: 이전에 firstStatus가 없었거나 '미체크'였을 때만 기록
  let firstStatus = existingBook.firstStatus || null;
  let firstCheckedAt = existingBook.firstCheckedAt || null;

  if (!firstStatus || firstStatus === '미체크') {
    // 만약 기존 데이터에 이미 미완료/일부완료/질문남음 상태가 있었는데 firstStatus만 없었던 레거시 데이터라면 이전 상태를 최초 상태로 승격
    if (prevStatus && prevStatus !== '미체크' && prevStatus !== newStatus) {
      firstStatus = prevStatus;
      firstCheckedAt = existingBook.lastUpdatedAt || checkDateStr;
    } else {
      firstStatus = newStatus;
      firstCheckedAt = checkDateStr;
    }
  }

  // 완료 시각 기록
  let completedAt = existingBook.completedAt || null;
  if (newStatus === '완료') {
    if (prevStatus !== '완료' || !completedAt) {
      completedAt = checkDateStr;
    }
  } else {
    completedAt = null;
  }

  return {
    ...existingBook,
    status: newStatus,
    firstStatus,
    firstCheckedAt,
    completedAt,
    lastUpdatedAt: checkDateStr,
  };
}

// 코멘트에 메타데이터(시험종류, 점수, 커스텀 항목, 진도/과제표, 알림톡 발송일시, 학부모 답장 확인일시) 포맷팅
export function formatTeacherCommentWithTestScoreAndItems({
  comment = '',
  testScore = '',
  testType = '단원평가',
  examName = '',
  customItems = [],
  lessonProgress = '',
  homeworkBooks = [],
  alimtalkSentAt = null,
  parentReplyCheckedAt = null,
}) {
  let cleanComment = comment || '';

  // 반복적으로 앞부분에 있는 메타데이터 태그 제거
  let changed = true;
  while (changed) {
    changed = false;
    const alimMatch = cleanComment.match(/^\[ALIMTALK_SENT:(.+)\](?:\r?\n|$)/);
    if (alimMatch) {
      cleanComment = cleanComment.slice(alimMatch[0].length);
      changed = true;
      continue;
    }
    const replyCheckedMatch = cleanComment.match(/^\[PARENT_REPLY_CHECKED:(.+)\](?:\r?\n|$)/);
    if (replyCheckedMatch) {
      cleanComment = cleanComment.slice(replyCheckedMatch[0].length);
      changed = true;
      continue;
    }
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
  const trimmedExamName = (examName || '').trim();

  let prefix = '';

  if (alimtalkSentAt) {
    prefix += `[ALIMTALK_SENT:${alimtalkSentAt}]\n`;
  }

  if (parentReplyCheckedAt) {
    prefix += `[PARENT_REPLY_CHECKED:${parentReplyCheckedAt}]\n`;
  }

  if (trimmedScore || trimmedExamName) {
    prefix += `[TEST_SCORE:${trimmedType}|${trimmedScore}|${trimmedExamName}]\n`;
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

// 레코드에서 항목 리스트, 시험정보, 진도 및 과제표, 알림톡 발송일시, 학부모 답장 확인일시, 코멘트 파싱
export function parseEvaluationRecord(evalRecord) {
  if (!evalRecord) {
    return {
      items: [],
      testType: '단원평가',
      testScore: null,
      examName: '',
      weeklyScore: null,
      lessonProgress: '',
      homeworkBooks: [],
      comment: '',
      customItems: [],
      alimtalkSentAt: null,
      parentReplyCheckedAt: null,
    };
  }

  let text = evalRecord.teacher_comment || '';
  let testType = '단원평가';
  let testScore = null;
  let examName = '';
  let customItems = [];
  let lessonProgress = '';
  let homeworkBooks = [];
  let alimtalkSentAt = null;
  let parentReplyCheckedAt = null;

  let changed = true;
  while (changed) {
    changed = false;
    // 0. [ALIMTALK_SENT:일시]
    const alimMatch = text.match(/^\[ALIMTALK_SENT:(.+)\](?:\r?\n|$)/);
    if (alimMatch) {
      alimtalkSentAt = alimMatch[1].trim();
      text = text.slice(alimMatch[0].length);
      changed = true;
      continue;
    }

    // 0-b. [PARENT_REPLY_CHECKED:일시]
    const replyCheckedMatch = text.match(/^\[PARENT_REPLY_CHECKED:(.+)\](?:\r?\n|$)/);
    if (replyCheckedMatch) {
      parentReplyCheckedAt = replyCheckedMatch[1].trim();
      text = text.slice(replyCheckedMatch[0].length);
      changed = true;
      continue;
    }

    // 1. [TEST_SCORE:타입|점수|시험지이름]
    const testMatch = text.match(/^\[TEST_SCORE:(.+)\](?:\r?\n|$)/);
    if (testMatch) {
      const parts = testMatch[1].split('|');
      testType = parts[0]?.trim() || '단원평가';
      if (parts.length >= 3) {
        testScore = parts.slice(1, -1).join('|').trim();
        examName = parts[parts.length - 1]?.trim() || '';
      } else {
        testScore = parts.slice(1).join('|').trim();
        examName = '';
      }
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
    examName,
    weeklyScore: testScore,
    lessonProgress,
    homeworkBooks,
    comment: cleanComment,
    customItems: Array.isArray(customItems) ? customItems : [],
    alimtalkSentAt: alimtalkSentAt || null,
    parentReplyCheckedAt: parentReplyCheckedAt || null,
  };
}

// 해당 평가 레코드의 모든 과제 도서 상태(status)를 일괄 변경한 코멘트 반환
export function updateAllBooksStatusInComment(rawComment, newStatus) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  const updatedBooks = (parsed.homeworkBooks || []).map((b) => ({
    ...b,
    status: newStatus,
  }));
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: parsed.testScore,
    testType: parsed.testType,
    examName: parsed.examName,
    customItems: parsed.customItems,
    lessonProgress: parsed.lessonProgress,
    homeworkBooks: updatedBooks,
    alimtalkSentAt: parsed.alimtalkSentAt,
    parentReplyCheckedAt: parsed.parentReplyCheckedAt,
  });
}

export function updateBookStatusInComment(rawComment, bookName, newStatus) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  const updatedBooks = (parsed.homeworkBooks || []).map((b) =>
    b.name === bookName ? { ...b, status: newStatus } : b
  );
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: parsed.testScore,
    testType: parsed.testType,
    examName: parsed.examName,
    customItems: parsed.customItems,
    lessonProgress: parsed.lessonProgress,
    homeworkBooks: updatedBooks,
    alimtalkSentAt: parsed.alimtalkSentAt,
    parentReplyCheckedAt: parsed.parentReplyCheckedAt,
  });
}

// 진도 내용 및 전체 교재 범위, 시험점수/종류를 수정하여 업데이트한 코멘트 반환
export function updateEvaluationProgressAndBooksInComment(
  rawComment,
  newLessonProgress,
  newHomeworkBooks,
  newTestType,
  newTestScore,
  newExamName
) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: newTestScore !== undefined ? newTestScore : parsed.testScore,
    testType: newTestType !== undefined ? newTestType : parsed.testType,
    examName: newExamName !== undefined ? newExamName : parsed.examName,
    customItems: parsed.customItems,
    lessonProgress: newLessonProgress !== undefined ? newLessonProgress : parsed.lessonProgress,
    homeworkBooks: newHomeworkBooks !== undefined ? newHomeworkBooks : parsed.homeworkBooks,
    alimtalkSentAt: parsed.alimtalkSentAt,
    parentReplyCheckedAt: parsed.parentReplyCheckedAt,
  });
}

// 알림톡 발송 완료 타임스탬프를 코멘트에 기록/갱신
export function markAlimtalkSentInComment(rawComment, timestamp = new Date().toISOString()) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: parsed.testScore,
    testType: parsed.testType,
    examName: parsed.examName,
    customItems: parsed.customItems,
    lessonProgress: parsed.lessonProgress,
    homeworkBooks: parsed.homeworkBooks,
    alimtalkSentAt: timestamp || new Date().toISOString(),
    parentReplyCheckedAt: parsed.parentReplyCheckedAt,
  });
}

// 학부모 답장 확인 완료 타임스탬프를 코멘트에 기록/해제 (checkedTimestamp가 null/false이면 미확인 상태로 전환)
export function markParentReplyCheckedInComment(rawComment, checkedTimestamp = new Date().toISOString()) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: parsed.testScore,
    testType: parsed.testType,
    examName: parsed.examName,
    customItems: parsed.customItems,
    lessonProgress: parsed.lessonProgress,
    homeworkBooks: parsed.homeworkBooks,
    alimtalkSentAt: parsed.alimtalkSentAt,
    parentReplyCheckedAt: checkedTimestamp ? checkedTimestamp : null,
  });
}

// 학부모 답장이 도착했으나 아직 확인하지 않았는지(또는 확인 이후 새 답장으로 수정되었는지) 판별
export function isParentReplyUnread(evalRecord, parsedRecord = null) {
  const replyText = evalRecord?.parent_reply ? String(evalRecord.parent_reply).trim() : '';
  if (!replyText) return false;

  const parsed = parsedRecord || parseEvaluationRecord(evalRecord);
  if (!parsed?.parentReplyCheckedAt) return true;

  if (evalRecord?.parent_reply_at) {
    const replyTime = new Date(evalRecord.parent_reply_at).getTime();
    const checkedTime = new Date(parsed.parentReplyCheckedAt).getTime();
    if (!Number.isNaN(replyTime) && !Number.isNaN(checkedTime) && replyTime > checkedTime + 1000) {
      return true;
    }
  }

  return false;
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

/**
 * 평가 기록 목록에서 가장 최근에 출제/부여된 교재명 목록 추출 (순서 유지 및 중복 제거)
 * @param {Array} evaluations - 평가 레코드 배열
 * @returns {Array<string>} 최근 사용된 교재명 목록
 */
export function extractRecentBookNamesFromEvaluations(evaluations = []) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) return [];

  // 최신 날짜순 정렬
  const sorted = [...evaluations].sort(
    (a, b) => new Date(b.eval_date).getTime() - new Date(a.eval_date).getTime()
  );

  for (const ev of sorted) {
    const parsed = parseEvaluationRecord(ev);
    if (parsed.homeworkBooks && parsed.homeworkBooks.length > 0) {
      const validNames = parsed.homeworkBooks
        .map((b) => b.name?.trim())
        .filter(Boolean);

      if (validNames.length > 0) {
        return [...new Set(validNames)];
      }
    }
  }

  return [];
}

/**
 * 평가 기록 목록에서 사용된 모든 고유 교재명 목록 추출 (순서 유지)
 * @param {Array} evaluations - 평가 레코드 배열
 * @returns {Array<string>} 고유 교재명 배열
 */
export function extractAllUniqueBookNamesFromEvaluations(evaluations = []) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) return [];
  const names = [];
  evaluations.forEach((ev) => {
    const parsed = parseEvaluationRecord(ev);
    (parsed.homeworkBooks || []).forEach((b) => {
      const trimmed = b.name?.trim();
      if (trimmed && !names.includes(trimmed)) {
        names.push(trimmed);
      }
    });
  });
  return names;
}
