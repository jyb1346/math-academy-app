/**
 * 📝 평가 항목, 시험 종류, 진도 및 교재별 과제 체크표 파싱/포맷팅 및 학생 상태 정밀 진단 유틸리티
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

// 코멘트에 메타데이터(반정보, 시험종류, 점수, 커스텀 항목, 진도/과제표, 알림톡 발송일시, 학부모 답장 확인일시) 포맷팅
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
  classId = null,
  className = '',
}) {
  let cleanComment = comment || '';

  // 반복적으로 앞부분에 있는 메타데이터 태그 제거
  let changed = true;
  while (changed) {
    changed = false;
    const classInfoMatch = cleanComment.match(/^\[CLASS_INFO:(.+)\](?:\r?\n|$)/);
    if (classInfoMatch) {
      cleanComment = cleanComment.slice(classInfoMatch[0].length);
      changed = true;
      continue;
    }
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
  const trimmedClassId = classId !== null && classId !== undefined ? String(classId).trim() : '';
  const trimmedClassName = (className || '').trim();

  let prefix = '';

  if (trimmedClassId || trimmedClassName) {
    prefix += `[CLASS_INFO:${trimmedClassId}|${trimmedClassName}]\n`;
  }

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

  // 진도 및 교재별 과제 메타데이터 (이력 필드 보존)
  const trimmedProgress = (lessonProgress || '').trim();
  const validBooks = (homeworkBooks || [])
    .filter((b) => b.name && b.name.trim())
    .map((b) => {
      const bookObj = {
        name: b.name.trim(),
        range: (b.range || '').trim(),
        status: b.status || '미체크',
      };
      if (b.firstStatus) bookObj.firstStatus = b.firstStatus;
      if (b.firstCheckedAt) bookObj.firstCheckedAt = b.firstCheckedAt;
      if (b.completedAt) bookObj.completedAt = b.completedAt;
      if (b.lastUpdatedAt) bookObj.lastUpdatedAt = b.lastUpdatedAt;
      return bookObj;
    });

  if (trimmedProgress || validBooks.length > 0) {
    prefix += `[HOMEWORK_PROGRESS:${JSON.stringify({ lessonProgress: trimmedProgress, books: validBooks })}]\n`;
  }

  return prefix + cleanComment;
}

// 레코드에서 반정보, 항목 리스트, 시험정보, 진도 및 과제표, 알림톡 발송일시, 학부모 답장 확인일시, 코멘트 파싱
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
      classId: null,
      className: '',
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
  let classId = null;
  let className = '';

  let changed = true;
  while (changed) {
    changed = false;
    // 0-0. [CLASS_INFO:반ID|반이름]
    const classInfoMatch = text.match(/^\[CLASS_INFO:(.+)\](?:\r?\n|$)/);
    if (classInfoMatch) {
      const cParts = classInfoMatch[1].split('|');
      classId = cParts[0]?.trim() || null;
      className = cParts.slice(1).join('|').trim() || '';
      text = text.slice(classInfoMatch[0].length);
      changed = true;
      continue;
    }

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
        examName = parts.at(-1)?.trim() || '';
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
  if (cleanComment === '}]') {
    cleanComment = '';
  } else {
    cleanComment = cleanComment.replace(/^\]\s*\n?/, '').trim();
    if (cleanComment === '}]') cleanComment = '';
  }

  // 단일 리스트로 모든 활성화 항목 조합
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
    classId: classId || null,
    className: className || '',
  };
}

/**
 * 특정 평가 레코드가 조회 대상 반(targetClassId)에 속하는지 판별
 * - 레코드에 [CLASS_INFO:classId|className] 태그가 있으면 정확히 해당 반과 일치할 때만 true
 * - 태그가 없는 과거(레거시) 레코드는 반 담당 강사(classOwnerTeacherId)가 작성한 기록일 때만 호환 표시
 */
export function isEvalMatchingClass(evalRecord, targetClassId, classOwnerTeacherId = null) {
  if (!evalRecord) return false;
  if (!targetClassId || targetClassId === 'ALL' || targetClassId === 'all') return true;

  const parsed = parseEvaluationRecord(evalRecord);
  if (parsed.classId) {
    return String(parsed.classId) === String(targetClassId);
  }

  // 레거시 기록(classId 미지정): 다른 선생님이 작성한 수업 기록이 내 특강반에 섞이지 않도록 구분
  if (classOwnerTeacherId && evalRecord.teacher_id) {
    return String(evalRecord.teacher_id) === String(classOwnerTeacherId);
  }

  return true;
}

// 해당 평가 레코드의 모든 과제 도서 상태(status)를 일괄 변경한 코멘트 반환 (이력 자동 기록)
export function updateAllBooksStatusInComment(rawComment, newStatus, checkDateStr = getTodayKstDateString()) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  const updatedBooks = (parsed.homeworkBooks || []).map((b) =>
    applyBookStatusTransition(b, newStatus, checkDateStr)
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
    classId: parsed.classId,
    className: parsed.className,
  });
}

// 특정 과제 도서의 상태(status)만 빠르게 업데이트한 코멘트 반환 (이력 자동 기록)
export function updateBookStatusInComment(rawComment, bookName, newStatus, checkDateStr = getTodayKstDateString()) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  const updatedBooks = (parsed.homeworkBooks || []).map((b) =>
    b.name === bookName ? applyBookStatusTransition(b, newStatus, checkDateStr) : b
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
    classId: parsed.classId,
    className: parsed.className,
  });
}

