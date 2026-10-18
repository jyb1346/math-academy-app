/**
 * 📈 고등학교 수학 내신 & 모의고사 성적 추이 및 오답 체질 분석 유틸리티
 */

// 시험 구분 상수
export const EXAM_CATEGORIES = [
  { id: 'INTERNAL', label: '학교 내신 (정기고사)', shortLabel: '내신' },
  { id: 'MOCK', label: '전국 모의고사 / 학력평가', shortLabel: '모의고사' },
];

// 내신 세부 시험 시기 (중간/기말 + 학기 합산 최종 등급 지원)
export const INTERNAL_EXAM_PERIODS = [
  { id: '1_MID', label: '1학기 중간고사', shortLabel: '1-1 중간', order: 2 },
  { id: '1_FINAL', label: '1학기 기말고사', shortLabel: '1-1 기말', order: 4 },
  {
    id: '1_SEMESTER',
    label: '1학기 최종 (중간+기말 합산)',
    shortLabel: '1학기 최종',
    order: 4.5,
    isSemesterTotal: true,
  },
  { id: '2_MID', label: '2학기 중간고사', shortLabel: '2-2 중간', order: 7 },
  { id: '2_FINAL', label: '2학기 기말고사', shortLabel: '2-2 기말', order: 9 },
  {
    id: '2_SEMESTER',
    label: '2학기 최종 (중간+기말 합산)',
    shortLabel: '2학기 최종',
    order: 9.5,
    isSemesterTotal: true,
  },
];

// 모의고사 세부 시행월
export const MOCK_EXAM_PERIODS = [
  { id: 'MOCK_03', label: '3월 학력평가', shortLabel: '3월 모평', order: 1 },
  { id: 'MOCK_04', label: '4월 학력평가', shortLabel: '4월 학평', order: 2.5 },
  { id: 'MOCK_06', label: '6월 모의평가/학평', shortLabel: '6월 모평', order: 3 },
  { id: 'MOCK_07', label: '7월 학력평가', shortLabel: '7월 학평', order: 5 },
  { id: 'MOCK_09', label: '9월 모의평가/학평', shortLabel: '9월 모평', order: 6 },
  { id: 'MOCK_10', label: '10월 학력평가', shortLabel: '10월 학평', order: 8 },
  { id: 'MOCK_11', label: '11월 학평 / 수능', shortLabel: '11월/수능', order: 10 },
];

// 고등 수학 과목 목록 (2022 개정 + 2015 개정 모두 호환)
export const MATH_SUBJECTS = [
  '공통수학1',
  '공통수학2',
  '수학(상)',
  '수학(하)',
  '대수 (수학Ⅰ)',
  '미적분Ⅰ (수학Ⅱ)',
  '확률과 통계',
  '미적분 (미적분Ⅱ)',
  '기하',
  '인공지능 수학',
  '경제 수학',
  '모의고사 (공통)',
  '모의고사 (확통)',
  '모의고사 (미적분)',
  '모의고사 (기하)',
];

// 학년 목록
export const HIGH_SCHOOL_GRADES = [
  { id: 1, label: '고1' },
  { id: 2, label: '고2' },
  { id: 3, label: '고3' },
];

/**
 * 🎯 7대 오답 패인(감점 요인) 분류
 * - recoverable: true 인 항목은 '풀이 습관·실전 운영 감점'으로 분류
 * - recoverable: false 인 항목은 '개념·유형·심화 감점'으로 분류
 */
export const ERROR_REASON_CATEGORIES = [
  {
    key: 'mistake_calc',
    label: '계산·부호 실수',
    shortLabel: '계산·부호 실수',
    description: '풀이 식은 맞았으나 사칙연산, 부호, 옮겨 적기 등에서 실수한 감점',
    recoverable: true,
    groupLabel: '풀이 습관·실전 운영 감점',
    color: 'rose',
  },
  {
    key: 'mistake_cond',
    label: '문제 조건 누락',
    shortLabel: '문제 조건 누락',
    description: '정수/자연수 조건, 정의역 범위, 구하는 값 등을 놓쳐서 틀린 감점',
    recoverable: true,
    groupLabel: '풀이 습관·실전 운영 감점',
    color: 'amber',
  },
  {
    key: 'mistake_essay',
    label: '서술형 감점',
    shortLabel: '서술형 감점',
    description: '정답은 맞았거나 풀이 방향은 맞았으나 서술형 답안 작성 과정에서 감점된 점수',
    recoverable: true,
    groupLabel: '풀이 습관·실전 운영 감점',
    color: 'orange',
  },
  {
    key: 'mistake_time',
    label: '시간 배분 실패 (풀이 가능 문항)',
    shortLabel: '시간 배분 실패',
    description: '충분히 맞힐 수 있는 실력이었으나 앞 번호 시간 소모로 인해 손대지 못한 문항 감점',
    recoverable: true,
    groupLabel: '풀이 습관·실전 운영 감점',
    color: 'yellow',
  },
  {
    key: 'skill_concept',
    label: '기본 개념·공식 미숙',
    shortLabel: '기본 개념·공식 미숙',
    description: '기본 정의나 공식이 정확히 기억나지 않아 접근하지 못한 감점',
    recoverable: false,
    groupLabel: '개념·유형·심화 감점',
    color: 'indigo',
  },
  {
    key: 'skill_approach',
    label: '기본 유형 접근법 막힘',
    shortLabel: '기본 유형 접근법 막힘',
    description: '개념은 알지만 필수 유형 문제에서 어떤 식을 세워야 할지 발상을 못한 감점',
    recoverable: false,
    groupLabel: '개념·유형·심화 감점',
    color: 'blue',
  },
  {
    key: 'skill_killer',
    label: '최고난도 문제 한계',
    shortLabel: '최고난도 문제 한계',
    description: '1~2등급 변별용 최고난도 심화 추론 문항에서의 감점',
    recoverable: false,
    groupLabel: '개념·유형·심화 감점',
    color: 'purple',
  },
];

