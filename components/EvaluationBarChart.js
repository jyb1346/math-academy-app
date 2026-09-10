'use client';

/**
 * 📊 모바일 최적화 가로 막대(Bar Gauge) 성취도 차트 컴포넌트
 * (선택된 기본 항목 + 선생님 커스텀 추가 항목을 단일 리스트로 깔끔하게 렌더링)
 */

export default function EvaluationBarChart({ items = [] }) {
  if (!items || items.length === 0) {
    return (
      <div className="w-full p-6 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-slate-200/80">
        등록된 세부 역량 평가 항목이 없습니다.
      </div>
    );
  }

  // 점수대별 맞춤 그라데이션 및 뱃지 색상
  const getScoreTheme = (score) => {
    if (score >= 9) {
      return {
        bar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    }
    if (score >= 7) {
      return {
        bar: 'bg-gradient-to-r from-blue-500 to-indigo-600',
        badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      };
    }
    if (score >= 5) {
      return {
        bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      bar: 'bg-gradient-to-r from-rose-400 to-red-500',
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
    };
  };

  return (
    <div className="w-full space-y-3.5 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
          <span>📊</span>
          <span>학습 역량별 성취도 분석 ({items.length}개 항목)</span>
        </span>
        <span className="text-[10.5px] font-bold text-slate-400">10점 만점 기준</span>
      </div>

      <div className="space-y-3 pt-1">
        {items.map((item, idx) => {
          const score = Number(item.score) || 0;
          const percentage = Math.min(Math.max((score / 10) * 100, 5), 100);
          const theme = getScoreTheme(score);

          return (
            <div key={item.key || item.name || idx} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>{item.icon || '📌'}</span>
                  <span>{item.name}</span>
                </span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-lg border shadow-2xs ${theme.badge}`}>
                  {score}점
                </span>
              </div>

              {/* 가로 프로그레스 게이지 바 */}
              <div className="w-full h-3 sm:h-3.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5 shadow-inner flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${theme.bar}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