// 진도 내용 및 전체 교재 범위, 시험점수/종류를 수정하여 업데이트한 코멘트 반환 (기존 이력 보존)
export function updateEvaluationProgressAndBooksInComment(
  rawComment,
  newLessonProgress,
  newHomeworkBooks,
  newTestType,
  newTestScore,
  newExamName
) {
  const parsed = parseEvaluationRecord({ teacher_comment: rawComment });
  const todayStr = getTodayKstDateString();

  let mergedBooks = parsed.homeworkBooks;
  if (newHomeworkBooks !== undefined && Array.isArray(newHomeworkBooks)) {
    mergedBooks = newHomeworkBooks.map((nb) => {
      const existing = (parsed.homeworkBooks || []).find((eb) => eb.name === nb.name);
      if (existing) {
        if ((existing.status || '미체크') !== (nb.status || '미체크')) {
          return applyBookStatusTransition({ ...existing, range: nb.range }, nb.status || '미체크', todayStr);
        }
        return {
          ...existing,
          name: nb.name,
          range: nb.range,
          status: nb.status || existing.status || '미체크',
        };
      }
      if (nb.status && nb.status !== '미체크') {
        return applyBookStatusTransition(nb, nb.status, todayStr);
      }
      return nb;
    });
  }

  return formatTeacherCommentWithTestScoreAndItems({
    comment: parsed.comment,
    testScore: newTestScore !== undefined ? newTestScore : parsed.testScore,
    testType: newTestType !== undefined ? newTestType : parsed.testType,
    examName: newExamName !== undefined ? newExamName : parsed.examName,
    customItems: parsed.customItems,
    lessonProgress: newLessonProgress !== undefined ? newLessonProgress : parsed.lessonProgress,
    homeworkBooks: mergedBooks,
    alimtalkSentAt: parsed.alimtalkSentAt,
    parentReplyCheckedAt: parsed.parentReplyCheckedAt,
    classId: parsed.classId,
    className: parsed.className,
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
    classId: parsed.classId,
    className: parsed.className,
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
    classId: parsed.classId,
    className: parsed.className,
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
 */
export function extractRecentBookNamesFromEvaluations(evaluations = []) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) return [];

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

/**
 * 날짜 문자열(YYYY-MM-DD) 간 일수 차이 계산 (targetDate - baseDate)
 */
function calcDaysBetween(baseDateStr, targetDateStr) {
  if (!baseDateStr || !targetDateStr) return 0;
  const d1 = new Date(baseDateStr);
  const d2 = new Date(targetDateStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 시험 점수 문자열(예: "85", "85점", "18/20", "85/100")에서 100점 환산 점수를 추출
 */
function parseNormalizedTestScore(rawScore) {
  if (!rawScore) return null;
  const str = String(rawScore).trim();
  if (!str) return null;

  // 분수 형태 (예: 18/20)
  const fractionMatch = str.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    if (den > 0) {
      return Math.round((num / den) * 100);
    }
  }

  // 일반 숫자 형태 (예: 85, 85점)
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (val >= 0 && val <= 100) return val;
  }
  return null;
}

/**
 * 🧠 학생 학습 상태 정밀 진단 엔진 (4대 핵심 지표 기반)
 * 1) 제때 이행도(정시 완료율) vs 최종 이행도(지연 완료 포함) & 평균 지연 일수
 * 2) 미완료의 질적 원인 분리 (태도/미착수 vs 분량/시간부족 vs 난이도/질문막힘)
 * 3) 출결 리듬 & 최근 2주(최근 3회차) 추세 변화 (슬럼프·이탈 조기 경보)
 * 4) 숙제 이행도 × 실전 성취도(테스트·역량 점수) 교차 검증 (형식적 과제/가짜 성실 탐지)
 *
 * @param {Array} studentEvals - 특정 학생의 전체 평가 레코드 배열
 * @param {Object} options - 진단 옵션 ({ periodScope: 'RECENT_4W' | 'ALL' })
 * @returns {Object} 정밀 진단 리포트 객체
 */
export function analyzeStudentLearningState(studentEvals = [], options = {}) {
  const periodScope = options?.periodScope === 'ALL' ? 'ALL' : 'RECENT_4W';

  if (!Array.isArray(studentEvals) || studentEvals.length === 0) {
    return {
      hasData: false,
      periodScope,
      periodLabel: periodScope === 'RECENT_4W' ? '최근 4주 집중' : '전체 누적',
      totalCumulativeClasses: 0,
      grade: {
        code: 'NO_DATA',
        badgeText: '⚪ 기록 없음',
        shortLabel: '기록 없음',
        level: 'NEUTRAL',
        colorClass: 'bg-slate-100 text-slate-600 border-slate-200',
      },
      headline: '아직 누적된 출결 및 과제 평가 기록이 없습니다.',
      attendance: {
        totalClasses: 0,
        attendCount: 0,
        lateCount: 0,
        absentCount: 0,
        attendanceRate: 100,
        recentLateCount: 0,
        recentAbsentCount: 0,
      },
      homework: {
        totalAssignedCount: 0,
        upcomingUncheckedCount: 0,
        evaluatedCount: 0,
        onTimeCount: 0,
        delayedCount: 0,
        incompleteCount: 0,
        onTimeRate: 0,
        delayedRate: 0,
        incompleteRate: 0,
        finalCompletionRate: 0,
        avgDelayDays: 0,
      },
      causes: {
        totalNonOnTime: 0,
        notStartedCount: 0,
        partialCount: 0,
        questionCount: 0,
        notStartedPct: 0,
        partialPct: 0,
        questionPct: 0,
        dominantCause: 'NONE',
        dominantCauseLabel: '해당 없음',
      },
      trend: {
        recentOnTimeRate: 0,
        pastOnTimeRate: 0,
        rateDelta: 0,
        consecutiveIncompleteSessions: 0,
        isSlumpWarning: false,
        trendDirection: 'STABLE',
      },
      achievement: {
        avgTestScore: null,
        avgCompetencyScore: null,
        avgConceptAppScore: null,
        avgHomeworkScore: null,
        isSuperficialSuspect: false,
      },
      details: {
        timelinessText: '과제 데이터가 쌓이면 정시 이행률과 지연 완료 패턴이 분석됩니다.',
        causeText: '미완료 발생 시 태도·분량·난이도 원인을 자동으로 분류합니다.',
        attendanceTrendText: '출결 리듬과 최근 2주간 학습 추세를 분석합니다.',
        achievementText: '과제 이행도와 테스트/역량 점수를 교차 검증합니다.',
      },
      actionItems: ['첫 수업 피드백 및 과제를 등록하면 정밀 분석이 시작됩니다.'],
      parentConsultScript: '현재 학습 데이터 수집 단계입니다.',
    };
  }

  // 1. 전체 날짜 오름차순 정렬 (과거 ➔ 최신)
  const allSortedAsc = [...studentEvals].sort(
    (a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
  );
  const totalCumulativeClasses = allSortedAsc.length;
  const latestEvalDate = allSortedAsc.at(-1)?.eval_date || '';
  const todayStr = getTodayKstDateString();

  // 고유 수업 날짜 목록 (전체 기준 오름차순) - 다음 수업일(자동 마감일) 매칭용
  const uniqueDatesAsc = [...new Set(allSortedAsc.map((e) => e.eval_date).filter(Boolean))];

  // 진단 기간 필터 적용 ('RECENT_4W': 최근 28일 이내 또는 최소 최근 6회차 확보 / 'ALL': 전체 누적)
  let sortedAsc = allSortedAsc;
  if (periodScope === 'RECENT_4W' && allSortedAsc.length > 0 && latestEvalDate) {
    const within28Days = allSortedAsc.filter(
      (ev) => calcDaysBetween(ev.eval_date, latestEvalDate) <= 28
    );
    sortedAsc = within28Days.length >= 4 ? within28Days : allSortedAsc.slice(-Math.min(6, allSortedAsc.length));
  }
  const periodLabel =
    periodScope === 'RECENT_4W'
      ? `최근 4주 집중 (${sortedAsc.length}회)`
      : `전체 누적 (${allSortedAsc.length}회)`;

  // 2. 출결 집계
  const totalClasses = sortedAsc.length;
  let attendCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  sortedAsc.forEach((ev) => {
    const st = ev.attendance_status || 'ATTEND';
    if (st === 'ABSENT') absentCount++;
    else if (st === 'LATE') lateCount++;
    else attendCount++;
  });

  // 출석률 (결석 제외 출석+지각 비율, 정시출석률 별도)
  const attendanceRate = totalClasses > 0 ? Math.round(((attendCount + lateCount) / totalClasses) * 100) : 100;
  const onTimeAttendanceRate = totalClasses > 0 ? Math.round((attendCount / totalClasses) * 100) : 100;

  // 최근 4회 수업 출결
  const recentEvals = sortedAsc.slice(-4);
  const recentLateCount = recentEvals.filter((e) => e.attendance_status === 'LATE').length;
  const recentAbsentCount = recentEvals.filter((e) => e.attendance_status === 'ABSENT').length;

  // 3. 과제 데이터 전수 정밀 분석 및 성취도 수집
  let totalAssignedCount = 0;
  let upcomingUncheckedCount = 0;

  const evaluatedTasks = [];
  const sessionSummaries = []; // 회차별 요약 (추세 분석용)
  const testScores = [];
  const competencyScores = [];
  const conceptAppScores = [];
  const homeworkScores = [];

  sortedAsc.forEach((ev) => {
    const parsed = parseEvaluationRecord(ev);
    const assignedDate = ev.eval_date;

    // 다음 수업 날짜 찾기 (자동 마감 기준일)
    const dateIdx = uniqueDatesAsc.indexOf(assignedDate);
    const nextClassDate =
      dateIdx >= 0 && dateIdx + 1 < uniqueDatesAsc.length ? uniqueDatesAsc[dateIdx + 1] : null;

    // 테스트 점수 수집
    const normScore = parseNormalizedTestScore(parsed.testScore);
    if (normScore !== null) {
      testScores.push(normScore);
    }

    // 6대 역량 점수 수집
    DEFAULT_EVAL_KEYS.forEach((def) => {
      const val = ev[def.dbCol];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        const numVal = Number(val);
        competencyScores.push(numVal);
        if (def.key === 'concept' || def.key === 'app') {
          conceptAppScores.push(numVal);
        }
        if (def.key === 'homework') {
          homeworkScores.push(numVal);
        }
      }
    });

    const books = parsed.homeworkBooks || [];
    if (books.length === 0) return;

    let sessionEvalCount = 0;
    let sessionOnTimeCount = 0;
    let sessionIncompleteOrDelayedCount = 0;

    books.forEach((b) => {
      totalAssignedCount++;
      const status = b.status || '미체크';
      const firstStatus = b.firstStatus || (status !== '미체크' ? status : null);
      const firstCheckedAt = b.firstCheckedAt || null;
      const completedAt = b.completedAt || null;

      // 아직 다음 수업이 도래하지 않은 최신 회차의 '미체크' 과제는 '검사 대기 중'으로 분류하여 모수에서 제외
      const daysSinceAssigned = calcDaysBetween(assignedDate, todayStr);
      const isUpcomingUnchecked =
        status === '미체크' && !nextClassDate && (assignedDate === latestEvalDate || daysSinceAssigned <= 5);

      if (isUpcomingUnchecked) {
        upcomingUncheckedCount++;
        return;
      }

      // 여기부터는 이미 검사가 진행되었거나 다음 수업이 지나 마감이 도래한 평가 대상 과제
      let category = 'INCOMPLETE'; // 'ON_TIME' | 'DELAYED' | 'INCOMPLETE'
      let delayDays = 0;

      if (status === '완료') {
        // 1) 첫 검사 시점에 미완료/일부완료/질문남음이었던 기록이 있는 경우 -> 무조건 지연 완료!
        const hadInitialFailure =
          firstStatus === '미완료' || firstStatus === '일부완료' || firstStatus === '질문남음';

        // 2) 다음 수업일(nextClassDate)이 존재하고, 완료일(completedAt)이 다음 수업일보다 2일 이상 늦은 경우 -> 지연 완료!
        const completedAfterNextClass =
          nextClassDate && completedAt && calcDaysBetween(nextClassDate, completedAt) >= 2;

        // 3) 다음 수업일이 없더라도 부여일로부터 완료일까지 9일 이상 걸린 경우 -> 지연 완료!
        const tookTooLong = !nextClassDate && completedAt && calcDaysBetween(assignedDate, completedAt) >= 9;

        if (hadInitialFailure || completedAfterNextClass || tookTooLong) {
          category = 'DELAYED';
          const baseDue = nextClassDate || firstCheckedAt || assignedDate;
          delayDays = Math.max(1, calcDaysBetween(baseDue, completedAt || todayStr));
        } else {
          category = 'ON_TIME';
        }
      } else {
        category = 'INCOMPLETE';
      }

      // 미완료/지연의 최초 원인 상태 판별
      const rootCauseStatus =
        firstStatus && firstStatus !== '미체크' && firstStatus !== '완료'
          ? firstStatus
          : status !== '완료'
          ? status
          : '미완료';

      const taskRecord = {
        evalId: ev.id,
        assignedDate,
        nextClassDate,
        bookName: b.name,
        range: b.range || '',
        status,
        firstStatus,
        firstCheckedAt,
        completedAt,
        category,
        delayDays,
        rootCauseStatus,
      };

      evaluatedTasks.push(taskRecord);
      sessionEvalCount++;
      if (category === 'ON_TIME') {
        sessionOnTimeCount++;
      } else {
        sessionIncompleteOrDelayedCount++;
      }
    });

    if (sessionEvalCount > 0) {
      sessionSummaries.push({
        evalDate: assignedDate,
        evalCount: sessionEvalCount,
        onTimeCount: sessionOnTimeCount,
        nonOnTimeCount: sessionIncompleteOrDelayedCount,
        onTimeRate: Math.round((sessionOnTimeCount / sessionEvalCount) * 100),
      });
    }
  });

  const evaluatedCount = evaluatedTasks.length;
  const onTimeTasks = evaluatedTasks.filter((t) => t.category === 'ON_TIME');
  const delayedTasks = evaluatedTasks.filter((t) => t.category === 'DELAYED');
  const incompleteTasks = evaluatedTasks.filter((t) => t.category === 'INCOMPLETE');

  const onTimeCount = onTimeTasks.length;
  const delayedCount = delayedTasks.length;
  const incompleteCount = incompleteTasks.length;

  const onTimeRate = evaluatedCount > 0 ? Math.round((onTimeCount / evaluatedCount) * 100) : 100;
  const delayedRate = evaluatedCount > 0 ? Math.round((delayedCount / evaluatedCount) * 100) : 0;
  const incompleteRate = evaluatedCount > 0 ? Math.round((incompleteCount / evaluatedCount) * 100) : 0;
  const finalCompletionRate =
    evaluatedCount > 0 ? Math.round(((onTimeCount + delayedCount) / evaluatedCount) * 100) : 100;

  const avgDelayDays =
    delayedCount > 0
      ? Number((delayedTasks.reduce((acc, t) => acc + t.delayDays, 0) / delayedCount).toFixed(1))
      : 0;

  // 4. 미완료/지연 과제의 질적 원인 분류 (태도 vs 분량 vs 난이도)
  const nonOnTimeTasks = [...delayedTasks, ...incompleteTasks];
  const totalNonOnTime = nonOnTimeTasks.length;

  let notStartedCount = 0; // '미완료' 또는 기한 지난 '미체크' (태도/미착수)
  let partialCount = 0; // '일부완료' (분량 부담/시간 부족)
  let questionCount = 0; // '질문남음' (난이도/개념 막힘)

  nonOnTimeTasks.forEach((t) => {
    if (t.rootCauseStatus === '일부완료') {
      partialCount++;
    } else if (t.rootCauseStatus === '질문남음') {
      questionCount++;
    } else {
      notStartedCount++;
    }
  });

  const notStartedPct = totalNonOnTime > 0 ? Math.round((notStartedCount / totalNonOnTime) * 100) : 0;
  const partialPct = totalNonOnTime > 0 ? Math.round((partialCount / totalNonOnTime) * 100) : 0;
  const questionPct = totalNonOnTime > 0 ? Math.round((questionCount / totalNonOnTime) * 100) : 0;

  let dominantCause = 'NONE';
  let dominantCauseLabel = '특이 결손 없음';
  if (totalNonOnTime > 0) {
    if (questionCount >= partialCount && questionCount >= notStartedCount && questionCount > 0) {
      dominantCause = 'DIFFICULTY';
      dominantCauseLabel = '난이도 병목 (질문남음 집중)';
    } else if (partialCount >= notStartedCount && partialCount >= questionCount && partialCount > 0) {
      dominantCause = 'VOLUME';
      dominantCauseLabel = '분량/시간 관리 병목 (일부완료 집중)';
    } else {
      dominantCause = 'ATTITUDE';
      dominantCauseLabel = '착수 지연/태도 문제 (미완료 집중)';
    }
  }

  // 5. 최근 추세(Trend) 및 슬럼프 조기 감지
  let recentOnTimeRate = onTimeRate;
  let pastOnTimeRate = onTimeRate;
  let rateDelta = 0;
  let trendDirection = 'STABLE'; // 'UP' | 'DOWN' | 'STABLE'

  if (sessionSummaries.length >= 2) {
    const recentWindowCount = Math.min(2, Math.floor(sessionSummaries.length / 2) || 1);
    const recentSessions = sessionSummaries.slice(-recentWindowCount);
    const pastSessions = sessionSummaries.slice(0, -recentWindowCount);

    const recentEvalSum = recentSessions.reduce((a, s) => a + s.evalCount, 0);
    const recentOnTimeSum = recentSessions.reduce((a, s) => a + s.onTimeCount, 0);
    recentOnTimeRate = recentEvalSum > 0 ? Math.round((recentOnTimeSum / recentEvalSum) * 100) : onTimeRate;

    const pastEvalSum = pastSessions.reduce((a, s) => a + s.evalCount, 0);
    const pastOnTimeSum = pastSessions.reduce((a, s) => a + s.onTimeCount, 0);
    pastOnTimeRate = pastEvalSum > 0 ? Math.round((pastOnTimeSum / pastEvalSum) * 100) : onTimeRate;

    rateDelta = recentOnTimeRate - pastOnTimeRate;
    if (rateDelta <= -20) trendDirection = 'DOWN';
    else if (rateDelta >= 20) trendDirection = 'UP';
  }

  // 최근 연속 미해결/지연 발생 회차 수 계산
  let consecutiveIncompleteSessions = 0;
  for (let i = sessionSummaries.length - 1; i >= 0; i--) {
    if (sessionSummaries[i].onTimeRate < 60) {
      consecutiveIncompleteSessions++;
    } else {
      break;
    }
  }

  // 슬럼프/이탈 위험 조건: 과거 정시율이 양호했으나(65% 이상) 최근 30%p 이상 급락한 경우
  const isSlumpWarning =
    evaluatedCount >= 2 &&
    pastOnTimeRate >= 65 &&
    rateDelta <= -30 &&
    recentOnTimeRate <= 50;

  // 6. 성취도 교차 검증 (가짜 성실함 / 형식적 과제 수행 탐지)
  const avgTestScore =
    testScores.length > 0
      ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
      : null;

  const avgCompetencyScore =
    competencyScores.length > 0
      ? Number((competencyScores.reduce((a, b) => a + b, 0) / competencyScores.length).toFixed(1))
      : null;

  const avgConceptAppScore =
    conceptAppScores.length > 0
      ? Number((conceptAppScores.reduce((a, b) => a + b, 0) / conceptAppScores.length).toFixed(1))
      : null;

  const avgHomeworkScore =
    homeworkScores.length > 0
      ? Number((homeworkScores.reduce((a, b) => a + b, 0) / homeworkScores.length).toFixed(1))
      : null;

  // 보완 ⑥: '숙제 오답 소화도 점검(구 형식적 숙제 의심)' 판정 기준 정교화
  // - 질문남음 비중이 낮으면서(20% 이하) 완료율은 85% 이상인데,
  // - 실전 단원/주간 테스트 평균이 60점 이하이거나, 과제수행 역량(8.0+) 대비 개념/응용 역량(6.0 이하) 괴리가 뚜렷한 경우에만 판정
  const isSuperficialSuspect =
    evaluatedCount >= 3 &&
    finalCompletionRate >= 85 &&
    questionPct <= 20 &&
    ((avgTestScore !== null && avgTestScore <= 60) ||
      (avgConceptAppScore !== null &&
        avgConceptAppScore <= 6.0 &&
        (avgHomeworkScore === null || avgHomeworkScore >= 8.0)));

  // 7. 종합 상태 등급(Persona Grade) 판정
  let grade = {
    code: 'EXCELLENT_STEADY',
    badgeText: `🟢 정시성실 ${onTimeRate}%`,
    shortLabel: '자기주도 성실형',
    level: 'GOOD',
    colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  };

  if (evaluatedCount === 0) {
    grade = {
      code: 'UPCOMING_ONLY',
      badgeText: '⏳ 첫 검사 대기',
      shortLabel: '검사 대기 중',
      level: 'NEUTRAL',
      colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
    };
  } else if (isSlumpWarning) {
    grade = {
      code: 'SLUMP_WARNING',
      badgeText: '🚨 최근 리듬 급락',
      shortLabel: '슬럼프·집중케어 필요',
      level: 'CRITICAL',
      colorClass: 'bg-rose-600 text-white border-rose-700 shadow-2xs',
    };
  } else if (onTimeRate < 65 && finalCompletionRate >= 70 && delayedCount >= 2) {
    grade = {
      code: 'DELAYED_COMPLETER',
      badgeText: `🟡 지연완료형 (정시 ${onTimeRate}%→최종 ${finalCompletionRate}%)`,
      shortLabel: '만성 지연·수동 완료형',
      level: 'WARNING',
      colorClass: 'bg-amber-100 text-amber-950 border-amber-300',
    };
  } else if (onTimeRate < 75 && (dominantCause === 'VOLUME' || dominantCause === 'DIFFICULTY')) {
    grade = {
      code: 'BOTTLENECK_STRUGGLE',
      badgeText:
        dominantCause === 'DIFFICULTY'
          ? '🟠 난이도 병목 (질문 다발)'
          : '🟠 분량 병목 (일부완료 반복)',
      shortLabel: dominantCause === 'DIFFICULTY' ? '개념·난이도 병목형' : '학습량·시간관리 병목형',
      level: 'WARNING',
      colorClass: 'bg-orange-100 text-orange-950 border-orange-300',
    };
  } else if (finalCompletionRate < 50 || (incompleteCount >= 3 && dominantCause === 'ATTITUDE')) {
    grade = {
      code: 'CHRONIC_INCOMPLETE',
      badgeText: `🔴 미완료 누적 (${incompleteCount}건)`,
      shortLabel: '만성 미완·태도 교정 필요',
      level: 'CRITICAL',
      colorClass: 'bg-rose-100 text-rose-900 border-rose-300',
    };
  } else if (isSuperficialSuspect) {
    grade = {
      code: 'SUPERFICIAL_SUSPECT',
      badgeText: '🔍 숙제 오답 소화도 점검',
      shortLabel: '숙제 소화도·오답 점검형',
      level: 'CAUTION',
      colorClass: 'bg-purple-100 text-purple-900 border-purple-300',
    };
  } else if (onTimeRate >= 80 && incompleteCount === 0) {
    grade = {
      code: 'EXCELLENT_STEADY',
      badgeText: `🟢 정시완벽 (${onTimeRate}%)`,
      shortLabel: '자기주도 모범형',
      level: 'GOOD',
      colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    };
  } else {
    grade = {
      code: 'NORMAL_CARE',
      badgeText: `🔵 정시 ${onTimeRate}% · 미완 ${incompleteCount}건`,
      shortLabel: '보통·잔여과제 관리형',
      level: 'CAUTION',
      colorClass: 'bg-sky-100 text-sky-900 border-sky-300',
    };
  }

  // 8. 영역별 정밀 진단 텍스트 및 액션 플랜 생성
  const timelinessText =
    evaluatedCount === 0
      ? `현재 부여된 과제 ${upcomingUncheckedCount}건이 다음 수업 첫 검사를 기다리고 있습니다.`
      : delayedCount > 0
      ? `검사된 과제 ${evaluatedCount}건 중 제때 해온 정시 완료는 ${onTimeCount}건(${onTimeRate}%)이며, 첫 검사 때 못 해왔다가 뒤늦게 메운 지연 완료가 ${delayedCount}건(평균 +${avgDelayDays}일 소요)입니다. 최종 완료율은 ${finalCompletionRate}%, 현재 남은 미해결 과제는 ${incompleteCount}건입니다.`
      : `검사된 과제 ${evaluatedCount}건 중 정시 완료 ${onTimeCount}건(${onTimeRate}%), 현재 미해결 과제는 ${incompleteCount}건입니다.`;

  const causeText =
    totalNonOnTime === 0
      ? '모든 과제를 첫 검사에 제때 완수하여 미완료 결손 원인이 발견되지 않았습니다.'
      : `제때 완료하지 못한 ${totalNonOnTime}건의 최초 원인을 분석한 결과, [아예 미착수(미완료)] ${notStartedCount}건(${notStartedPct}%), [분량 미달(일부완료)] ${partialCount}건(${partialPct}%), [어려워서 막힘(질문남음)] ${questionCount}건(${questionPct}%)으로 '${dominantCauseLabel}' 경향이 가장 뚜렷합니다.`;

  const attendanceTrendText = (() => {
    const attPart = `총 ${totalClasses}회 수업 중 출석 ${attendCount}회, 지각 ${lateCount}회, 결석 ${absentCount}회(출석률 ${attendanceRate}%)입니다.`;
    if (sessionSummaries.length >= 2) {
      if (trendDirection === 'DOWN') {
        return `${attPart} 특히 최근 정시 과제 이행률이 ${pastOnTimeRate}% ➔ ${recentOnTimeRate}%로 급락(${rateDelta}%p)하여 학습 리듬이 흔들리고 있습니다.`;
      }
      if (trendDirection === 'UP') {
        return `${attPart} 최근 정시 과제 이행률이 ${pastOnTimeRate}% ➔ ${recentOnTimeRate}%로 상승(+${rateDelta}%p)하며 습관이 개선되고 있습니다.`;
      }
    }
    if (recentLateCount + recentAbsentCount >= 2) {
      return `${attPart} 최근 4회 수업 내 지각/결석이 ${recentLateCount + recentAbsentCount}회 발생하여 등원 리듬 관리가 필요합니다.`;
    }
    return `${attPart} 최근 수업 출결 및 과제 수행 흐름이 일정하게 유지되고 있습니다.`;
  })();

  const achievementText = (() => {
    const scoreParts = [];
    if (avgTestScore !== null) scoreParts.push(`테스트 평균 ${avgTestScore}점`);
    if (avgCompetencyScore !== null) scoreParts.push(`역량 평가 평균 ${avgCompetencyScore}/10점`);
    const scoreSummary = scoreParts.length > 0 ? scoreParts.join(', ') : '등록된 테스트 점수 없음';

    if (isSuperficialSuspect) {
      return `${scoreSummary}. 숙제 완료율(${finalCompletionRate}%)은 높으나 실전 테스트 연결이 아쉬워, 풀이 과정 및 오답 소화도 점검이 권장됩니다.`;
    }
    if (finalCompletionRate >= 80 && (avgTestScore === null || avgTestScore >= 80)) {
      return `${scoreSummary}. 성실한 과제 수행이 실제 개념 이해와 양호한 성취도로 잘 연결되고 있습니다.`;
    }
    return `${scoreSummary}. 과제 완수율을 높이면 실전 테스트 성취도도 함께 상승할 여지가 큽니다.`;
  })();

  // 헤드라인 및 추천 지도 액션 & 학부모 상담 멘트 생성
  let headline = '';
  const actionItems = [];
  let parentConsultScript = '';

  switch (grade.code) {
    case 'SLUMP_WARNING':
      headline = `최근 과제 정시 이행률이 급락하거나 출결 흔들림과 함께 미완료(${incompleteCount}건)가 누적되고 있습니다.`;
      actionItems.push('최근 학교 일정(수행평가 등)이나 개인 슬럼프 요인이 있는지 수업 전 1:1 면담으로 먼저 확인해 주세요.');
      actionItems.push('밀린 숙제를 한꺼번에 독촉하기보다, 가장 시급한 1건만 우선 지정해 성취감을 회복시켜 주세요.');
      if (recentLateCount > 0) {
        actionItems.push(`최근 지각(${recentLateCount}회)과 숙제 미완료가 동반되고 있으므로 등원 시간엄수 지도가 필요합니다.`);
      }
      parentConsultScript = `어머님, 평소 성실하던 아이인데 최근 1~2주 사이 과제 정시 이행률이 ${recentOnTimeRate}%로 떨어지고 미완료 과제가 ${incompleteCount}건 누적되는 등 학습 리듬이 다소 지쳐 보입니다. 학원에서도 이번 주 클리닉을 통해 밀린 부분을 우선 정리할 예정이니, 가정에서도 아이 컨디션과 숙제 시작 시간을 한 번 점검해 주시면 감사하겠습니다.`;
      break;

    case 'CHRONIC_INCOMPLETE':
      headline = `과제 최종 완료율이 ${finalCompletionRate}%에 머물러 있으며, 미해결 과제 ${incompleteCount}건이 누적된 상태입니다.`;
      actionItems.push('집에서 책을 펴는 시작 장벽이 높은 상태입니다. 수업 종료 직전 오늘 숙제의 첫 2문제를 학원에서 같이 풀고 귀가시켜 보세요.');
      actionItems.push('주말 또는 주중 의무 클리닉 시간을 고정 배정하여 학원 내에서 과제를 끝내는 비중을 높여야 합니다.');
      parentConsultScript = `어머님, 최근 누적 데이터 분석 결과 부여된 과제 중 첫 검사 시 아예 착수하지 못한 '미완료' 비중이 ${notStartedPct}%로 높고 현재 ${incompleteCount}건이 밀려 있습니다. 실력 문제보다 가정 내 숙제 착수 습관을 잡는 것이 급선무라, 당분간 클리닉을 통해 학원에서 완수하는 훈련을 집중 진행하겠습니다.`;
      break;

    case 'DELAYED_COMPLETER':
      headline = `최종적으로는 ${finalCompletionRate}% 완수하나, 제때 해오는 정시 이행률은 ${onTimeRate}%로 '지연 완료' 패턴이 고착화되어 있습니다.`;
      actionItems.push(`첫 검사 때 미완료 후 평균 +${avgDelayDays}일 뒤에 끝내는 수동적 패턴입니다. '다음 수업 당일 통과'를 목표로 작은 보상을 걸어주세요.`);
      actionItems.push('숙제를 수업 전날 밤에 몰아서 하지 않도록 요일별 분할 분량을 교재 상단에 적어주세요.');
      parentConsultScript = `어머님, 아이가 부여된 숙제를 포기하지 않고 끝까지 마무리하는 최종 완료율은 ${finalCompletionRate}%로 우수합니다. 다만 첫 검사 때 제때 해오는 정시 완료율은 ${onTimeRate}%로, 절반 이상을 한 박자 늦게 메우느라 진도 흡수 효율이 떨어지고 있습니다. 수업 전날이 아닌 수업 다음 날 바로 숙제를 시작하도록 가정에서도 독려 부탁드립니다.`;
      break;

    case 'BOTTLENECK_STRUGGLE':
      headline =
        dominantCause === 'DIFFICULTY'
          ? `숙제를 풀려고 시도하나 모르는 문제에 막혀 [질문남음](${questionPct}%)으로 중단되는 난이도 병목 상태입니다.`
          : `숙제를 시작은 하지만 끝까지 채우지 못하는 [일부완료](${partialPct}%) 패턴이 반복되는 분량 병목 상태입니다.`;
      if (dominantCause === 'DIFFICULTY') {
        actionItems.push('태도 불량이 아니라 혼자 풀기 어려운 문항에서 막히는 상태입니다. 혼내기보다 질문 문항 힌트 노트를 먼저 제공해 주세요.');
        actionItems.push('유형/심화 문제 풀이 전 대표 예제 풀이 과정을 한 번 더 점검하고 클리닉 질의응답 시간을 확보해 주세요.');
      } else {
        actionItems.push('아이의 풀이 속도 대비 1회 숙제 분량이 다소 버거울 수 있습니다. 문항 수를 15~20% 조절하는 대신 100% 완수 경험을 먼저 심어주세요.');
      }
      parentConsultScript =
        dominantCause === 'DIFFICULTY'
          ? `어머님, 아이가 숙제를 안 하려는 것이 아니라 스스로 풀어보려 노력하다가 고난도 문항에서 막혀 '질문남음' 상태로 오는 비중이 ${questionPct}%입니다. 학습 의지는 좋은 상태이므로, 학원 클리닉에서 막히는 유형을 1:1로 집중 뚫어주어 자신감을 높여주겠습니다.`
          : `어머님, 아이가 매번 숙제를 시작은 하지만 끝까지 다 채우지 못하는 '일부완료' 비중이 ${partialPct}%로 나타납니다. 한 번에 집중해서 끝내는 지구력을 기르기 위해 일일 목표 분량을 세분화하여 100% 완수하는 습관부터 잡아나가겠습니다.`;
      break;

    case 'SUPERFICIAL_SUSPECT':
      headline = `숙제 완료율(${finalCompletionRate}%)은 매우 높으나, 실전 테스트·역량 성취도로의 연결이 아쉬워 '숙제 오답 소화도' 점검이 필요합니다.`;
      actionItems.push('숙제 검사 시 맞은 문항 중 핵심 유형 2~3문항의 풀이 식 전개 과정을 구두로 질문해 소화도를 확인해 보세요.');
      actionItems.push('틀렸던 문항을 스스로 다시 풀 수 있는지 백지 오답 테스트 및 쌍둥이 유사문항 확인을 병행해 주세요.');
      parentConsultScript = `어머님, 아이가 매 수업 숙제는 ${finalCompletionRate}%로 빠짐없이 성실하게 해오고 있습니다. 다만 숙제 이행도에 비해 단원 테스트 성취도가 다소 아쉽게 나타나고 있어, 문제를 풀 때 핵심 개념과 오답을 자기 것으로 완전히 소화하고 있는지 풀이 과정과 오답 복습을 학원에서 한층 꼼꼼히 점검하겠습니다.`;
      break;

    case 'EXCELLENT_STEADY':
      headline = `정시 과제 이행률 ${onTimeRate}%, 출석률 ${attendanceRate}%로 자기주도 학습 습관이 매우 안정적으로 잡혀 있습니다.`;
      actionItems.push('꾸준히 제때 숙제를 해오는 성실함을 구체적인 수치로 크게 칭찬해 학업 효능감을 높여주세요.');
      actionItems.push('현재 분량을 여유 있게 소화하고 있으므로 고난도 심화 문항 도전이나 선행 진도 가속을 고려해 볼 수 있습니다.');
      parentConsultScript = `어머님, 최근 누적 학습 데이터 분석 결과 정시 과제 이행률 ${onTimeRate}%, 최종 완료율 ${finalCompletionRate}%로 약속된 기한 내에 스스로 과제를 완벽히 소화하는 최상위 학습 습관을 보여주고 있습니다. 가정에서도 아낌없는 칭찬 부탁드립니다!`;
      break;

    default:
      headline = `정시 과제 이행률 ${onTimeRate}%, 최종 완료율 ${finalCompletionRate}%이며 현재 남은 미완료 과제는 ${incompleteCount}건입니다.`;
      actionItems.push(`남아있는 미완료 과제 ${incompleteCount}건을 다음 수업 전까지 마무리하도록 안내해 주세요.`);
      parentConsultScript = `어머님, 현재 과제 최종 완료율은 ${finalCompletionRate}%이며 미완료 잔여 과제 ${incompleteCount}건에 대해 이번 주 내 보완 지도를 진행하고 있습니다.`;
      break;
  }

  return {
    hasData: true,
    periodScope,
    periodLabel,
    totalCumulativeClasses,
    grade,
    headline,
    attendance: {
      totalClasses,
      attendCount,
      lateCount,
      absentCount,
      attendanceRate,
      onTimeAttendanceRate,
      recentLateCount,
      recentAbsentCount,
    },
    homework: {
      totalAssignedCount,
      upcomingUncheckedCount,
      evaluatedCount,
      onTimeCount,
      delayedCount,
      incompleteCount,
      onTimeRate,
      delayedRate,
      incompleteRate,
      finalCompletionRate,
      avgDelayDays,
    },
    causes: {
      totalNonOnTime,
      notStartedCount,
      partialCount,
      questionCount,
      notStartedPct,
      partialPct,
      questionPct,
      dominantCause,
      dominantCauseLabel,
    },
    trend: {
      recentOnTimeRate,
      pastOnTimeRate,
      rateDelta,
      consecutiveIncompleteSessions,
      isSlumpWarning,
      trendDirection,
    },
    achievement: {
      avgTestScore,
      avgCompetencyScore,
      avgConceptAppScore,
      avgHomeworkScore,
      isSuperficialSuspect,
    },
    details: {
      timelinessText,
      causeText,
      attendanceTrendText,
      achievementText,
    },
    actionItems,
    parentConsultScript,
  };
}

const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 📅 최근 3주간 출결 & 지각 현황 분석 헬퍼
 * 학생 메인 화면 및 학부모 피드백 리포트에 공통 적용
 *
 * @param {Array} evaluations - 학생의 전체 평가 목록 (daily_evaluations)
 * @param {string} baseDateStr - 기준일 (기본: 오늘 KST 날짜)
 */
export function getRecentAttendanceStats(evaluations = [], baseDateStr = getTodayKstDateString()) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return {
      hasData: false,
      totalSessions: 0,
      attendCount: 0,
      lateCount: 0,
      absentCount: 0,
      onTimeRate: 100,
      statusLevel: 'PERFECT',
      periodLabel: '',
      studentMessage: '아직 등록된 출결 기록이 없습니다.',
      parentMessage: '아직 등록된 출결 기록이 없습니다.',
      records: [],
    };
  }

  // 1. 유효한 eval_date가 있는 레코드만 필터링
  const validEvals = evaluations.filter((e) => e && e.eval_date && e.eval_date <= baseDateStr);
  if (validEvals.length === 0) {
    return {
      hasData: false,
      totalSessions: 0,
      attendCount: 0,
      lateCount: 0,
      absentCount: 0,
      onTimeRate: 100,
      statusLevel: 'PERFECT',
      periodLabel: '',
      studentMessage: '최근 등록된 출결 기록이 없습니다.',
      parentMessage: '최근 등록된 출결 기록이 없습니다.',
      records: [],
    };
  }

  // 날짜별로 그룹화 (동일 날짜 복수 입력 시 LATE > ABSENT > ATTEND 우선 반영)
  const dateMap = {};
  for (const ev of validEvals) {
    const d = ev.eval_date;
    const currentStatus = ev.attendance_status || 'ATTEND';
    const currentLateMins = currentStatus === 'LATE' ? (parseInt(ev.lateness_minutes, 10) || 5) : 0;

    if (!dateMap[d]) {
      dateMap[d] = {
        id: ev.id,
        date: d,
        status: currentStatus,
        latenessMinutes: currentLateMins,
      };
    } else {
      if (currentStatus === 'LATE') {
        dateMap[d].status = 'LATE';
        dateMap[d].latenessMinutes = Math.max(dateMap[d].latenessMinutes || 0, currentLateMins);
      } else if (currentStatus === 'ABSENT' && dateMap[d].status !== 'LATE') {
        dateMap[d].status = 'ABSENT';
      }
    }
  }

  // 날짜 오름차순 정렬
  const allSortedDates = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  // 2. 기준일로부터 21일 전(3주) 계산
  const baseTime = new Date(baseDateStr + 'T00:00:00').getTime();
  const threeWeeksAgoTime = baseTime - 21 * 24 * 60 * 60 * 1000;
  const threeWeeksAgoDate = new Date(threeWeeksAgoTime);
  const cutoffDateStr = threeWeeksAgoDate.toISOString().split('T')[0];

  // 최근 21일 이내 수업 필터
  let selectedRecords = allSortedDates.filter((r) => r.date >= cutoffDateStr && r.date <= baseDateStr);

  // 만약 21일 이내 수업이 3회 미만인데 과거 수업 이력이 더 있다면, 최소 최근 6회(약 3주치 수업 분량)까지 확장하여 제공
  if (selectedRecords.length < 3 && allSortedDates.length >= 3) {
    selectedRecords = allSortedDates.slice(-6);
  } else if (selectedRecords.length > 9) {
    // 3주 기준 최대 9회(주 3회 수업) 초과 시 최근 9회로 제한
    selectedRecords = selectedRecords.slice(-9);
  }

  if (selectedRecords.length === 0) {
    return {
      hasData: false,
      totalSessions: 0,
      attendCount: 0,
      lateCount: 0,
      absentCount: 0,
      onTimeRate: 100,
      statusLevel: 'PERFECT',
      periodLabel: '',
      studentMessage: '최근 출결 기록이 없습니다.',
      parentMessage: '최근 출결 기록이 없습니다.',
      records: [],
    };
  }

  // 3. 통계 집계
  let attendCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  const records = selectedRecords.map((r) => {
    const dObj = new Date(r.date + 'T00:00:00');
    const dayOfWeek = KOREAN_DAY_NAMES[dObj.getDay()] || '';
    const dateShort = r.date.slice(5).replace('-', '/');

    let statusLabel = '정상';
    let dotColor = 'bg-emerald-500';
    let textColor = 'text-emerald-700';
    let badgeBg = 'bg-emerald-50 border-emerald-200';

    if (r.status === 'LATE') {
      lateCount += 1;
      const minsText = r.latenessMinutes >= 30 ? '30분+ 지각' : `${r.latenessMinutes || 5}분 지각`;
      statusLabel = minsText;
      dotColor = 'bg-amber-500';
      textColor = 'text-amber-800';
      badgeBg = 'bg-amber-50 border-amber-300';
    } else if (r.status === 'ABSENT') {
      absentCount += 1;
      statusLabel = '결석';
      dotColor = 'bg-rose-500';
      textColor = 'text-rose-700';
      badgeBg = 'bg-rose-50 border-rose-300';
    } else {
      attendCount += 1;
    }

    return {
      id: r.id,
      date: r.date,
      dateShort,
      dayOfWeek,
      status: r.status,
      statusLabel,
      latenessMinutes: r.latenessMinutes,
      dotColor,
      textColor,
      badgeBg,
    };
  });

  const totalSessions = records.length;
  const onTimeRate = totalSessions > 0 ? Math.round((attendCount / totalSessions) * 100) : 100;

  let statusLevel = 'PERFECT';
  if (lateCount >= 2 || absentCount >= 1) {
    statusLevel = 'WARNING';
  } else if (lateCount === 1) {
    statusLevel = 'CAUTION';
  }

  const startDate = records[0].date.slice(5).replace('-', '.');
  const endDate = records[records.length - 1].date.slice(5).replace('-', '.');
  const periodLabel = `${startDate} ~ ${endDate} (총 ${totalSessions}회)`;

  let studentMessage = '';
  let parentMessage = '';

  if (statusLevel === 'PERFECT') {
    studentMessage = '🔥 최근 3주간 연속 정시 출석 달성 중! (부모님 피드백 리포트에 모범 출결로 안내되고 있습니다)';
    parentMessage = '✨ 최근 3주간 지각이나 결석 없이 성실하게 정시 출석하고 있습니다.';
  } else if (statusLevel === 'CAUTION') {
    studentMessage = '⚠️ 최근 3주간 지각 1회가 기록되어 있습니다. 부모님 피드백 리포트에도 함께 공유되고 있으니 다음 수업은 꼭 정시 착석해 주세요!';
    parentMessage = '💡 최근 3주간 1회의 지각이 발생했습니다. 수업 시작 전 원활한 학습 집중을 위해 가정에서도 정시 등원을 격려해 주시면 감사하겠습니다.';
  } else {
    studentMessage = `🚨 최근 3주간 지각 ${lateCount}회 발생! 부모님 피드백 리포트에 출결 현황이 공유되고 있습니다. 수업 시작 5분 전 착석을 목표로 해보세요!`;
    parentMessage = `⚠️ 최근 3주간 지각이 ${lateCount}회 발생했습니다. 학원에서도 수업 시작 전 착석을 집중 지도하고 있으니 가정에서도 많은 관심과 지도 부탁드립니다.`;
  }

  return {
    hasData: true,
    totalSessions,
    attendCount,
    lateCount,
    absentCount,
    onTimeRate,
    statusLevel,
    periodLabel,
    studentMessage,
    parentMessage,
    records,
  };
}