// 9등급제 누적 백분율 커트라인 (%)
export const GRADE_9_CUTOFFS = [
  { grade: 1, maxPct: 4.0, minPct: 0.0 },
  { grade: 2, maxPct: 11.0, minPct: 4.0 },
  { grade: 3, maxPct: 23.0, minPct: 11.0 },
  { grade: 4, maxPct: 40.0, minPct: 23.0 },
  { grade: 5, maxPct: 60.0, minPct: 40.0 },
  { grade: 6, maxPct: 77.0, minPct: 60.0 },
  { grade: 7, maxPct: 89.0, minPct: 77.0 },
  { grade: 8, maxPct: 96.0, minPct: 89.0 },
  { grade: 9, maxPct: 100.0, minPct: 96.0 },
];

// 5등급제 (2022 개정 고교학점제 내신) 누적 백분율 커트라인 (%)
export const GRADE_5_CUTOFFS = [
  { grade: 1, maxPct: 10.0, minPct: 0.0 },
  { grade: 2, maxPct: 34.0, minPct: 10.0 },
  { grade: 3, maxPct: 66.0, minPct: 34.0 },
  { grade: 4, maxPct: 90.0, minPct: 66.0 },
  { grade: 5, maxPct: 100.0, minPct: 90.0 },
];

/**
 * 표준정규분포 Z-점수 계산
 * Z = (원점수 - 평균) / 표준편차
 */
export function calculateZScore(rawScore, mean, stdDev) {
  if (rawScore === '' || rawScore === null || rawScore === undefined) return null;
  if (mean === '' || mean === null || mean === undefined) return null;
  if (stdDev === '' || stdDev === null || stdDev === undefined) return null;
  const s = Number(rawScore);
  const m = Number(mean);
  const sd = Number(stdDev);
  if (isNaN(s) || isNaN(m) || isNaN(sd) || sd <= 0) return null;
  return Number(((s - m) / sd).toFixed(2));
}

/**
 * 표준정규분포 Z-점수를 상위 누적 백분율(Top %)로 변환
 * (Abramowitz & Stegun 근사식 사용, 오차 < 7.5e-8)
 * 예: Z = +2.0 -> 상위 2.28%, Z = 0 -> 상위 50.0%
 */
export function zScoreToTopPercent(z) {
  if (z === null || z === undefined || isNaN(Number(z))) return null;
  const x = Number(z);
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-absX * absX);

  const erf = sign * y;
  const cdf = 0.5 * (1.0 + erf); // 하위 누적 확률
  const topPercent = (1.0 - cdf) * 100; // 상위 누적 백분율(%)
  return Number(Math.max(0.01, Math.min(99.99, topPercent)).toFixed(2));
}

/**
 * 상위 누적 백분율(Top %)로 예상 등급 계산
 */
export function topPercentToGrade(topPct, gradeSystem = 9) {
  if (topPct === null || topPct === undefined || isNaN(Number(topPct))) return null;
  const pct = Number(topPct);
  const cutoffs = Number(gradeSystem) === 5 ? GRADE_5_CUTOFFS : GRADE_9_CUTOFFS;
  for (const c of cutoffs) {
    if (pct <= c.maxPct) return c.grade;
  }
  return cutoffs[cutoffs.length - 1].grade;
}

/**
 * 🎯 등수(석차)/전교생수 또는 백분위/Z점수를 기반으로 등급(Grade) 자동 산출
 * + 동점자(중간석차) 예외 또는 등수 미발표 시 선생님의 수동/예상 등급(manual_grade) 보정 지원
 */
