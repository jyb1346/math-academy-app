'use client';

import React, { useState } from 'react';

/**
 * 🧠 학생 학습 상태 AI 정밀 진단 카드 컴포넌트 (가독성 강화 2열 와이드 레이아웃)
 */
export default function StudentDiagnosticCard({
  studentName = '학생',
  diagnostic,
  defaultExpanded = false,
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

  const containerTheme =
    grade.level === 'CRITICAL'
      ? 'bg-rose-50/70 border-rose-200'
      : grade.level === 'WARNING'
      ? 'bg-amber-50/70 border-amber-200'
      : grade.level === 'GOOD'
      ? 'bg-emerald-50/60 border-emerald-200'
      : 'bg-indigo-50/50 border-indigo-200';

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden break-keep ${containerTheme}`}>
      {/* 1. 상단 요약 헤더 바 */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:bg-white/50 transition select-none"
      >
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[260px]">
          <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-900 text-white whitespace-nowrap">
            🧠 AI 학습 진단
          </span>
          <span className={`text-xs sm:text-[13px] font-black px-3 py-1 rounded-xl border whitespace-nowrap ${grade.colorClass}`}>
            {grade.badgeText}
          </span>
          <span className="text-[13px] sm:text-sm font-extrabold text-slate-800 leading-snug">
            {headline}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isExpanded && homework.evaluatedCount > 0 && (
            <div className="hidden xl:flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 whitespace-nowrap">
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
            className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs transition cursor-pointer whitespace-nowrap"
          >
            {copied ? '✅ 복사 완료!' : '📋 상담 브리핑 복사'}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer whitespace-nowrap"
          >
            {isExpanded ? '닫기 ▲' : '상세 보기 ▼'}
          </button>
        </div>
      </div>

      {/* 2. 상세 내용 (시원시원한 2열 와이드 그리드) */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 space-y-4">
          {/* 4대 지표: 좁은 4열 대신 넉넉한 2열(md:grid-cols-2) 배치로 글씨 깨짐 완벽 방지 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* ① 숙제 적시성 (제때 했는가 vs 밀려서 했는가) */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                  <span>⏱️</span>
                  <span>숙제 적시성 (제때 해왔는가)</span>
                </span>
                <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 whitespace-nowrap">
                  총 {homework.evaluatedCount}건 검사 기준
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-xs text-slate-500 font-bold block mb-0.5">첫 검사 정시 완료율</span>
                  <span className="text-2xl font-black text-emerald-600">{homework.onTimeRate}%</span>
                </div>
                <div className="border-l border-slate-100 pl-3">
                  <span className="text-xs text-slate-500 font-bold block mb-0.5">지연 포함 최종 완료율</span>
                  <span className="text-2xl font-black text-indigo-600">{homework.finalCompletionRate}%</span>
                </div>
              </div>

              {/* 3단 누적 바 */}
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                {homework.onTimeRate > 0 && (
                  <div
                    style={{ width: `${homework.onTimeRate}%` }}
                    className="bg-emerald-500 h-full"
                    title={`정시 완료: ${homework.onTimeCount}건`}
                  />
                )}
                {homework.delayedRate > 0 && (
                  <div
                    style={{ width: `${homework.delayedRate}%` }}
                    className="bg-sky-400 h-full"
                    title={`지연 완료: ${homework.delayedCount}건`}
                  />
                )}
                {homework.incompleteRate > 0 && (
                  <div
                    style={{ width: `${homework.incompleteRate}%` }}
                    className="bg-rose-500 h-full"
                    title={`미해결: ${homework.incompleteCount}건`}
                  />
                )}
              </div>

              {/* 하단 건수 배지 (줄바꿈 깨짐 방지) */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-extrabold pt-0.5">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                  🟢 제때 완료 {homework.onTimeCount}건
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap">
                  🔵 지연 완료 {homework.delayedCount}건
                  {homework.delayedCount > 0 ? ` (평균 +${homework.avgDelayDays}일)` : ''}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
                  🔴 미해결 {homework.incompleteCount}건
                </span>
              </div>
            </div>

            {/* ② 미완료 원인 분석 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                  <span>🔍</span>
                  <span>왜 제때 못 해왔는가 (원인 분류)</span>
                </span>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                  {causes.dominantCauseLabel}
                </span>
              </div>

              {causes.totalNonOnTime === 0 ? (
                <div className="my-auto py-6 text-center bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-800 font-extrabold text-sm">
                  🎉 모든 숙제를 제때 완수하여 지연/미완료 내역이 없습니다!
                </div>
              ) : (
                <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200/80">
                  {/* 미완료 (태도) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-[13px]">
                      <span className="font-bold text-slate-700 whitespace-nowrap">🔴 아예 안 폄 / 태도 문제 (미완료)</span>
                      <span className="font-black text-rose-700 whitespace-nowrap">
                        {causes.notStartedCount}건 ({causes.notStartedPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${causes.notStartedPct}%` }} className="bg-rose-500 h-full" />
                    </div>
                  </div>

                  {/* 일부완료 (분량) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-[13px]">
                      <span className="font-bold text-slate-700 whitespace-nowrap">🔵 풀다 멈춤 / 분량·시간 부족 (일부완료)</span>
                      <span className="font-black text-sky-700 whitespace-nowrap">
                        {causes.partialCount}건 ({causes.partialPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${causes.partialPct}%` }} className="bg-sky-500 h-full" />
                    </div>
                  </div>

                  {/* 질문남음 (난이도) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-[13px]">
                      <span className="font-bold text-slate-700 whitespace-nowrap">🟡 어려워서 막힘 / 난이도 문제 (질문남음)</span>
                      <span className="font-black text-amber-700 whitespace-nowrap">
                        {causes.questionCount}건 ({causes.questionPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${causes.questionPct}%` }} className="bg-amber-500 h-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ③ 출결 리듬 & 최근 추세 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                  <span>📅</span>
                  <span>출결 리듬 & 최근 흐름 변화</span>
                </span>
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg whitespace-nowrap ${
                    trend.trendDirection === 'DOWN'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : trend.trendDirection === 'UP'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
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

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2.5 text-xs sm:text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600 whitespace-nowrap">누적 출석 현황 (총 {attendance.totalClasses}회)</span>
                  <span className="font-black text-slate-900 whitespace-nowrap">
                    출석 {attendance.attendCount}회 · 지각 {attendance.lateCount}회 · 결석 {attendance.absentCount}회
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-600 whitespace-nowrap">정시 완료율 추세 비교</span>
                  <span className="font-black text-indigo-700 whitespace-nowrap">
                    과거 평균 {trend.pastOnTimeRate}% ➔ 최근 {trend.recentOnTimeRate}%
                  </span>
                </div>
              </div>

              <div className="text-xs font-extrabold px-1">
                {trend.consecutiveIncompleteSessions >= 2 ? (
                  <span className="text-rose-600">
                    🚨 최근 {trend.consecutiveIncompleteSessions}회 수업 연속으로 제때 완료하지 못하고 있습니다.
                  </span>
                ) : attendance.recentLateCount + attendance.recentAbsentCount > 0 ? (
                  <span className="text-amber-700">
                    ⚡ 최근 4회 수업 내 지각/결석이 {attendance.recentLateCount + attendance.recentAbsentCount}회 발생했습니다.
                  </span>
                ) : (
                  <span className="text-emerald-700">✓ 최근 출결 및 과제 수행 리듬이 안정적입니다.</span>
                )}
              </div>
            </div>

            {/* ④ 숙제 × 실전 테스트 성취도 교차검증 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                  <span>🎯</span>
                  <span>숙제 이행도 × 테스트 성적 비교</span>
                </span>
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg whitespace-nowrap ${
                    achievement.isSuperficialSuspect
                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {achievement.isSuperficialSuspect ? '🔍 형식적 숙제 의심' : '✅ 정상 소화 중'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2.5 text-xs sm:text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600 whitespace-nowrap">단원 / 주간 테스트 평균</span>
                  <span className="font-black text-slate-900 text-sm whitespace-nowrap">
                    {achievement.avgTestScore !== null ? `${achievement.avgTestScore}점` : '기록 없음'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-600 whitespace-nowrap">6대 역량 평가 평균</span>
                  <span className="font-black text-slate-900 text-sm whitespace-nowrap">
                    {achievement.avgCompetencyScore !== null ? `${achievement.avgCompetencyScore} / 10점` : '기록 없음'}
                  </span>
                </div>
              </div>

              <div className="text-xs font-extrabold px-1 leading-relaxed">
                {achievement.isSuperficialSuspect ? (
                  <span className="text-purple-800">
                    ⚠️ 숙제 완료율은 높지만 테스트 점수가 낮습니다. 답지 베끼기나 오답 미흡 여부를 확인해 주세요.
                  </span>
                ) : (
                  <span className="text-slate-600">과제 수행 결과가 실제 수업 이해도로 잘 이어지고 있습니다.</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. 하단: 선생님 관리 가이드 & 학부모 상담 추천 멘트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pt-1">
            {/* 좌측: 선생님 관리 가이드 */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2.5">
              <div className="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                <span>💡</span>
                <span>선생님 추천 지도 방향</span>
              </div>
              <ul className="space-y-1.5 text-[13px] text-slate-800 font-bold list-disc list-inside leading-relaxed">
                {actionItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <div className="pt-2 border-t border-indigo-200/60 text-xs text-slate-600 space-y-1 leading-relaxed font-medium">
                <p>• <strong className="text-slate-800">적시성 요약:</strong> {details.timelinessText}</p>
                <p>• <strong className="text-slate-800">원인 요약:</strong> {details.causeText}</p>
              </div>
            </div>

            {/* 우측: 학부모 상담 멘트 */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 flex flex-col justify-between space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-amber-950 flex items-center gap-1.5">
                    <span>📞</span>
                    <span>학부모 상담용 추천 브리핑 멘트</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyConsultScript}
                    className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs transition cursor-pointer whitespace-nowrap"
                  >
                    {copied ? '✅ 복사 완료' : '📋 멘트 복사'}
                  </button>
                </div>
                <p className="text-[13px] text-slate-800 font-bold leading-relaxed bg-white p-3.5 rounded-xl border border-amber-200/80">
                  &ldquo;{parentConsultScript}&rdquo;
                </p>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                ※ 학생의 실제 출결·정시율·원인 분석 수치가 자동 반영된 상담 문구입니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
