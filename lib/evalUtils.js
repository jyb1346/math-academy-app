/**
 * 주간 테스트 점수 및 피드백 코멘트 파싱 / 포맷팅 유틸리티
 */

export function formatTeacherCommentWithWeeklyScore(comment, weeklyScore) {
  const cleanComment = (comment || '').replace(/^\[WEEKLY_TEST:[^\]]*\]\n?/, '').trim();
  const trimmedScore = (weeklyScore || '').trim();

  if (!trimmedScore) {
    return cleanComment;
  }

  return `[WEEKLY_TEST:${trimmedScore}]\n${cleanComment}`;
}

export function parseTeacherCommentAndWeeklyScore(rawComment, dbWeeklyScore = null) {
  if (dbWeeklyScore && String(dbWeeklyScore).trim()) {
    const cleanComment = (rawComment || '').replace(/^\[WEEKLY_TEST:[^\]]*\]\n?/, '').trim();
    return {
      weeklyScore: String(dbWeeklyScore).trim(),
      comment: cleanComment,
    };
  }

  if (!rawComment) {
    return {
      weeklyScore: null,
      comment: '',
    };
  }

  const match = rawComment.match(/^\[WEEKLY_TEST:([^\]]+)\]\n?([\s\S]*)$/);
  if (match) {
    return {
      weeklyScore: match[1].trim(),
      comment: match[2].trim(),
    };
  }

  return {
    weeklyScore: null,
    comment: rawComment.trim(),
  };
}