export function calculateAutoGrade(examInput, gradeSystem = 9) {
  if (!examInput) return { grade: null, autoGrade: null, topPct: null, source: null, isManualOverride: false };

  const isMock = examInput.exam_category === 'MOCK';
  const sys = isMock ? 9 : Number(gradeSystem) === 5 ? 5 : 9;
  const cutoffs = sys === 5 ? GRADE_5_CUTOFFS : GRADE_9_CUTOFFS;

  const rank =
    examInput.rank !== '' && examInput.rank !== null && examInput.rank !== undefined
      ? Number(examInput.rank)
      : null;
  const totalStudents =
    examInput.total_students !== '' &&
    examInput.total_students !== null &&
    examInput.total_students !== undefined
      ? Number(examInput.total_students)
      : null;

  let autoGrade = null;
  let topPct = null;
  let maxRankForGrade = null;
  let autoSource = null;

  // 1) 내신: 등수(rank)와 전교생수(total_students)가 입력된 경우 즉시 등급 자동 계산
  if (!isMock && rank !== null && totalStudents !== null && rank > 0 && totalStudents > 0 && rank <= totalStudents) {
    topPct = Number(((rank / totalStudents) * 100).toFixed(2));
    for (const c of cutoffs) {
      const cutRank = Math.round((totalStudents * c.maxPct) / 100);
      if (rank <= cutRank || topPct <= c.maxPct) {
        autoGrade = c.grade;
        maxRankForGrade = cutRank;
        autoSource = 'RANK';
        break;
      }
    }
    if (!autoGrade) {
      autoGrade = cutoffs[cutoffs.length - 1].grade;
      autoSource = 'RANK';
    }
  }

  // 2) 모의고사: 백분위(percentile)가 입력된 경우 자동 등급 계산
  const percentile =
    examInput.percentile !== '' && examInput.percentile !== null && examInput.percentile !== undefined
      ? Number(examInput.percentile)
      : null;
  if (autoGrade === null && isMock && percentile !== null && !isNaN(percentile) && percentile > 0 && percentile <= 100) {
    topPct = Number(Math.max(0.1, 100 - percentile).toFixed(2));
    autoGrade = topPercentToGrade(topPct, 9);
    autoSource = 'PERCENTILE';
  }

  // 3) 내신에서 등수는 아직 없지만 원점수 + 평균 + 표준편차가 모두 입력된 경우 Z점수 기반 예상 등급 산출
  if (autoGrade === null) {
    const z = calculateZScore(examInput.raw_score, examInput.school_mean, examInput.school_std_dev);
    if (z !== null) {
      topPct = zScoreToTopPercent(z);
      autoGrade = topPercentToGrade(topPct, sys);
      autoSource = 'Z_SCORE';
    }
  }

  // 4) 선생님 수동/예상 등급 보정값(manual_grade)이 명시적으로 설정된 경우 우선 적용
  //    (동점자 중간석차로 인해 자동 등급과 실제 성적표 등급이 다르거나, 등수 발표 전 가채점 예상 등급을 지정한 경우)
  const manualGrade =
    examInput.manual_grade !== '' &&
    examInput.manual_grade !== null &&
    examInput.manual_grade !== undefined
      ? Number(examInput.manual_grade)
      : null;

  if (manualGrade !== null && !isNaN(manualGrade) && manualGrade >= 1 && manualGrade <= 9) {
    return {
      grade: manualGrade,
      autoGrade,
      topPct,
      maxRankForGrade,
      source: autoGrade && autoGrade !== manualGrade ? 'MANUAL_OVERRIDE' : 'MANUAL_ESTIMATE',
      isManualOverride: true,
    };
  }

  if (autoGrade !== null) {
    return {
      grade: autoGrade,
      autoGrade,
      topPct,
      maxRankForGrade,
      source: autoSource,
      isManualOverride: false,
    };
  }

  // 5) 기존에 저장된 등급이 있는 경우 fallback
  const fallbackGrade =
    examInput.grade !== '' && examInput.grade !== null && examInput.grade !== undefined
      ? Number(examInput.grade)
      : null;

  return {
    grade: fallbackGrade,
    autoGrade: null,
    topPct: null,
    maxRankForGrade: null,
    source: fallbackGrade ? 'MANUAL' : null,
    isManualOverride: false,
  };
}

/**
 * 🎯 잠재 실력 점수(실수 보정 점수) 및 잠재 등급 분석
 */
