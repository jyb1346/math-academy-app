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
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              📈 나의 고교 수학 성적 추이 & 패인 분석 리포트
            </h2>
            {profile?.school_name && (
              <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold px-2.5 py-0.5 rounded-full">
                🏫 {profile.school_name} · 고{profile.school_grade || 1} ({gradeSystem}등급제)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            시험별 원점수·등급 추이와 6대 오답 패인(실수 보정 잠재 점수)을 확인하고 다음 시험 약점을 보완하세요.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'ALL', label: '전체' },
            { id: 'INTERNAL', label: '내신' },
            { id: 'MOCK', label: '모의고사' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`text-xs font-extrabold px-2.5 py-1 rounded-lg transition ${
                selectedCategory === tab.id
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 시험 선택 가로 칩 리스트 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filteredExams.map((ex) => {
          const isSel = activeExam?.id === ex.id;
          const isMock = ex.exam_category === 'MOCK';
          return (
            <button
              key={ex.id}
              onClick={() => setSelectedExamId(ex.id)}
              className={`px-3.5 py-2 rounded-2xl border text-left transition shrink-0 ${
                isSel
                  ? isMock
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black">
                  {formatExamShortLabel(ex)}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    isSel
                      ? 'bg-white/20 text-white'
                      : isMock
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {ex.raw_score !== null ? `${ex.raw_score}점` : '-'}
                  {ex.grade ? ` · ${ex.grade}등급` : ''}
                </span>
              </div>
              <div
                className={`text-[10px] mt-0.5 font-semibold ${
                  isSel ? 'text-white/85' : 'text-slate-400'
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
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 카드 1: 원점수 & 등급 */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500">
                  📌 {formatExamFullLabel(activeExam)}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {activeExam.raw_score !== null ? `${activeExam.raw_score}점` : '-'}
                </span>
                {(activeExam.grade || posInfo?.actualGrade) && (
                  <span className="text-sm font-black text-indigo-600">
                    ({activeExam.grade || posInfo?.actualGrade}등급)
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-600 mt-1.5">
                {posInfo?.topPct !== null && posInfo?.topPct !== undefined
                  ? `상위 ${posInfo.topPct}% ${
                      activeExam.rank && activeExam.total_students
                        ? `(${activeExam.rank}등 / ${activeExam.total_students}명)`
                        : ''
                    }`
                  : '석차/백분위 정보'}
              </p>
            </div>

            {/* 카드 2: 실수 보정 잠재 실력 */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-800">
                  ✨ 실수 보정 잠재 실력
                </span>
                {potInfo?.recoverableLost > 0 && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-md">
                    +{potInfo.recoverableLost}점 회복 가능
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-950">
                  {potInfo?.potentialScore !== null && potInfo?.potentialScore !== undefined
                    ? `${potInfo.potentialScore}점`
                    : '-'}
                </span>
                {potInfo?.potentialGrade && (
                  <span className="text-sm font-black text-emerald-700">
                    (잠재 {potInfo.potentialGrade}등급)
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-emerald-800 mt-1.5">
                {potInfo?.recoverableLost > 0
                  ? '계산·발문·서술형·시간부족 실수만 잡아도 즉시 도달 가능한 점수입니다!'
                  : '비실력성 실수 감점이 거의 없습니다. 훌륭합니다!'}
              </p>
            </div>

            {/* 카드 3: 상위 등급 컷까지 남은 거리 */}
            <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-indigo-800">
                  🎯 등급 내 상세 위치 진단
                </span>
                {posInfo?.statusBadge && (
                  <span className="text-[10px] bg-white border border-indigo-200 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md">
                    {posInfo.statusBadge}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-800 mt-2 leading-snug">
                {posInfo?.message || '등수·전교생 수 입력 시 등급 컷 분석이 제공됩니다.'}
              </p>
            </div>
          </div>

          {/* 6대 오답 패인 상세 & 직전 동종 시험 대비 비교 */}
          {potInfo?.totalRecordedLost > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-black text-slate-800">
                  🔍 이번 시험 오답 패인 분석 (총 감점 -{potInfo.totalRecordedLost}점)
                </h3>
                {prevComparableExam && (
                  <span className="text-[11px] font-bold text-slate-600">
                    직전 동종 시험({formatExamShortLabel(prevComparableExam)}) 대비 비교
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                      className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between ${
                        cat.recoverable
                          ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="font-bold truncate">
                        {cat.shortLabel} {cat.recoverable ? '🌟' : ''}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black">-{val}점</span>
                        {diff !== null && diff !== 0 && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
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
                      className="text-xs font-bold text-indigo-900 bg-indigo-50/80 border border-indigo-200/80 px-3 py-2 rounded-xl"
                    >
                      💡 {ins.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 담당 선생님 총평 코멘트 */}
          {activeExam.memo && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-xs">
              <span className="font-black text-amber-950">
                👨‍🏫 담당 선생님 총평 및 학습 처방:
              </span>
              <p className="font-semibold text-slate-800 mt-1 leading-relaxed">
                {activeExam.memo}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

