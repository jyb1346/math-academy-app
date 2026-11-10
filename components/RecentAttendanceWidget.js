'use client';

import { useMemo } from 'react';
import { getRecentAttendanceStats } from '@/lib/evalUtils';

export default function RecentAttendanceWidget({
  evaluations = [],
  baseDate = null,
  variant = 'student', // 'student' | 'parent'
  studentName = '',
}) {
  const stats = useMemo(() => {
    return getRecentAttendanceStats(evaluations, baseDate || undefined);
  }, [evaluations, baseDate]);

  if (!stats.hasData) {
    return null;
  }

  // 1️⃣ 학생 대시보드 뷰 (상단 강력 노출 & 경각심 강조)
  if (variant === 'student') {
    const isPerfect = stats.statusLevel === 'PERFECT';
    const isCaution = stats.statusLevel === 'CAUTION';
    const isWarning = stats.statusLevel === 'WARNING';

    const cardTheme = isPerfect
      ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border-emerald-500/40 text-white'
      : isCaution
      ? 'bg-gradient-to-br from-amber-950 via-slate-900 to-stone-900 border-amber-500/50 text-white'
      : 'bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950 border-rose-500/50 text-white';

    const badgeStyle = isPerfect
      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
      : isCaution
      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 animate-pulse'
      : 'bg-rose-500/25 text-rose-200 border border-rose-400/50 animate-pulse';

    return (
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-md space-y-4 transition-all ${cardTheme}`}>
        {/* 상단 타이틀 & 뱃지 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-white/10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">⏰</span>
            <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>최근 3주간 출결 & 지각 현황</span>
              <span className="text-[11px] font-bold text-slate-400">
                ({stats.periodLabel})
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-black px-3 py-1 rounded-full ${badgeStyle}`}>
              {isPerfect && '🔥 올출석 유지 중 (100%)'}
              {isCaution && '⚠️ 지각 1회 주의'}
              {isWarning && `🚨 지각 ${stats.lateCount}회 경고`}
            </span>
          </div>
        </div>

        {/* 핵심 통계 요약 박스 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-black/30 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-bold">정시 출석률</span>
            <span className={`text-xl sm:text-2xl font-black mt-1 ${isPerfect ? 'text-emerald-400' : isCaution ? 'text-amber-300' : 'text-rose-400'}`}>
              {stats.onTimeRate}%
            </span>
          </div>

          <div className="bg-black/30 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-bold">정상 출석</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
              {stats.attendCount}<span className="text-xs text-slate-300 font-bold ml-1">회</span>
            </span>
          </div>

          <div className="bg-black/30 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-bold">지각</span>
            <span className={`text-xl sm:text-2xl font-black mt-1 ${stats.lateCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {stats.lateCount}<span className="text-xs text-slate-300 font-bold ml-1">회</span>
            </span>
          </div>

          <div className="bg-black/30 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-bold">결석</span>
            <span className={`text-xl sm:text-2xl font-black mt-1 ${stats.absentCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {stats.absentCount}<span className="text-xs text-slate-300 font-bold ml-1">회</span>
            </span>
          </div>
        </div>

        {/* 수업 날짜별 타임라인 칩 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
            <span>수업일자별 출결 기록</span>
            <span className="text-[10.5px] text-slate-400">총 {stats.records.length}회</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {stats.records.map((r) => {
              const isLate = r.status === 'LATE';
              const isAbsent = r.status === 'ABSENT';

              let chipBorder = 'border-white/10 bg-white/5 text-slate-200';
              if (isLate) chipBorder = 'border-amber-400/60 bg-amber-500/20 text-amber-200 font-black shadow-xs shadow-amber-500/20';
              if (isAbsent) chipBorder = 'border-rose-400/60 bg-rose-500/20 text-rose-200 font-black shadow-xs shadow-rose-500/20';

              return (
                <div
                  key={r.id || r.date}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs whitespace-nowrap shrink-0 transition-all ${chipBorder}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.dotColor}`} />
                  <span className="font-bold">{r.dateShort}({r.dayOfWeek})</span>
                  <span className="text-[11px]">{r.statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 📢 경각심 메시지 & 부모님 리포트 연계 안내 */}
        <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 border border-white/15 space-y-1">
          <p className="text-xs sm:text-[13px] font-bold text-white leading-relaxed">
            {stats.studentMessage}
          </p>
          <p className="text-[11px] text-slate-300 flex items-center gap-1 font-semibold">
            <span>📱</span>
            <span>이 출결 현황은 학부모님께 발송되는 일일 피드백 리포트에도 실시간으로 함께 공유됩니다.</span>
          </p>
        </div>
      </div>
    );
  }

  // 2️⃣ 학부모 피드백 리포트 뷰 (신뢰감 & 단정하고 직관적인 디자인)
  return (
    <div className="mx-4 sm:mx-5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-700/80 space-y-3.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-1.5">
              <span>최근 3주간 출결 현황</span>
              <span className="text-[10.5px] font-semibold text-slate-400">
                (학부모 안심 기록)
              </span>
            </h4>
          </div>
        </div>
        <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md ${
          stats.statusLevel === 'PERFECT'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
            : stats.statusLevel === 'CAUTION'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
            : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
        }`}>
          정시 출석률 {stats.onTimeRate}%
        </span>
      </div>

      {/* 요약 현황 뱃지 바 */}
      <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 text-xs flex-wrap gap-2">
        <span className="text-[11px] text-slate-400 font-bold">
          {stats.periodLabel}
        </span>
        <div className="flex items-center gap-2 font-black text-xs">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            정상 {stats.attendCount}회
          </span>
          <span className="text-slate-500">|</span>
          <span className={`${stats.lateCount > 0 ? 'text-amber-400 font-black' : 'text-slate-300'} flex items-center gap-1`}>
            <span className={`w-2 h-2 rounded-full ${stats.lateCount > 0 ? 'bg-amber-400' : 'bg-slate-400'} inline-block`}></span>
            지각 {stats.lateCount}회
          </span>
          <span className="text-slate-500">|</span>
          <span className={`${stats.absentCount > 0 ? 'text-rose-400 font-black' : 'text-slate-300'} flex items-center gap-1`}>
            <span className={`w-2 h-2 rounded-full ${stats.absentCount > 0 ? 'bg-rose-400' : 'bg-slate-400'} inline-block`}></span>
            결석 {stats.absentCount}회
          </span>
        </div>
      </div>

      {/* 날짜별 출결 도트 칩 (자동 줄바꿈으로 모든 회차 한눈에 표시) */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {stats.records.map((r) => {
          const isLate = r.status === 'LATE';
          const isAbsent = r.status === 'ABSENT';

          let chipColor = 'bg-slate-800 border-slate-700 text-slate-300';
          if (isLate) chipColor = 'bg-amber-950/60 border-amber-400/60 text-amber-200 font-black';
          if (isAbsent) chipColor = 'bg-rose-950/60 border-rose-400/60 text-rose-200 font-black';

          return (
            <div
              key={r.id || r.date}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] whitespace-nowrap shrink-0 ${chipColor}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dotColor}`} />
              <span>{r.dateShort}({r.dayOfWeek})</span>
              <span className="text-[10.5px] opacity-90">{r.statusLabel}</span>
            </div>
          );
        })}
      </div>

      {/* 학부모 안내 멘트 */}
      <div className="bg-indigo-950/50 rounded-xl p-2.5 sm:p-3 border border-indigo-500/20 text-xs text-indigo-100 leading-relaxed font-semibold">
        {stats.parentMessage}
      </div>
    </div>
  );
}
