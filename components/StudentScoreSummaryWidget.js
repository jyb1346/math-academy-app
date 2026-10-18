'use client';

import { useState, useMemo } from 'react';
import {
  ERROR_REASON_CATEGORIES,
  getExamSortOrder,
  formatExamFullLabel,
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

  const gradeSystem = Number(profile?.grade_system) === 5 ? 5 : 9;

  const sortedExams = useMemo(() => {
    return [...(scores || [])].sort(
      (a, b) => getExamSortOrder(a) - getExamSortOrder(b)
    );
  }, [scores]);

  const filteredExams = useMemo(() => {
    if (selectedCategory === 'ALL') return sortedExams;
    return sortedExams.filter((e) => e.exam_category === selectedCategory);
  }, [sortedExams, selectedCategory]);

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
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* 상단 프리미엄 다크 헤더 */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black tracking-widest uppercase bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-md">
              ACADEMIC ANALYTICS
            </span>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              나의 고교 수학 성적 추이 & 패인 정밀 리포트
            </h2>
            {profile?.school_name && (
              <span className="text-[11px] bg-white/10 text-indigo-200 border border-white/15 font-extrabold px-2.5 py-0.5 rounded-full">
                {profile.school_name} · 고{profile.school_grade || 1} ({gradeSystem}등급제)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 font-medium mt-1">
            시험별 성취도와 6대 감점 패인(실수 보정 잠재 점수)을 점검하고 차기 시험 전략을 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'ALL', label: '전체' },
            { id: 'INTERNAL', label: '내신' },
            { id: 'MOCK', label: '모의고사' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`text-xs font-extrabold px-3 py-1 rounded-lg transition ${
                selectedCategory === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* 시험 선택 가로 칩 리스트 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filteredExams.map((ex) => {
            const isSel = activeExam?.id === ex.id;
            const isMock = ex.exam_category === 'MOCK';
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedExamId(ex.id)}
                className={`px-3.5 py-2.5 rounded-2xl border text-left transition shrink-0 ${
                  isSel
                    ? isMock
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black">
                    {formatExamShortLabel(ex)}
                  </span>
                  <span
                    className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                      isSel
                        ? 'bg-white/20 text-white'
                        : isMock
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-indigo-100 text-indigo-900'
                    }`}
                  >
                    {ex.raw_score !== null ? `${ex.raw_score}점` : '-'}
                    {ex.grade ? ` · ${ex.grade}등급` : ''}
                  </span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 font-semibold ${
                    isSel ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {ex.subject}
                </div>
              </button>
            );
          })}
        </div>

        {/* 선택된 시험 상세 KPI + 패인 분석 */}
        {activeExam && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 카드 1: 원점수 & 등급 */}
              <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 block">
                  01 · ACTUAL SCORE
                </span>
                <span className="text-xs font-extrabold text-slate-700 mt-0.5 block truncate">
                  {formatExamFullLabel(activeExam)}
                </span>
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                    {activeExam.raw_score !== null ? `${activeExam.raw_score}점` : '-'}
                  </span>
                  {(activeExam.grade || posInfo?.actualGrade) && (
                    <span className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-lg tabular-nums">
                      {activeExam.grade || posInfo?.actualGrade}등급
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-2 tabular-nums">
                  {posInfo?.topPct !== null && posInfo?.topPct !== undefined
                    ? `상위 ${posInfo.topPct}% ${
                        activeExam.rank && activeExam.total_students
                          ? `(${activeExam.rank}등 / ${activeExam.total_students}명)`
                          : ''
                      }`
                    : '석차/백분위 분석 데이터'}
                </p>
              </div>

              {/* 카드 2: 실수 보정 잠재 실력 (다크 에메랄드 하이라이트) */}
              <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white border border-emerald-800/60 rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-wider uppercase text-emerald-300">
                    02 · POTENTIAL SCORE
                  </span>
                  {potInfo?.recoverableLost > 0 && (
                    <span className="text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 font-black px-2 py-0.5 rounded-md tabular-nums">
                      +{potInfo.recoverableLost}점 회복 가능
                    </span>
                  )}
                </div>
                <span className="text-xs font-extrabold text-emerald-100 mt-0.5 block">
                  실수 보정 시 잠재 성취도
                </span>
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-300 tabular-nums">
                    {potInfo?.potentialScore !== null && potInfo?.potentialScore !== undefined
                      ? `${potInfo.potentialScore}점`
                      : '-'}
                  </span>
                  {potInfo?.potentialGrade && (
                    <span className="bg-emerald-400 text-slate-950 text-xs font-black px-2.5 py-1 rounded-lg tabular-nums">
                      잠재 {potInfo.potentialGrade}등급권
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-300 mt-2">
                  {potInfo?.recoverableLost > 0
                    ? '계산·발문·시간 실수만 교정해도 즉시 도달 가능한 점수입니다.'
                    : '아까운 실수 감점 없이 실력을 발휘한 시험입니다.'}
                </p>
              </div>

              {/* 카드 3: 등급 내 상세 위치 진단 */}
              <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-violet-600" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">
                    03 · CUTOFF POSITION
                  </span>
                  {posInfo?.statusBadge && (
                    <span className="text-[10px] bg-violet-50 border border-violet-200 text-violet-800 font-black px-2 py-0.5 rounded-md">
                      {posInfo.statusBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-800 mt-2.5 leading-snug">
                  {posInfo?.message || '등수·전교생 수 입력 시 등급 컷 분석이 제공됩니다.'}
                </p>
              </div>
            </div>

            {/* 6대 오답 패인 상세 & 직전 동종 시험 대비 비교 */}
            {potInfo?.totalRecordedLost > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-slate-900">
                    오답 패인 구조 분석 (분류된 총 감점{' '}
                    <span className="text-rose-600 tabular-nums">
                      -{potInfo.totalRecordedLost}점
                    </span>
                    )
                  </h3>
                  {prevComparableExam && (
                    <span className="text-[11px] font-bold text-slate-500">
                      직전 동종 시험({formatExamShortLabel(prevComparableExam)}) 대비 비교
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ERROR_REASON_CATEGORIES.map((cat) => {
                    const val = Number(activeExam.error_breakdown?.[cat.key]) || 0;
                    if (val <= 0) return null;
                    const prevVal = prevComparableExam
                      ? Number(prevComparableExam.error_breakdown?.[cat.key]) || 0
                      : null;
                    const diff =
                      prevVal !== null ? Number((val - prevVal).toFixed(1)) : null;

                    return (
                      <div
                        key={cat.key}
                        className={`px-3 py-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          cat.recoverable
                            ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <span className="font-bold truncate">{cat.shortLabel}</span>
                        <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                          <span className="font-black">-{val}점</span>
                          {diff !== null && diff !== 0 && (
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                diff < 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {errorTrend?.insights && errorTrend.insights.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {errorTrend.insights.map((ins, i) => (
                      <p
                        key={i}
                        className="text-xs font-bold text-indigo-950 bg-indigo-50/90 border border-indigo-200/80 px-3.5 py-2.5 rounded-xl"
                      >
                        {ins.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 담당 선생님 총평 코멘트 */}
            {activeExam.memo && (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded">
                    INSTRUCTOR PRESCRIPTION
                  </span>
                  <span className="font-black text-white">
                    담당 선생님 종합 진단 및 학습 처방
                  </span>
                </div>
                <p className="font-medium text-slate-200 leading-relaxed whitespace-pre-wrap">
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
