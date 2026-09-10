/**
 * 📝 시험 종류(단원평가, 일일테스트, 주간테스트, 모의고사, 기타) 및 점수 파싱 / 포맷팅 유틸리티
 */

// 1. 코멘트에 시험 종류와 점수 메타데이터 포맷팅
export function formatTeacherCommentWithTestScore(comment, testScore, testType = '단원평가') {
  const cleanComment = (comment || '')
    .replace(/^\[TEST_SCORE:[^\]]*\]\n?/, '')
    .replace(/^\[WEEKLY_TEST:[^\]]*\]\n?/, '')
    .trim();

  const trimmedScore = (testScore || '').trim();
  const trimmedType = (testType || '단원평가').trim();

  if (!trimmedScore) {
    return cleanComment;
  }

  return `[TEST_SCORE:${trimmedType}|${trimmedScore}]\n${cleanComment}`;
}

// 2. 코멘트에서 시험 종류 및 점수 파싱
export function parseTeacherCommentAndTestScore(rawComment, dbWeeklyScore = null) {
  const defaultRes = {
    testType: '단원평가',
    testScore: null,
    weeklyScore: null, // 하위 호환성 유지
    comment: '',
  };

  if (!rawComment && !dbWeeklyScore) {
    return defaultRes;
  }

  // 1) 신규 형식: [TEST_SCORE:타입|점수]
  if (rawComment) {
    const testMatch = rawComment.match(/^\[TEST_SCORE:([^|\]]+)\|([^\]]+)\]\n?([\s\S]*)$/);
    if (testMatch) {
      const type = testMatch[1].trim();
      const score = testMatch[2].trim();
      const cleanComment = testMatch[3].trim();
      return {
        testType: type || '단원평가',
        testScore: score,
        weeklyScore: score,
        comment: cleanComment,
      };
    }

    // 2) 이전 형식 하위 호환: [WEEKLY_TEST:점수]
    const legacyMatch = rawComment.match(/^\[WEEKLY_TEST:([^\]]+)\]\n?([\s\S]*)$/);
    if (legacyMatch) {
      const score = legacyMatch[1].trim();
      const cleanComment = legacyMatch[2].trim();
      return {
        testType: '주간테스트',
        testScore: score,
        weeklyScore: score,
        comment: cleanComment,
      };
    }
  }

  // 3) DB 컬럼에 weekly_test_score가 있는 경우 (하위 호환)
  if (dbWeeklyScore && String(dbWeeklyScore).trim()) {
    const cleanComment = (rawComment || '')
      .replace(/^\[TEST_SCORE:[^\]]*\]\n?/, '')
      .replace(/^\[WEEKLY_TEST:[^\]]*\]\n?/, '')
      .trim();

    return {
      testType: '주간테스트',
      testScore: String(dbWeeklyScore).trim(),
      weeklyScore: String(dbWeeklyScore).trim(),
      comment: cleanComment,
    };
  }

  return {
    testType: '단원평가',
    testScore: null,
    weeklyScore: null,
    comment: (rawComment || '').trim(),
  };
}

// 기존 함수명 호환용 래퍼
export function formatTeacherCommentWithWeeklyScore(comment, weeklyScore) {
  return formatTeacherCommentWithTestScore(comment, weeklyScore, '주간테스트');
}

export function parseTeacherCommentAndWeeklyScore(rawComment, dbWeeklyScore = null) {
  return parseTeacherCommentAndTestScore(rawComment, dbWeeklyScore);
}