export function analyzePotentialPerformance(examRecord, gradeSystem = 9) {
  if (
    examRecord?.raw_score === '' ||
    examRecord?.raw_score === null ||
    examRecord?.raw_score === undefined
  ) {
    return null;
  }
  const rawScore = Number(examRecord.raw_score);
  if (isNaN(rawScore)) return null;

  const breakdown = examRecord?.error_breakdown || {};
  const mistakeCalc = Number(breakdown.mistake_calc) || 0;
  const mistakeCond = Number(breakdown.mistake_cond) || 0;
  const mistakeEssay = Number(breakdown.mistake_essay) || 0;
  const mistakeTime = Number(breakdown.mistake_time) || 0;

  const skillConcept = Number(breakdown.skill_concept) || 0;
  const skillApproach = Number(breakdown.skill_approach) || 0;
  const skillKiller = Number(breakdown.skill_killer) || 0;

  // 풀이 습관·실전 운영 감점 합계
  const recoverableLost = Number(
    (mistakeCalc + mistakeCond + mistakeEssay + mistakeTime).toFixed(1)
  );
  // 개념·유형·심화 감점 합계
  const skillLost = Number((skillConcept + skillApproach + skillKiller).toFixed(1));
  const totalRecordedLost = Number((recoverableLost + skillLost).toFixed(1));

  // 실제 100점 만점 대비 총 감점 및 미분류 감점
  const totalActualLost = Number(Math.max(0, 100 - rawScore).toFixed(1));
  const unclassifiedLost = Number((totalActualLost - totalRecordedLost).toFixed(1));

  // 잠재 실력 점수 (최대 100점)
  const potentialScore = Number(Math.min(100, rawScore + recoverableLost).toFixed(1));

  // 평균·표준편차가 있으면 잠재 Z점수 및 잠재 등급 시뮬레이션
  const potentialZ = calculateZScore(
    potentialScore,
    examRecord?.school_mean,
    examRecord?.school_std_dev
  );
  let potentialTopPct = null;
  let potentialGrade = examRecord?.grade ? Number(examRecord.grade) : null;

  if (potentialZ !== null) {
    potentialTopPct = zScoreToTopPercent(potentialZ);
    const estGrade = topPercentToGrade(
      potentialTopPct,
      examRecord?.exam_category === 'MOCK' ? 9 : gradeSystem
    );
    if (estGrade !== null) {
      potentialGrade = examRecord?.grade
        ? Math.min(Number(examRecord.grade), estGrade)
        : estGrade;
    }
  }

  return {
    rawScore,
    potentialScore,
    recoverableLost,
    skillLost,
    totalRecordedLost,
    totalActualLost,
    unclassifiedLost,
    potentialZ,
    potentialTopPct,
    potentialGrade,
    breakdown: {
      mistake_calc: mistakeCalc,
      mistake_cond: mistakeCond,
      mistake_essay: mistakeEssay,
      mistake_time: mistakeTime,
      skill_concept: skillConcept,
      skill_approach: skillApproach,
      skill_killer: skillKiller,
    },
  };
}

/**
 * 🎯 '꽉 찬 등급 vs 턱걸이 등급' 정밀 위치 분석기
 */
