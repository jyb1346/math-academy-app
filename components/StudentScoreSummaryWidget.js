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
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* 상단 깔끔한 화이트 헤더 */}
      <div className="bg-white border-b border-slate-100 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              나의 고교 수학 성적 추이 및 오답 분석 리포트
            </h2>
            {profile?.school_name && (
              <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-0.5 rounded-md">
                {profile.school_name} · 고{profile.school_grade || 1} ({gradeSystem}등급제)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            시험별 성취도와 6대 감점 원인(실수 보정 잠재 점수)을 점검하고 다음 시험 대비 전략을 확인하세요.
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
              className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition ${
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
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedExamId(ex.id)}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition shrink-0 ${
                  isSel
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black">
                    {formatExamShortLabel(ex)}
                  </span>
                  <span
                    className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                      isSel
                        ? 'bg-white/20 text-white'
                        : isMock
                        ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    }`}
                  >
                    {ex.raw_score !== null ? `${ex.raw_score}점` : '-'}
                    {ex.grade ? ` · ${ex.grade}등급` : ''}
                  </span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 font-semibold ${
                    isSel ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {ex.subject}
                </div>
              </button>
            );
          })}
        </div>

        {/* 선택된 시험 상세 지표 카드 3종 (통일된 화이트 카드 디자인) */}
        {activeExam && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 카드 1: 실전 원점수 및 산출 등급 */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      실전 원점수 및 등급
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 truncate">
                      {formatExamShortLabel(activeExam)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                      {activeExam.raw_score !== null ? `${activeExam.raw_score}점` : '-'}
                    </span>
                    {(activeExam.grade || posInfo?.actualGrade) && (
                      <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg tabular-nums">
                        {activeExam.grade || posInfo?.actualGrade}등급
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-3 pt-2.5 border-t border-slate-200/70 tabular-nums">
                  {posInfo?.topPct !== null && posInfo?.topPct !== undefined
                    ? `상위 ${posInfo.topPct}% ${
                        activeExam.rank && activeExam.total_students
                          ? `(${activeExam.rank}등 / ${activeExam.total_students}명)`
                          : ''
                      }`
                    : '석차 및 백분위 분석 데이터'}
                </p>
              </div>

              {/* 카드 2: 실수 보정 시 잠재 점수 */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      실수 보정 잠재 점수
                    </span>
                    {potInfo?.recoverableLost > 0 && (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-black px-2 py-0.5 rounded-md tabular-nums">
                        +{potInfo.recoverableLost}점 회복 가능
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums tracking-tight">
                      {potInfo?.potentialScore !== null && potInfo?.potentialScore !== undefined
                        ? `${potInfo.potentialScore}점`
                        : '-'}
                    </span>
                    {potInfo?.potentialGrade && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-lg tabular-nums">
                        잠재 {potInfo.potentialGrade}등급권
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-3 pt-2.5 border-t border-slate-200/70">
                  {potInfo?.recoverableLost > 0
                    ? '계산·발문·시간 실수만 줄여도 즉시 도달 가능한 성적입니다.'
                    : '아까운 실수 감점 없이 본인의 실력을 발휘한 시험입니다.'}
                </p>
              </div>

              {/* 카드 3: 등급 컷 여유도 및 상세 위치 */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      등급 컷 상세 위치 진단
                    </span>
                    {posInfo?.statusBadge && (
                      <span className="text-[11px] bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-black px-2 py-0.5 rounded-md">
                        {posInfo.statusBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-3 leading-relaxed">
                    {posInfo?.message || '등수·전교생 수 입력 시 상위 등급 진입 여유도가 표시됩니다.'}
                  </p>
                </div>
                <p className="text-[11px] font-medium text-slate-400 mt-3 pt-2.5 border-t border-slate-200/70">
                  {gradeSystem}등급제 기준 상대적 석차 위치 분석
                </p>
              </div>
            </div>

            {/* 6대 오답 감점 원인 및 직전 동종 시험 대비 변화 바 */}
            {potInfo?.totalRecordedLost > 0 && (
              <div className="bg-slate-50/60 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                  <h3 className="text-xs font-black text-slate-900">
                    오답 감점 원인별 비중 분석 (총 감점{' '}
                    <span className="text-rose-600 tabular-nums">
                      -{potInfo.totalRecordedLost}점
                    </span>
                    )
                  </h3>
                  {prevComparableExam && (
                    <span className="text-[11px] font-bold text-slate-500">
                      비교 기준: {formatExamShortLabel(prevComparableExam)}
                    </span>
                  )}
                </div>

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
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                                cat.recoverable
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                              }`}
                            >
                              {cat.recoverable ? '실수' : '실력'}
                            </span>
                            <span className="font-black text-slate-800 truncate">
                              {cat.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                            {diff !== null && diff !== 0 && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  diff < 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {diff > 0 ? `+${diff}점` : `${diff}점`}
                              </span>
                            )}
                            <span
                              className={`font-black ${
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

                {errorTrend?.insights && errorTrend.insights.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {errorTrend.insights.map((ins, i) => (
                      <p
                        key={i}
                        className="text-xs font-bold text-slate-800 bg-white border border-slate-200/90 px-3.5 py-2.5 rounded-xl"
                      >
                        {ins.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 담당 선생님 총평 코멘트 (깔끔한 화이트·슬레이트 콜아웃 카드) */}
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
