'use client';

import { useState, useMemo } from 'react';
import {
  ERROR_REASON_CATEGORIES,
  getExamSortOrder,
  formatExamShortLabel,
  analyzeGradePosition,
  analyzePotentialPerformance,
  compareErrorTrends,
  findPreviousComparableExam,
} from '@/lib/scoreUtils';

export default function StudentScoreSummaryWidget({
  scores = [],
  profile = {},
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [chartMetricMode, setChartMetricMode] = useState('SCORE'); // 'SCORE' | 'GRADE'

  const gradeSystem = Number(profile?.grade_system) === 5 ? 5 : 9;
  const targetGrade = profile?.target_grade ? Number(profile.target_grade) : null;
  const targetScore = profile?.target_score ? Number(profile.target_score) : null;

  const sortedExams = useMemo(() => {
    return [...(scores || [])].sort(
      (a, b) => getExamSortOrder(a) - getExamSortOrder(b)
    );
  }, [scores]);

  const filteredExams = useMemo(() => {
    if (selectedCategory === 'ALL') return sortedExams;
    return sortedExams.filter((e) => e.exam_category === selectedCategory);
  }, [sortedExams, selectedCategory]);

  // 성적 추이 그래프용 시험 목록: 중간·기말 지필고사와 모의고사만 연결하고 학기 최종(합산)은 중복 꺾임 방지를 위해 분리
  const timelineChartExams = useMemo(() => {
    const regularOnly = filteredExams.filter(
      (e) => e.exam_period !== '1_SEMESTER' && e.exam_period !== '2_SEMESTER'
    );
    return regularOnly.length > 0 ? regularOnly : filteredExams;
  }, [filteredExams]);

  const activeExam = useMemo(() => {
    if (filteredExams.length === 0) return null;
    if (selectedExamId) {
      const found = filteredExams.find((e) => e.id === selectedExamId);
      if (found) return found;
    }
    return filteredExams[filteredExams.length - 1];
  }, [filteredExams, selectedExamId]);

  const prevComparableExam = useMemo(() => {
    if (!activeExam) return null;
    return findPreviousComparableExam(sortedExams, activeExam);
  }, [sortedExams, activeExam]);

  const posInfo = useMemo(
    () => (activeExam ? analyzeGradePosition(activeExam, gradeSystem) : null),
    [activeExam, gradeSystem]
  );

  const potInfo = useMemo(
    () =>
      activeExam ? analyzePotentialPerformance(activeExam, gradeSystem) : null,
    [activeExam, gradeSystem]
  );

  const errorTrend = useMemo(
    () =>
      activeExam
        ? compareErrorTrends(prevComparableExam, activeExam)
        : null,
    [activeExam, prevComparableExam]
  );

  if (!sortedExams || sortedExams.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* 상단 깔끔한 화이트 헤더 */}
      <div className="bg-white border-b border-slate-100 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              나의 고교 수학 성적 추이 및 오답 분석 리포트
            </h2>
            {profile?.school_name && (
              <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-0.5 rounded-md whitespace-nowrap">
                {profile.school_name} · 고{profile.school_grade || 1} ({gradeSystem}등급제)
              </span>
            )}
            {(targetGrade || targetScore) && (
              <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-extrabold px-2.5 py-0.5 rounded-md whitespace-nowrap">
                목표: {targetGrade ? `${targetGrade}등급` : ''}
                {targetGrade && targetScore ? ' · ' : ''}
                {targetScore ? `${targetScore}점` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            시험별 성취도와 7대 오답 감점 원인을 점검하고 다음 시험 대비 보완 과제를 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/80 p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'ALL', label: '전체' },
            { id: 'INTERNAL', label: '내신' },
            { id: 'MOCK', label: '모의고사' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                selectedCategory === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* 시험 선택 가로 탭 리스트 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filteredExams.map((ex) => {
            const isSel = activeExam?.id === ex.id;
            const isMock = ex.exam_category === 'MOCK';
            const isSemTotal =
              ex.exam_period === '1_SEMESTER' || ex.exam_period === '2_SEMESTER';
            const exGrade =
              ex.grade || analyzeGradePosition(ex, gradeSystem)?.actualGrade;
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedExamId(ex.id)}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition shrink-0 ${
                  isSel
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : isSemTotal
                    ? 'bg-violet-50/70 hover:bg-violet-100/70 text-slate-800 border-violet-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black whitespace-nowrap">
                    {formatExamShortLabel(ex)}
                  </span>
                  <span
                    className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                      isSel
                        ? 'bg-white/20 text-white'
                        : isMock
                        ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    }`}
                  >
                    {ex.raw_score !== null ? `${ex.raw_score}점` : '-'}
                    {exGrade ? ` · ${exGrade}등급` : ''}
                  </span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 font-semibold whitespace-nowrap ${
                    isSel ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {ex.subject}
                </div>
              </button>
            );
          })}
        </div>

        {/* 학생용 성적 추이 그래프 (시험이 2개 이상일 때 한눈에 성적 흐름 표시) */}
        {timelineChartExams.length >= 2 && (
          <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-slate-900">
                  나의 성적 변화 추이
                </h3>
                <span className="text-[11px] font-medium text-slate-500">
                  그래프의 시험 지점을 누르면 상세 리포트가 전환됩니다
                </span>
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200/90 p-0.5 rounded-lg">
                {[
                  { id: 'SCORE', label: '원점수 추이' },
                  { id: 'GRADE', label: '등급 추이 (1등급 상단)' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setChartMetricMode(m.id)}
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md transition whitespace-nowrap ${
                      chartMetricMode === m.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <StudentMiniTimelineChart
              exams={timelineChartExams}
              metricMode={chartMetricMode}
              gradeSystem={gradeSystem}
              targetScore={targetScore}
              targetGrade={targetGrade}
              selectedExamId={activeExam?.id}
              onSelectExam={(id) => setSelectedExamId(id)}
            />
          </div>
        )}

        {/* 선택된 시험 상세 지표 카드 3종 */}
        {activeExam && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 카드 1: 원점수 및 산출 등급 + 직전 동종 시험 대비 변화 */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      선택 시험 성적
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {formatExamShortLabel(activeExam)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                      {activeExam.raw_score !== null ? `${activeExam.raw_score}점` : '-'}
                    </span>
                    {(activeExam.grade || posInfo?.actualGrade) && (
                      <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg tabular-nums whitespace-nowrap">
                        {activeExam.grade || posInfo?.actualGrade}등급
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-bold text-slate-500 mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2 tabular-nums">
                  <span>
                    {posInfo?.topPct !== null && posInfo?.topPct !== undefined
                      ? `상위 ${posInfo.topPct}% ${
                          activeExam.rank && activeExam.total_students
                            ? `(${activeExam.rank}등/${activeExam.total_students}명)`
                            : ''
                        }`
                      : activeExam.subject || '수학'}
                  </span>
                  {prevComparableExam &&
                    prevComparableExam.raw_score !== null &&
                    activeExam.raw_score !== null &&
                    (() => {
                      const diff = Number(
                        (activeExam.raw_score - prevComparableExam.raw_score).toFixed(1)
                      );
                      return (
                        <span
                          className={`font-extrabold whitespace-nowrap ${
                            diff > 0
                              ? 'text-emerald-600'
                              : diff < 0
                              ? 'text-rose-600'
                              : 'text-slate-400'
                          }`}
                        >
                          직전 대비 {diff > 0 ? `+${diff}점` : diff < 0 ? `${diff}점` : '동일'}
                        </span>
                      );
                    })()}
                </div>
              </div>

              {/* 카드 2: 등급 컷 상세 위치 진단 */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      등급 컷 위치 진단
                    </span>
                    {posInfo?.statusBadge && (
                      <span className="text-[11px] bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-black px-2 py-0.5 rounded-md whitespace-nowrap">
                        {posInfo.statusBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-3 leading-relaxed">
                    {posInfo?.message || '등수·전교생 수 입력 시 상위 등급 진입 여유도가 표시됩니다.'}
                  </p>
                </div>
                <p className="text-[11px] font-medium text-slate-400 mt-3 pt-2.5 border-t border-slate-200/70">
                  {targetGrade
                    ? `목표 등급(${targetGrade}등급) 대비 현재 위치 진단`
                    : `${gradeSystem}등급제 기준 상대적 석차 위치 분석`}
                </p>
              </div>

              {/* 카드 3: 학교 평균 및 상대 성취도 */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      학교 평균 및 상대 성취도
                    </span>
                    {activeExam.school_mean !== null && (
                      <span className="text-[11px] bg-white border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md tabular-nums whitespace-nowrap">
                        평균 {activeExam.school_mean}점
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    {activeExam.school_mean !== null && activeExam.raw_score !== null ? (
                      (() => {
                        const diffMean = Number(
                          (activeExam.raw_score - activeExam.school_mean).toFixed(1)
                        );
                        return (
                          <>
                            <span
                              className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                                diffMean >= 0 ? 'text-indigo-700' : 'text-rose-600'
                              }`}
                            >
                              {diffMean >= 0 ? `+${diffMean}점` : `${diffMean}점`}
                            </span>
                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                              학교 평균 대비
                            </span>
                          </>
                        );
                      })()
                    ) : activeExam.exam_category === 'MOCK' &&
                      activeExam.percentile !== null ? (
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                        백분위 {activeExam.percentile}%
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-slate-400 py-1">
                        학교 평균 미입력
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-3 pt-2.5 border-t border-slate-200/70 tabular-nums">
                  {posInfo?.zScore !== null && posInfo?.zScore !== undefined
                    ? `표준편차 ${activeExam.school_std_dev} · Z점수 ${
                        posInfo.zScore > 0 ? `+${posInfo.zScore}` : posInfo.zScore
                      }`
                    : activeExam.school_mean !== null
                    ? `과목 평균 ${activeExam.school_mean}점 기준 비교`
                    : '과목 평균 입력 시 시험 난이도 대비 위치가 표시됩니다'}
                </p>
              </div>
            </div>

            {/* 7대 오답 감점 원인 및 직전 동종 시험 대비 변화 + 학생 맞춤 학습 처방 */}
            {(potInfo?.totalRecordedLost > 0 || errorTrend?.insights?.length > 0) && (
              <div className="bg-slate-50/60 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-black text-slate-900">
                      7대 오답 감점 원인 및 맞춤 학습 처방
                    </h3>
                    {potInfo?.totalRecordedLost > 0 && (
                      <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                        {potInfo.totalActualLost > 0 &&
                        potInfo.totalActualLost !== potInfo.totalRecordedLost
                          ? `(전체 감점 -${potInfo.totalActualLost}점 중 -${potInfo.totalRecordedLost}점 분류됨)`
                          : `(분류된 감점 총 -${potInfo.totalRecordedLost}점)`}
                      </span>
                    )}
                  </div>
                  {prevComparableExam && (
                    <span className="text-[11px] font-bold text-slate-500">
                      비교 기준: {formatExamShortLabel(prevComparableExam)}
                    </span>
                  )}
                </div>

                {potInfo?.totalRecordedLost > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ERROR_REASON_CATEGORIES.map((cat) => {
                      const val = Number(activeExam.error_breakdown?.[cat.key]) || 0;
                      if (val <= 0) return null;
                      const prevVal = prevComparableExam
                        ? Number(prevComparableExam.error_breakdown?.[cat.key]) || 0
                        : null;
                      const diff =
                        prevVal !== null ? Number((val - prevVal).toFixed(1)) : null;
                      const barPct = Math.min(
                        100,
                        Math.round((val / Math.max(15, potInfo.totalRecordedLost)) * 100)
                      );

                      return (
                        <div
                          key={cat.key}
                          className="bg-white px-3.5 py-3 rounded-xl border border-slate-200/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${
                                  cat.recoverable
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                }`}
                              >
                                {cat.recoverable ? '풀이습관' : '개념·심화'}
                              </span>
                              <span className="font-black text-slate-800 whitespace-nowrap">
                                {cat.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                              {diff !== null && diff !== 0 && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                                    diff < 0
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}점` : `${diff}점`}
                                </span>
                              )}
                              <span
                                className={`font-black whitespace-nowrap ${
                                  cat.recoverable ? 'text-rose-600' : 'text-indigo-900'
                                }`}
                              >
                                -{val}점
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cat.recoverable ? 'bg-rose-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(errorTrend?.topPriorities?.length > 0 ||
                  errorTrend?.insights?.length > 0) && (
                  <div className="pt-2 border-t border-slate-200/70 space-y-2.5">
                    {(() => {
                      const trendInsight = errorTrend?.insights?.find(
                        (ins) => ins.type !== 'ACTION'
                      );
                      const priorities = errorTrend?.topPriorities || [];

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-900 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-md whitespace-nowrap">
                                최우선 보완 과제
                              </span>
                              <span className="text-xs font-extrabold text-slate-800">
                                {priorities.length > 0
                                  ? `이번 시험 집중 교정 대상 ${priorities
                                      .map((p) => `[${p.shortLabel} -${p.currVal}점]`)
                                      .join(' · ')}`
                                  : trendInsight?.title}
                              </span>
                            </div>
                            {trendInsight && priorities.length > 0 && (
                              <span className="text-[11px] font-bold text-slate-500">
                                {trendInsight.title}
                              </span>
                            )}
                          </div>

                          {priorities.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {priorities.map((p) => (
                                <div
                                  key={p.key}
                                  className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-3 space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap ${
                                          p.rank === 1
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-200 text-slate-800'
                                        }`}
                                      >
                                        {p.rank}순위 과제
                                      </span>
                                      <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                                        {p.label}
                                      </span>
                                    </div>
                                    <span className="text-xs font-black text-rose-600 tabular-nums whitespace-nowrap">
                                      -{p.currVal}점
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-slate-600 leading-relaxed pt-0.5">
                                    {p.action}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* 담당 선생님 총평 코멘트 */}
            {activeExam.memo && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 border-l-4 border-l-indigo-600 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-slate-900">
                    담당 선생님 종합 의견 및 학습 처방
                  </span>
                </div>
                <p className="font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {activeExam.memo}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 학생용 컴팩트 성적 추이 SVG 차트
 */
function StudentMiniTimelineChart({
  exams = [],
  metricMode = 'SCORE',
  gradeSystem = 9,
  targetScore = null,
  targetGrade = null,
  selectedExamId,
  onSelectExam,
}) {
  const width = 760;
  const height = 210;
  const padLeft = 54;
  const padRight = 44;
  const padTop = 30;
  const padBottom = 44;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const bottomY = padTop + plotH;
  const innerInsetX = 42;
  const usableW = Math.max(80, plotW - innerInsetX * 2);

  const getX = (idx) => {
    if (exams.length === 1) return padLeft + plotW / 2;
    return padLeft + innerInsetX + (idx / (exams.length - 1)) * usableW;
  };

  const getYForScore = (val) => {
    const clamped = Math.max(0, Math.min(100, Number(val) || 0));
    return padTop + plotH - (clamped / 100) * plotH;
  };

  const getYForGrade = (gradeVal) => {
    const maxG = Number(gradeSystem) === 5 ? 5 : 9;
    const g = Math.max(1, Math.min(maxG, Number(gradeVal) || 3));
    return padTop + ((g - 1) / (maxG - 1)) * plotH;
  };

  const points = exams.map((exam, idx) => {
    const x = getX(idx);
    const pos = analyzeGradePosition(exam, gradeSystem);
    let primaryY = null;
    let primaryLabel = '';

    if (metricMode === 'SCORE') {
      if (exam.raw_score !== null && !isNaN(Number(exam.raw_score))) {
        primaryY = getYForScore(exam.raw_score);
        primaryLabel = `${exam.raw_score}점`;
      }
    } else {
      const g = exam.grade || pos?.actualGrade;
      if (g) {
        primaryY = getYForGrade(g);
        primaryLabel = `${g}등급`;
      }
    }

    return { exam, x, primaryY, primaryLabel };
  });

  const buildSmoothPath = (pts) => {
    const valid = pts.filter((p) => p.primaryY !== null);
    if (valid.length < 2) return '';
    return valid.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.primaryY.toFixed(1)}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) * 0.38;
      const cy1 = prev.primaryY;
      const cx2 = pt.x - (pt.x - prev.x) * 0.38;
      const cy2 = pt.primaryY;
      return `${acc} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.primaryY.toFixed(1)}`;
    }, '');
  };

  const internalPoints = points.filter((p) => p.exam.exam_category === 'INTERNAL');
  const mockPoints = points.filter((p) => p.exam.exam_category === 'MOCK');
  const internalPath = buildSmoothPath(internalPoints);
  const mockPath = buildSmoothPath(mockPoints);

  const gridLines =
    metricMode === 'SCORE'
      ? [100, 80, 60, 40].map((v) => ({ y: getYForScore(v), label: `${v}점` }))
      : (Number(gradeSystem) === 5 ? [1, 2, 3, 4, 5] : [1, 3, 5, 7, 9]).map((g) => ({
          y: getYForGrade(g),
          label: `${g}등급`,
        }));

  const targetLineY =
    metricMode === 'SCORE' && targetScore
      ? getYForScore(targetScore)
      : metricMode === 'GRADE' && targetGrade
      ? getYForGrade(targetGrade)
      : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[500px] h-auto select-none bg-white rounded-xl border border-slate-200/80"
      >
        {gridLines.map((gl, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={gl.y}
              x2={width - padRight}
              y2={gl.y}
              stroke="#e2e8f0"
              strokeDasharray={idx === 0 ? '0' : '4 4'}
              strokeWidth="1"
            />
            <text
              x={padLeft - 10}
              y={gl.y + 3.5}
              textAnchor="end"
              className="fill-slate-400 text-[10px] font-bold tabular-nums"
            >
              {gl.label}
            </text>
          </g>
        ))}

        {/* 개인 목표 기준선 */}
        {targetLineY !== null && (
          <g>
            <line
              x1={padLeft}
              y1={targetLineY}
              x2={width - padRight}
              y2={targetLineY}
              stroke="#10b981"
              strokeDasharray="5 3"
              strokeWidth="1.5"
            />
            <text
              x={width - padRight - 6}
              y={targetLineY - 5}
              textAnchor="end"
              className="fill-emerald-700 text-[10px] font-extrabold"
            >
              나의 목표 ({metricMode === 'SCORE' ? `${targetScore}점` : `${targetGrade}등급`})
            </text>
          </g>
        )}

        {internalPath && (
          <path
            d={internalPath}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        )}

        {mockPath && (
          <path
            d={mockPath}
            fill="none"
            stroke="#d97706"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}

        {points.map((pt) => {
          const isSelected = pt.exam.id === selectedExamId;
          const isMock = pt.exam.exam_category === 'MOCK';
          const pointColor = isMock ? '#d97706' : '#4f46e5';

          return (
            <g
              key={pt.exam.id}
              onClick={() => onSelectExam && onSelectExam(pt.exam.id)}
              className="cursor-pointer"
            >
              {pt.primaryY !== null && (
                <g>
                  <circle
                    cx={pt.x}
                    cy={pt.primaryY}
                    r={isSelected ? '5.5' : '4.2'}
                    fill={pointColor}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <rect
                    x={pt.x - 22}
                    y={pt.primaryY - 24}
                    width="44"
                    height="15"
                    rx="4"
                    fill="#ffffff"
                    fillOpacity="0.92"
                    stroke={isSelected ? pointColor : '#e2e8f0'}
                    strokeWidth="1"
                  />
                  <text
                    x={pt.x}
                    y={pt.primaryY - 13}
                    textAnchor="middle"
                    className="text-[9.5px] font-black fill-slate-800 tabular-nums"
                  >
                    {pt.primaryLabel}
                  </text>
                </g>
              )}
              <text
                x={pt.x}
                y={bottomY + 18}
                textAnchor="middle"
                className={`text-[10px] ${
                  isSelected ? 'fill-indigo-700 font-black' : 'fill-slate-600 font-bold'
                }`}
              >
                {formatExamShortLabel(pt.exam)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