export function analyzeGradePosition(examRecord, gradeSystem = 9) {
  if (!examRecord) return null;

  const isMock = examRecord.exam_category === 'MOCK';
  const cutoffs = isMock
    ? GRADE_9_CUTOFFS
    : Number(gradeSystem) === 5
    ? GRADE_5_CUTOFFS
    : GRADE_9_CUTOFFS;

  const rank =
    examRecord.rank !== '' && examRecord.rank !== null && examRecord.rank !== undefined
      ? Number(examRecord.rank)
      : null;
  const totalStudents =
    examRecord.total_students !== '' &&
    examRecord.total_students !== null &&
    examRecord.total_students !== undefined
      ? Number(examRecord.total_students)
      : null;
  const percentile =
    examRecord.percentile !== '' &&
    examRecord.percentile !== null &&
    examRecord.percentile !== undefined
      ? Number(examRecord.percentile)
      : null;

  const zScore = calculateZScore(
    examRecord.raw_score,
    examRecord.school_mean,
    examRecord.school_std_dev
  );

  // 1순위: 실제 석차/수강자수 기반 상위 %
  // 2순위: 모의고사 백분위 기반 상위 % (100 - 백분위)
  // 3순위: Z점수 기반 정규분포 상위 %
  let topPct = null;
  let pctSource = '';

  if (rank !== null && totalStudents !== null && rank > 0 && totalStudents > 0 && rank <= totalStudents) {
    topPct = Number(((rank / totalStudents) * 100).toFixed(2));
    pctSource = '실제 석차 기준';
  } else if (isMock && percentile !== null && !isNaN(percentile) && percentile > 0 && percentile <= 100) {
    topPct = Number(Math.max(0.1, 100 - percentile).toFixed(2));
    pctSource = '모의고사 백분위 기준';
  } else if (zScore !== null) {
    topPct = zScoreToTopPercent(zScore);
    pctSource = '표준편차(Z점수) 추정';
  }

  const autoRes = calculateAutoGrade(examRecord, gradeSystem);
  const actualGrade =
    Number(examRecord.grade) ||
    autoRes.grade ||
    (topPct !== null ? topPercentToGrade(topPct, isMock ? 9 : gradeSystem) : null);

  if (!actualGrade) {
    return {
      topPct,
      pctSource,
      zScore,
      actualGrade: null,
      statusBadge: null,
      message: null,
      progressInBand: 50,
    };
  }

  const band = cutoffs.find((c) => c.grade === actualGrade);
  if (!band || topPct === null) {
    return {
      topPct,
      pctSource,
      zScore,
      actualGrade,
      statusType: 'STABLE',
      statusBadge: autoRes.isManualOverride
        ? `${actualGrade}등급 (직접 지정)`
        : `${actualGrade}등급`,
      message:
        '석차(전교생 수) 또는 학교 평균·표준편차를 입력하면 등급 내 상세 위치(꽉 찬 등급/턱걸이)가 정밀 분석됩니다.',
      progressInBand: 50,
      bandMinPct: band ? band.minPct : 0,
      bandMaxPct: band ? band.maxPct : 100,
    };
  }

  // 동점자(중간석차) 예외로 인해 등수 비율상 등급과 실제 성적표 등급이 다른 경우 별도 안내
  if (autoRes.isManualOverride && autoRes.autoGrade && autoRes.autoGrade !== actualGrade) {
    return {
      topPct,
      pctSource,
      zScore,
      actualGrade,
      statusType: 'EDGE',
      statusBadge: `성적표 ${actualGrade}등급 (석차 상위 ${topPct}%)`,
      message: `단순 석차 비율(상위 ${topPct}%)은 ${autoRes.autoGrade}등급 구간이나, 동점자(중간석차) 반영 등으로 실제 성적표 기준 ${actualGrade}등급으로 보정되었습니다.`,
      progressInBand: 85,
      bandMinPct: band.minPct,
      bandMaxPct: band.maxPct,
    };
  }

  const bandWidth = band.maxPct - band.minPct;
  const clampedPct = Math.max(band.minPct, Math.min(band.maxPct, topPct));
  const positionRatio = bandWidth > 0 ? ((band.maxPct - clampedPct) / bandWidth) * 100 : 50;
  const progressInBand = Math.round(Math.max(5, Math.min(98, positionRatio)));

  // 상위 등급 컷까지 남은 % 및 인원수
  const upperGrade = actualGrade > 1 ? actualGrade - 1 : null;
  const upperCutPct = band.minPct;
  const pctToUpper = upperGrade ? Number(Math.max(0, topPct - upperCutPct).toFixed(2)) : 0;

  let ranksToUpper = null;
  if (upperGrade && rank > 0 && totalStudents > 0) {
    const upperCutRank = Math.round((upperCutPct / 100) * totalStudents);
    ranksToUpper = Math.max(1, rank - upperCutRank);
  }

  let statusType = 'STABLE'; // FULL (꽉 찬), STABLE (안정), EDGE (턱걸이)
  let statusBadge = `안정권 ${actualGrade}등급`;
  let message = '';

  if (actualGrade === 1) {
    if (topPct <= band.maxPct * 0.4) {
      statusType = 'FULL';
      statusBadge = `최상위 1등급 (상위 ${topPct}%)`;
      message = `전교 최상위권의 안정적인 1등급입니다.`;
    } else {
      statusType = 'STABLE';
      statusBadge = `1등급 유지 (상위 ${topPct}%)`;
      message = `1등급 커트라인(${band.maxPct}%) 안쪽에 안정적으로 진입해 있습니다.`;
    }
  } else if (positionRatio >= 68) {
    statusType = 'FULL';
    statusBadge = `상위권 ${actualGrade}등급 (${upperGrade}등급 근접)`;
    if (ranksToUpper !== null) {
      message = `${upperGrade}등급 커트라인(상위 ${upperCutPct}%)까지 단 ${ranksToUpper}명(${pctToUpper}%) 차이입니다. 1~2문항 추가 득점 시 ${upperGrade}등급 진입이 가능합니다.`;
    } else {
      message = `상위 ${topPct}%로 ${actualGrade}등급 중 최상단입니다. ${upperGrade}등급 컷(${upperCutPct}%)까지 ${pctToUpper}% 남았습니다.`;
    }
  } else if (positionRatio <= 28) {
    statusType = 'EDGE';
    statusBadge = `턱걸이 ${actualGrade}등급 (유지 주의)`;
    const marginToLower = Number(Math.max(0, band.maxPct - topPct).toFixed(2));
    message = `${actualGrade}등급 하위 커트라인(${band.maxPct}%)과의 여유가 ${marginToLower}%로 좁습니다. 감점 요인을 보완해 안정권으로 올려야 합니다.`;
  } else {
    statusType = 'STABLE';
    statusBadge = `안정권 ${actualGrade}등급`;
    if (ranksToUpper !== null) {
      message = `${actualGrade}등급 구간(${band.minPct}%~${band.maxPct}%) 중반에 위치해 있으며, ${upperGrade}등급 진입까지는 ${ranksToUpper}명(${pctToUpper}%) 단축이 필요합니다.`;
    } else {
      message = `${actualGrade}등급 구간(${band.minPct}%~${band.maxPct}%) 내에서 중상위 위치를 유지 중입니다.`;
    }
  }

  return {
    topPct,
    pctSource,
    zScore,
    actualGrade,
    statusType,
    statusBadge,
    message,
    progressInBand,
    upperGrade,
    upperCutPct,
    pctToUpper,
    ranksToUpper,
    bandMinPct: band.minPct,
    bandMaxPct: band.maxPct,
  };
}

