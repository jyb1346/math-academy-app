'use client';

import React, { useState } from 'react';

/**
 * 🧠 학생 학습 상태 AI 정밀 진단 카드 컴포넌트
 * - 출결 리듬 + 숙제 정시/지연 이행도 + 미완료 원인(태도/분량/난이도) + 최근 추세 + 성취도 교차 분석을 시각화
 */
export default function StudentDiagnosticCard({
  studentName = '학생',
  diagnostic,
  defaultExpanded = false,
  compact = false,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  if (!diagnostic || !diagnostic.hasData) {
    return null;
  }

  const { grade, headline, attendance, homework, causes, trend, achievement, details, actionItems, parentConsultScript } =
    diagnostic;

  const handleCopyConsultScript = (e) => {
    e.stopPropagation();
    const fullText = [
      `📊 [${studentName}] 학습 상태 정밀 진단 브리핑`,
      `• 종합 진단: ${grade.shortLabel} (${grade.badgeText})`,
      `• 출결 현황: 총 ${attendance.totalClasses}회 중 출석 ${attendance.attendCount}회 / 지각 ${attendance.lateCount}회 / 결석 ${attendance.absentCount}회 (출석률 ${attendance.attendanceRate}%)`,
      `• 과제 수행: 정시 완료율 ${homework.onTimeRate}% / 최종 완료율 ${homework.finalCompletionRate}% (미해결 ${homework.incompleteCount}건${homework.delayedCount > 0 ? `, 지연 완료 평균 +${homework.avgDelayDays}일` : ''})`,
      causes.totalNonOnTime > 0
        ? `• 미완료 주요 원인: ${causes.dominantCauseLabel} (미완료 ${causes.notStartedCount}건 / 일부완료 ${causes.partialCount}건 / 질문남음 ${causes.questionCount}건)`
        : `• 미완료 원인: 전 과제 정시 완수`,
      '',
      `💬 [학부모 상담 추천 멘트]`,
      parentConsultScript,
    ].join('\n');

    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        prompt('아래 브리핑 내용을 복사해 주세요:', fullText);
      });
  };

  // 상단 배경 테마 색상
  const containerTheme =
    grade.level === 'CRITICAL'
      ? 'bg-rose-50/70 border-rose-200'
      : grade.level === 'WARNING'
      ? 'bg-amber-50/70 border-amber-200'
      : grade.level === 'GOOD'
      ? 'bg-emerald-50/60 border-emerald-200'
      : 'bg-indigo-50/50 border-indigo-200';

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${containerTheme}`}>
      {/* 1. 상단 요약 헤더 바 (클릭 시 상세 접기/펼치기) */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 flex-wrap cursor-pointer hover:bg-white/40 transition select-none"
      >
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[240px]">
          <span className="text-xs font-black px-2.5 py-1 rounded-xl border shadow-2xs whitespace-nowrap bg-slate-900 text-white border-slate-800">
            🧠 AI 학습 진단
          </span>
          <span className={`text-xs font-black px-2.5 py-1 rounded-xl border whitespace-nowrap ${grade.colorClass}`}>
            {grade.badgeText}
          </span>
          <span className="text-xs font-extrabold text-slate-800 leading-snug">
            {headline}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 핵심 미니 수치 칩 (접혀 있을 때도 한눈에 보이도록) */}
          {!isExpanded && homework.evaluatedCount > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded-xl border border-slate-200/80">
              <span>정시 {homework.onTimeRate}%</span>
              <span className="text-slate-300">|</span>
              <span>최종 {homework.finalCompletionRate}%</span>
              <span className="text-slate-300">|</span>
              <span>출석 {attendance.attendanceRate}%</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyConsultScript}
            className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs transition cursor-pointer"
            title="학부모 상담용 정밀 분석 요약 및 추천 멘트를 복사합니다"
          >
            {copied ? '✅ 복사됨!' : '📋 상담 브리핑 복사'}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-white/90 hover:bg-white text-slate-700 border border-slate-200/90 shadow-2xs transition cursor-pointer"
          >
            {isExpanded ? '상세 닫기 ▲' : '정밀 분석 열기 ▼'}
          </button>
        </div>
      </div>

      {/* 2. 펼쳐졌을 때 나타나는 4대 정밀 지표 & 처방전 */}
      {isExpanded && (
        <div className="p-3.5 sm:p-4 pt-2 border-t border-slate-200/70 bg-white/90 space-y-3.5 text-xs">
          {/* 4대 핵심 지표 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* ① 숙제 타이밍 (정시 vs 지연 vs 미해결) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-700 flex items-center gap-1">
                  <span>⏱️</span>
                  <span>과제 적시성 (제때 했는가)</span>
                </span>
                <span className="text-[10.5px] font-bold text-slate-400">
                  검사 {homework.evaluatedCount}건 기준
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block">정시 완료율</span>
                  <span className="text-lg font-black text-emerald-700">{homework.onTimeRate}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10.5px] text-slate-500 font-bold block">최종 완료율</span>
                  <span className="text-lg font-black text-indigo-700">{homework.finalCompletionRate}%</span>
                </div>
              </div>

              {/* 3단 누적 진행 바 */}
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                {homework.onTimeRate > 0 && (
                  <div
                    style={{ width: `${homework.onTimeRate}%` }}
                    className="bg-emerald-500 h-full"
                    title={`정시 완료: ${homework.onTimeCount}건 (${homework.onTimeRate}%)`}
                  />
                )}
                {homework.delayedRate > 0 && (
                  <div
                    style={{ width: `${homework.delayedRate}%` }}
                    className="bg-sky-400 h-full"
                    title={`지연 완료: ${homework.delayedCount}건 (${homework.delayedRate}%)`}
                  />
                )}
                {homework.incompleteRate > 0 && (
                  <div
                    style={{ width: `${homework.incompleteRate}%` }}
                    className="bg-rose-500 h-full"
                    title={`미해결: ${homework.incompleteCount}건 (${homework.incompleteRate}%)`}
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600 pt-0.5">
                <span className="text-emerald-700">🟢 정시 {homework.onTimeCount}건</span>
                <span className="text-sky-700">
                  🔵 지연 {homework.delayedCount}건
                  {homework.delayedCount > 0 ? `(평균+${homework.avgDelayDays}일)` : ''}
                </span>
                <span className="text-rose-700">🔴 미완 {homework.incompleteCount}건</span>
              </div>
            </div>

            {/* ② 미완료의 질적 원인 분리 */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-700 flex items-center gap-1">
                  <span>🔍</span>
                  <span>미완료 원인 분류</span>
                </span>
                <span className="text-[10.5px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                  {causes.dominantCauseLabel}
                </span>
              </div>

              {causes.totalNonOnTime === 0 ? (
                <div className="py-3 text-center text-emerald-700 font-extrabold text-[11px]">
                  🎉 지연이나 미완료된 과제가 한 건도 없습니다!
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600">🔴 미착수/태도 (미완료)</span>
                    <span className="font-black text-rose-700">
                      {causes.notStartedCount}건 ({causes.notStartedPct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600">🔵 분량/시간부족 (일부완료)</span>
                    <span className="font-black text-sky-700">
                      {causes.partialCount}건 ({causes.partialPct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600">🟡 난이도/막힘 (질문남음)</span>
                    <span className="font-black text-amber-700">
                      {causes.questionCount}건 ({causes.questionPct}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ③ 출결 리듬 & 최근 추세 */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-700 flex items-center gap-1">
                  <span>📅</span>
                  <span>출결 리듬 & 최근 추세</span>
                </span>
                <span
                  className={`text-[10.5px] font-extrabold px-1.5 py-0.2 rounded ${
                    trend.trendDirection === 'DOWN'
                      ? 'bg-rose-100 text-rose-800'
                      : trend.trendDirection === 'UP'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {trend.trendDirection === 'DOWN'
                    ? `📉 최근 급락 (${trend.rateDelta}%p)`
                    : trend.trendDirection === 'UP'
                    ? `📈 최근 상승 (+${trend.rateDelta}%p)`
                    : '➡️ 흐름 유지'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">누적 출석률 ({attendance.totalClasses}회)</span>
                <span className="text-slate-900 font-black">
                  {attendance.attendanceRate}% (지각 {attendance.lateCount} · 결석 {attendance.absentCount})
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">최근 정시율 변화</span>
                <span className="text-indigo-800 font-black">
                  과거 {trend.pastOnTimeRate}% ➔ 최근 {trend.recentOnTimeRate}%
                </span>
              </div>

              <div className="text-[10.5px] font-bold text-slate-500 pt-0.5">
                {trend.consecutiveIncompleteSessions >= 2 ? (
                  <span className="text-rose-600 font-extrabold">
                    🚨 최근 {trend.consecutiveIncompleteSessions}회차 연속 정시 완료 미달
                  </span>
                ) : attendance.recentLateCount + attendance.recentAbsentCount > 0 ? (
                  <span className="text-amber-700 font-extrabold">
                    ⚡ 최근 4회차 내 지각/결석 {attendance.recentLateCount + attendance.recentAbsentCount}회 발생
                  </span>
                ) : (
                  <span className="text-emerald-700">✓ 최근 출결 및 과제 리듬 양호</span>
                )}
              </div>
            </div>

            {/* ④ 성취도 교차 검증 (형식적 숙제 탐지) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-700 flex items-center gap-1">
                  <span>🎯</span>
                  <span>숙제 × 성취도 교차검증</span>
                </span>
                <span
                  className={`text-[10.5px] font-extrabold px-1.5 py-0.2 rounded ${
                    achievement.isSuperficialSuspect
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {achievement.isSuperficialSuspect ? '🔍 소화도 점검' : '✅ 정상 연동'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">단원/주간 테스트 평균</span>
                <span className="text-slate-900 font-black">
                  {achievement.avgTestScore !== null ? `${achievement.avgTestScore}점` : '기록 없음'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">6대 역량 평가 평균</span>
                <span className="text-slate-900 font-black">
                  {achievement.avgCompetencyScore !== null ? `${achievement.avgCompetencyScore} / 10점` : '기록 없음'}
                </span>
              </div>

              <div className="text-[10.5px] font-bold text-slate-500 pt-0.5 leading-snug">
                {achievement.isSuperficialSuspect ? (
                  <span className="text-purple-800 font-extrabold">
                    ⚠️ 숙제 이행률 대비 테스트 성취도가 낮습니다 (풀이노트 확인 권장)
                  </span>
                ) : (
                  <span>과제 이행도와 수업 이해도가 일관되게 유지 중입니다.</span>
                )}
              </div>
            </div>
          </div>

          {/* 상세 서술 & 선생님 액션 플랜 & 학부모 상담 스크립트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
            {/* 좌측: 종합 정밀 해석 및 선생님 추천 지도 액션 */}
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
              <div className="font-black text-indigo-950 flex items-center gap-1.5">
                <span>💡</span>
                <span>선생님 맞춤 관리 가이드 (Action Plan)</span>
              </div>
              <ul className="space-y-1 text-[11.5px] text-slate-700 font-medium list-disc list-inside">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="font-bold text-slate-800">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-1.5 border-t border-indigo-100/80 text-[11px] text-slate-600 space-y-1 leading-relaxed">
                <p>• <strong className="text-slate-800">적시성 진단:</strong> {details.timelinessText}</p>
                <p>• <strong className="text-slate-800">원인 진단:</strong> {details.causeText}</p>
              </div>
            </div>

            {/* 우측: 학부모 상담용 데이터 브리핑 스크립트 */}
            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 flex flex-col justify-between space-y-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-950 flex items-center gap-1.5">
                    <span>📞</span>
                    <span>학부모 상담용 데이터 브리핑 멘트</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyConsultScript}
                    className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer"
                  >
                    {copied ? '✅ 복사 완료' : '멘트 복사'}
                  </button>
                </div>
                <p className="text-[11.5px] text-slate-800 font-semibold leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                  &ldquo;{parentConsultScript}&rdquo;
                </p>
              </div>
              <div className="text-[10.5px] text-slate-500 font-medium">
                ※ 출결·정시율·원인 분석 수치가 자동으로 반영된 맞춤형 상담 스크립트입니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
