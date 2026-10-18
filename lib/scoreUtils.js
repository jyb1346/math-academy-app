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
 * 🎯 6대 오답 패인(감점 요인) 분류
 * - recoverable: true 인 항목은 '아까운 실수'로 분류되어 [잠재 실력 점수] 계산 시 복원 점수로 합산됨
 */
export const ERROR_REASON_CATEGORIES = [
  {
    key: 'mistake_calc',
    label: '계산·부호 실수',
    shortLabel: '계산실수',
    description: '풀이 식은 맞았으나 사칙연산, 부호, 옮겨 적기 등에서 실수한 감점',
    recoverable: true,
    groupLabel: '아까운 실수 (잠재실력 복원 대상)',
    color: 'rose',
  },
  {
    key: 'mistake_cond',
    label: '문제 조건 누락',
    shortLabel: '조건누락',
    description: '정수/자연수 조건, 정의역 범위, 구하는 값 등을 놓쳐서 틀린 감점',
    recoverable: true,
    groupLabel: '아까운 실수 (잠재실력 복원 대상)',
    color: 'amber',
  },
  {
    key: 'mistake_essay',
    label: '서술형 과정 감점 / 시간부족 실수',
    shortLabel: '서술형/시간',
    description: '풀 수 있는 문제를 시간 배분 실패로 못 풀었거나 서술형 논리에서 부분 감점',
    recoverable: true,
    groupLabel: '아까운 실수 (잠재실력 복원 대상)',
    color: 'orange',
  },
  {
    key: 'skill_concept',
    label: '개념·공식 미숙',
    shortLabel: '개념미숙',
    description: '기본 정의나 공식이 정확히 기억나지 않아 접근하지 못한 감점',
    recoverable: false,
    groupLabel: '실력 보완 영역 (집중 학습 대상)',
    color: 'indigo',
  },
  {
    key: 'skill_approach',
    label: '유형·접근법 막힘',
    shortLabel: '유형막힘',
    description: '개념은 알지만 문제에서 어떤 식을 세워야 할지 발상을 못한 감점',
    recoverable: false,
    groupLabel: '실력 보완 영역 (집중 학습 대상)',
    color: 'blue',
  },
  {
    key: 'skill_killer',
    label: '킬러(최고난도) 한계',
    shortLabel: '킬러문항',
    description: '1~2등급 변별용 최고난도 심화 추론 문항에서의 감점',
    recoverable: false,
    groupLabel: '실력 보완 영역 (집중 학습 대상)',
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

  const skillConcept = Number(breakdown.skill_concept) || 0;
  const skillApproach = Number(breakdown.skill_approach) || 0;
  const skillKiller = Number(breakdown.skill_killer) || 0;

  // 아까운 실수 감점 합계
  const recoverableLost = Number((mistakeCalc + mistakeCond + mistakeEssay).toFixed(1));
  // 실력 보완 감점 합계
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
      statusBadge: `📌 성적표 ${actualGrade}등급 (단순석차 상위 ${topPct}%)`,
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
      message = `전교 최상위권의 압도적인 1등급입니다!`;
    } else {
      statusType = 'STABLE';
      statusBadge = `1등급 수성 (상위 ${topPct}%)`;
      message = `1등급 커트라인(${band.maxPct}%) 안쪽에 안정적으로 진입해 있습니다.`;
    }
  } else if (positionRatio >= 68) {
    statusType = 'FULL';
    statusBadge = `🔥 꽉 찬 ${actualGrade}등급 (${upperGrade}등급 근접!)`;
    if (ranksToUpper !== null) {
      message = `${upperGrade}등급 커트라인(상위 ${upperCutPct}%)까지 단 ${ranksToUpper}명(${pctToUpper}%) 차이입니다! 실수 1문제만 잡아도 바로 ${upperGrade}등급 진입이 유력합니다.`;
    } else {
      message = `상위 ${topPct}%로 ${actualGrade}등급 중 최상단입니다. ${upperGrade}등급 컷(${upperCutPct}%)까지 불과 ${pctToUpper}% 남았습니다!`;
    }
  } else if (positionRatio <= 28) {
    statusType = 'EDGE';
    statusBadge = `⚠️ 턱걸이 ${actualGrade}등급 (유지 주의)`;
    const marginToLower = Number(Math.max(0, band.maxPct - topPct).toFixed(2));
    message = `${actualGrade}등급 하위 커트라인(${band.maxPct}%)과의 여유가 ${marginToLower}%로 좁습니다. 다음 시험에서 실수를 줄여 안정권으로 올려야 합니다.`;
  } else {
    statusType = 'STABLE';
    statusBadge = `✅ 안정권 ${actualGrade}등급`;
    if (ranksToUpper !== null) {
      message = `${actualGrade}등급 구간(${band.minPct}%~${band.maxPct}%) 중반에 위치해 있으며, ${upperGrade}등급 진입까지는 ${ranksToUpper}명(${pctToUpper}%) 단축이 필요합니다.`;
    } else {
      message = `${actualGrade}등급 구간(${band.minPct}%~${band.maxPct}%) 내에서 흔들림 없는 중상위 위치를 유지 중입니다.`;
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
 * - 고2·고3 복수 과목 수강 시: 같은 시험 시기(예: 1학기 중간 대수 vs 1학기 중간 확통)끼리는 비교하지 않고,
 *   동일 과목의 직전 시험을 1순위로, 없으면 이전 시험 시기의 내신을 2순위로 매칭
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
    // 같은 시기(같은 연도·학년·시험기간)의 다른 선택과목은 '직전 시험'이 아니므로 제외
    const strictlyEarlierPeriod = sameCategoryBefore.filter(
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
 * 🔍 직전 동종 시험 vs 이번 시험의 오답 패인(체질) 변화 비교 분석
 */
export function compareErrorTrends(prevExam, currExam) {
  if (!currExam) return null;
  const currPot = analyzePotentialPerformance(currExam);
  const prevPot = prevExam ? analyzePotentialPerformance(prevExam) : null;

  const insights = [];
  const prevLabel = prevExam ? formatExamShortLabel(prevExam) : '직전 시험';

  if (prevPot && currPot) {
    // 1. 아까운 실수 총량 비교
    const diffRecoverable = Number((currPot.recoverableLost - prevPot.recoverableLost).toFixed(1));
    if (prevPot.recoverableLost > 0 && currPot.recoverableLost === 0) {
      insights.push({
        type: 'POSITIVE',
        text: `직전(${prevLabel})에서 아까운 실수로 잃었던 ${prevPot.recoverableLost}점을 이번 시험에서는 0점으로 완벽하게 극복했습니다! 🎉`,
      });
    } else if (diffRecoverable < 0) {
      insights.push({
        type: 'POSITIVE',
        text: `아까운 실수(계산·조건·서술형) 감점이 직전(${prevLabel}) ${prevPot.recoverableLost}점 ➔ 이번 시험 ${currPot.recoverableLost}점으로 ${Math.abs(diffRecoverable)}점 줄어 실전 집중력이 크게 좋아졌습니다.`,
      });
    } else if (diffRecoverable > 0) {
      insights.push({
        type: 'WARNING',
        text: `이번 시험에서 아까운 실수 감점이 ${currPot.recoverableLost}점으로 직전(${prevLabel}, ${prevPot.recoverableLost}점)보다 ${diffRecoverable}점 늘었습니다. 실력 부족이 아닌 실수 관리만으로도 ${currPot.potentialScore}점 도달이 가능합니다.`,
      });
    }

    // 2. 세부 항목별 변화 비교
    ERROR_REASON_CATEGORIES.forEach((cat) => {
      const pVal = prevPot.breakdown[cat.key] || 0;
      const cVal = currPot.breakdown[cat.key] || 0;
      if (pVal >= 3 && cVal === 0) {
        insights.push({
          type: 'POSITIVE',
          text: `[${cat.label}] 감점이 직전(${prevLabel}) -${pVal}점에서 이번 시험 0점으로 완벽히 해결되었습니다.`,
        });
      } else if (cVal - pVal >= 4) {
        insights.push({
          type: 'NEGATIVE',
          text: `[${cat.label}] 감점이 직전(${prevLabel}, -${pVal}점) 대비 -${cVal}점으로 증가하여 다음 시험 전 집중 보완이 필요합니다.`,
        });
      }
    });
  } else if (currPot && currPot.recoverableLost > 0) {
    insights.push({
      type: 'INFO',
      text: `현재 실제 점수는 ${currPot.rawScore}점이지만, 아까운 실수(${currPot.recoverableLost}점)만 보완하면 잠재 실력은 ${currPot.potentialScore}점 수준입니다.`,
    });
  }

  return {
    currPot,
    prevPot,
    insights,
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