/**
 * 🔍 직전 동종 시험(내신↔내신, 모의↔모의) 찾기
 * - 내신과 모의고사가 서로 섞여서 비교되지 않도록 철저히 분리
 * - 중간/기말 지필고사는 지필고사끼리, 학기 최종(합산)은 학기 최종끼리 비교하여 합산 데이터 중복 비교 방지
 * - 고2·고3 복수 과목 수강 시: 같은 시험 시기끼리는 비교하지 않고 동일 과목의 직전 시험을 1순위로 매칭
 */
export function findPreviousComparableExam(allSortedExams, targetExam) {
  if (!targetExam || !Array.isArray(allSortedExams) || allSortedExams.length < 2) {
    return null;
  }

  const targetIdx = allSortedExams.findIndex((e) => e.id === targetExam.id);
  const candidatesBefore =
    targetIdx >= 0
      ? allSortedExams.slice(0, targetIdx)
      : allSortedExams.filter((e) => getExamSortOrder(e) < getExamSortOrder(targetExam));

  // 1. 반드시 같은 시험 종류(INTERNAL끼리, MOCK끼리)만 후보로 제한
  const sameCategoryBefore = candidatesBefore.filter(
    (e) => e.exam_category === targetExam.exam_category
  );

  if (sameCategoryBefore.length === 0) return null;

  if (targetExam.exam_category === 'INTERNAL') {
    const isTargetSemesterTotal =
      targetExam.exam_period === '1_SEMESTER' || targetExam.exam_period === '2_SEMESTER';

    // 지필고사(중간·기말)는 지필고사끼리만 비교하고, 학기 최종(합산)은 학기 최종끼리만 비교
    const sameTypeBefore = sameCategoryBefore.filter((e) => {
      const isCandSemesterTotal =
        e.exam_period === '1_SEMESTER' || e.exam_period === '2_SEMESTER';
      return isCandSemesterTotal === isTargetSemesterTotal;
    });

    const pool = sameTypeBefore.length > 0 ? sameTypeBefore : sameCategoryBefore;

    // 같은 시기(같은 연도·학년·시험기간)의 다른 선택과목은 '직전 시험'이 아니므로 제외
    const strictlyEarlierPeriod = pool.filter(
      (e) =>
        !(
          Number(e.exam_year) === Number(targetExam.exam_year) &&
          Number(e.school_grade) === Number(targetExam.school_grade) &&
          e.exam_period === targetExam.exam_period
        )
    );

    if (strictlyEarlierPeriod.length === 0) return null;

    // 동일 과목(예: 대수 1-1 중간 -> 대수 1-1 기말)이 있으면 최우선 매칭
    const sameSubjectEarlier = strictlyEarlierPeriod.filter(
      (e) => (e.subject || '').trim() === (targetExam.subject || '').trim()
    );
    if (sameSubjectEarlier.length > 0) {
      return sameSubjectEarlier[sameSubjectEarlier.length - 1];
    }

    return strictlyEarlierPeriod[strictlyEarlierPeriod.length - 1];
  }

  // 모의고사는 바로 직전 모의고사와 비교
  return sameCategoryBefore[sameCategoryBefore.length - 1];
}

/**
 * 🎯 7대 오답 감점 요인별 핵심 실천 처방 가이드 (한눈에 읽히는 1문장 실전 코칭)
 */
export const ERROR_PRESCRIPTION_GUIDE = {
  mistake_calc: {
    key: 'mistake_calc',
    label: '계산·부호 실수',
    shortLabel: '계산·부호 실수',
    action:
      '암산으로 식을 건너뛰지 말고 등호(=) 기준 줄 맞춰 풀이하는 습관을 고정하고, 전개·이항 직후 3초 부호·계수 역산 확인 루틴을 지키세요.',
  },
  mistake_cond: {
    key: 'mistake_cond',
    label: '문제 조건 누락',
    shortLabel: '문제 조건 누락',
    action:
      '문제를 읽을 때 제한 조건(정수·양수·정의역 등)에 동그라미, 최종 구하는 값에 네모 박스를 치고, 마킹 직전 조건 부합 여부를 5초간 대조하세요.',
  },
  mistake_essay: {
    key: 'mistake_essay',
    label: '서술형 감점',
    shortLabel: '서술형 감점',
    action:
      '수식만 나열하지 말고 채점 기준이 되는 필수 감점 포인트(미지수 정의, 정의역·판별식 범위 명시, 최종 결론 문장)를 한 줄씩 완결되게 작성하세요.',
  },
  mistake_time: {
    key: 'mistake_time',
    label: '시간 배분 실패 (풀이 가능 문항)',
    shortLabel: '시간 배분 실패',
    action:
      '2분 내에 풀이 시작점이 안 보이면 별표 치고 넘어가는 기준을 세우고, 종료 15분 전까지 풀 수 있는 문항의 1차 완주·마킹을 먼저 끝내세요.',
  },
  skill_concept: {
    key: 'skill_concept',
    label: '기본 개념·공식 미숙',
    shortLabel: '기본 개념·공식 미숙',
    action:
      '고난도 문제 풀이보다 교과서·기본서의 정의와 필수 공식을 백지에 직접 써보며 빈틈없이 암기하고, 대표 기본 예제를 즉각 식 세울 수 있게 반복하세요.',
  },
  skill_approach: {
    key: 'skill_approach',
    label: '기본 유형 접근법 막힘',
    shortLabel: '기본 유형 접근법 막힘',
    action:
      '틀린 유형은 "문제에 [어떤 조건]이 나오면 → 첫 줄에 [어떤 식·그래프]를 세운다"는 접근 공식을 한 줄로 정리하고 변형 문제를 3회독 자력으로 풀이하세요.',
  },
  skill_killer: {
    key: 'skill_killer',
    label: '최고난도 문제 한계',
    shortLabel: '최고난도 문제 한계',
    action:
      '해설지를 바로 보지 말고 15분 이상 조건 쪼개기·그래프 개형 추론·경우 나누기를 직접 시도한 뒤, 막혔던 결정적 조건 해석 포인트를 오답노트에 축적하세요.',
  },
};

/**
 * 🔍 직전 동종 시험 vs 이번 시험의 오답 패인 요약 및 최우선 보완 과제(Top 1~2) 추출
 * - 장황한 나열과 모순된 문구를 없애고, 한눈에 읽히는 [핵심 총평 1줄 + 최우선 실천 과제 1~2개]만 정제해 반환합니다.
 */
export function compareErrorTrends(prevExam, currExam) {
  if (!currExam) return null;
  const currPot = analyzePotentialPerformance(currExam);
  const prevPot = prevExam ? analyzePotentialPerformance(prevExam) : null;

  const insights = [];
  const prevLabel = prevExam ? formatExamShortLabel(prevExam) : '직전 시험';

  if (!currPot) {
    return { currPot: null, prevPot, insights, topPriorities: [] };
  }

  // 이번 시험에서 실제로 감점이 발생한 항목들
  const activeCurrItems = ERROR_REASON_CATEGORIES.map((cat) => ({
    ...cat,
    guide: ERROR_PRESCRIPTION_GUIDE[cat.key],
    currVal: Number(currPot.breakdown[cat.key]) || 0,
    prevVal: prevPot ? Number(prevPot.breakdown[cat.key]) || 0 : null,
    diff:
      prevPot !== null
        ? Number(
            (
              (Number(currPot.breakdown[cat.key]) || 0) -
              (Number(prevPot.breakdown[cat.key]) || 0)
            ).toFixed(1)
          )
        : null,
  })).filter((item) => item.currVal > 0);

  // 💡 학생 점수대에 맞는 현실적 교정 우선순위 정렬:
  // 기본 개념/유형이나 풀이습관 감점 합계가 10점 이상이면, '최고난도 문제 한계(킬러)'보다 기본·주요 문항 및 습관 교정을 우선순위로 배치
  const nonKillerLost = Number(
    (currPot.totalRecordedLost - (currPot.breakdown.skill_killer || 0)).toFixed(1)
  );
  const prioritizedItems = [...activeCurrItems].sort((a, b) => {
    if (nonKillerLost >= 10) {
      if (a.key === 'skill_killer' && b.key !== 'skill_killer') return 1;
      if (b.key === 'skill_killer' && a.key !== 'skill_killer') return -1;
    }
    return b.currVal - a.currVal;
  });

  // 학생이 집중해야 할 최우선 과제 (최대 2개까지만 깔끔하게 선정)
  const topPriorities = prioritizedItems.slice(0, 2).map((it, idx) => ({
    rank: idx + 1,
    key: it.key,
    label: it.label,
    shortLabel: it.shortLabel,
    recoverable: it.recoverable,
    currVal: it.currVal,
    prevVal: it.prevVal,
    diff: it.diff,
    action: it.guide.action,
  }));

  // ============================================================================
  // 1. 한눈에 들어오는 핵심 진단 요약 (최대 1~2개 간결한 문장)
  // ============================================================================
  if (prevPot && (prevPot.totalRecordedLost > 0 || currPot.totalRecordedLost > 0)) {
    const allDiffs = ERROR_REASON_CATEGORIES.map((cat) => {
      const cVal = Number(currPot.breakdown[cat.key]) || 0;
      const pVal = Number(prevPot.breakdown[cat.key]) || 0;
      return {
        ...cat,
        currVal: cVal,
        prevVal: pVal,
        diff: Number((cVal - pVal).toFixed(1)),
      };
    });

    const worstInc = [...allDiffs].filter((d) => d.diff > 0).sort((a, b) => b.diff - a.diff)[0];
    const bestDec = [...allDiffs].filter((d) => d.diff < 0).sort((a, b) => a.diff - b.diff)[0];

    if (worstInc && bestDec) {
      insights.push({
        type: 'WARNING',
        badge: '직전 시험 대비 변화',
        title: `직전(${prevLabel}) 대비 [${worstInc.shortLabel}] 감점이 ${worstInc.diff}점 증가(-${worstInc.prevVal}점→-${worstInc.currVal}점)했고, [${bestDec.shortLabel}] 감점은 ${Math.abs(bestDec.diff)}점 감소(-${bestDec.prevVal}점→-${bestDec.currVal}점)했습니다.`,
        text: `직전(${prevLabel}) 대비 [${worstInc.shortLabel}] 감점이 ${worstInc.diff}점 증가(-${worstInc.prevVal}점→-${worstInc.currVal}점)했고, [${bestDec.shortLabel}] 감점은 ${Math.abs(bestDec.diff)}점 감소(-${bestDec.prevVal}점→-${bestDec.currVal}점)했습니다.`,
      });
    } else if (worstInc) {
      insights.push({
        type: 'WARNING',
        badge: '주의 · 감점 증가',
        title: `직전(${prevLabel}) 대비 [${worstInc.label}] 감점이 -${worstInc.prevVal}점에서 -${worstInc.currVal}점으로 ${worstInc.diff}점 늘었습니다.`,
        text: `직전(${prevLabel}) 대비 [${worstInc.label}] 감점이 -${worstInc.prevVal}점에서 -${worstInc.currVal}점으로 ${worstInc.diff}점 늘었습니다.`,
      });
    } else if (bestDec) {
      insights.push({
        type: 'POSITIVE',
        badge: '개선 · 감점 감소',
        title: `직전(${prevLabel}) 대비 [${bestDec.label}] 감점을 -${bestDec.prevVal}점에서 -${bestDec.currVal}점으로 ${Math.abs(bestDec.diff)}점 줄였습니다.`,
        text: `직전(${prevLabel}) 대비 [${bestDec.label}] 감점을 -${bestDec.prevVal}점에서 -${bestDec.currVal}점으로 ${Math.abs(bestDec.diff)}점 줄였습니다.`,
      });
    }
  }

  // 2. 이번 시험 최우선 보완 포인트 요약 (Top 1~2 처방 포함)
  if (topPriorities.length > 0) {
    const p1 = topPriorities[0];
    const p2 = topPriorities[1] || null;
    const summaryTitle = p2
      ? `이번 시험 최우선 보완 과제는 [${p1.shortLabel}](-${p1.currVal}점)과 [${p2.shortLabel}](-${p2.currVal}점)입니다.`
      : `이번 시험 최우선 보완 과제는 [${p1.label}](-${p1.currVal}점)입니다.`;

    insights.push({
      type: 'ACTION',
      badge: '핵심 보완 처방',
      title: summaryTitle,
      priorities: topPriorities,
      text: `${summaryTitle} ${topPriorities
        .map((p) => `[${p.shortLabel}] ${p.action}`)
        .join(' / ')}`,
    });
  }

  return {
    currPot,
    prevPot,
    insights,
    topPriorities,
  };
}

/**
 * 시험 정렬용 타임라인 키 생성 (연도 -> 학년 -> 시기 -> 과목 순)
 */
export function getExamSortOrder(exam) {
  const year = Number(exam.exam_year) || 2026;
  const grade = Number(exam.school_grade) || 1;
  const allPeriods = [...INTERNAL_EXAM_PERIODS, ...MOCK_EXAM_PERIODS];
  const found = allPeriods.find((p) => p.id === exam.exam_period);
  const periodOrder = found ? found.order : 5;

  // 같은 시기에 2개 과목(예: 대수 + 확통) 응시 시 일관된 순서를 위한 미세 오프셋
  const subjIdx = MATH_SUBJECTS.indexOf(exam.subject);
  const subjOffset = subjIdx >= 0 ? subjIdx * 0.01 : 0.09;

  return year * 1000 + grade * 100 + periodOrder + subjOffset;
}

/**
 * 시험 짧은 이름 포맷 (예: "고1 1-1 중간" 또는 "고2 6월 모평")
 */
export function formatExamShortLabel(exam) {
  if (!exam) return '';
  const allPeriods = [...INTERNAL_EXAM_PERIODS, ...MOCK_EXAM_PERIODS];
  const found = allPeriods.find((p) => p.id === exam.exam_period);
  const pLabel = found ? found.shortLabel : exam.exam_period || '시험';
  return `고${exam.school_grade || 1} ${pLabel}`;
}

/**
 * 시험 전체 이름 포맷 (예: "2026년 고1 1학기 중간고사 (공통수학1)")
 */
export function formatExamFullLabel(exam) {
  if (!exam) return '';
  const allPeriods = [...INTERNAL_EXAM_PERIODS, ...MOCK_EXAM_PERIODS];
  const found = allPeriods.find((p) => p.id === exam.exam_period);
  const pLabel = found ? found.label : exam.exam_period || '정기고사';
  const subj = exam.subject ? ` (${exam.subject})` : '';
  return `${exam.exam_year || 2026}년 고${exam.school_grade || 1} ${pLabel}${subj}`;
}
