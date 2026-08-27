'use client';

export default function HexagonRadarChart({ scores, twoWeekAvgScores }) {
  const {
    concept = 8,
    calc = 8,
    app = 8,
    attitude = 8,
    homework = 8,
    perseverance = 8
  } = scores || {};

  const labels = ['개념이해', '연산정확', '응용해결', '수업집중', '과제완성', '오답끈기'];
  const values = [concept, calc, app, attitude, homework, perseverance];

  const orangeValues = twoWeekAvgScores ? [
    twoWeekAvgScores.concept ?? 8,
    twoWeekAvgScores.calc ?? 8,
    twoWeekAvgScores.app ?? 8,
    twoWeekAvgScores.attitude ?? 8,
    twoWeekAvgScores.homework ?? 8,
    twoWeekAvgScores.perseverance ?? 8,
  ] : null;

  const center = 100;
  const radius = 62;

  const getCoordinates = (valArray, maxVal = 10) => {
    return valArray.map((val, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const r = (Math.max(0, Math.min(val, maxVal)) / maxVal) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2">
      <svg width="220" height="220" viewBox="0 0 200 200" className="overflow-visible">
        {/* 1. 배경 육각형 가이드라인 */}
        {gridLevels.map((level, idx) => (
          <polygon
            key={idx}
            points={getCoordinates([10, 10, 10, 10, 10, 10].map((v) => v * level))}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray={idx === 4 ? 'none' : '2 2'}
          />
        ))}

        {/* 2. 중심 방사선 */}
        {labels.map((_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
        })}

        {/* 3. 배경 채우기 (반투명 영역: 주황색 & 파란색 모두 비치도록 처리) */}
        {orangeValues && (
          <polygon
            points={getCoordinates(orangeValues)}
            fill="rgba(249, 115, 22, 0.18)"
          />
        )}
        <polygon
          points={getCoordinates(values)}
          fill="rgba(37, 99, 235, 0.18)"
        />

        {/* 4. 주황색 외곽선 (최근 2주 평균) - 굵은 점선 테두리 */}
        {orangeValues && (
          <polygon
            points={getCoordinates(orangeValues)}
            fill="none"
            stroke="#ea580c"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />
        )}

        {/* 5. 파란색 외곽선 (당일 성취도) - 굵은 실선 테두리 */}
        <polygon
          points={getCoordinates(values)}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
        />

        {/* 6. 주황색 꼭짓점 포인트 (흰색 테두리로 파란색 면 위에 있어도 선명하게 보임) */}
        {orangeValues && orangeValues.map((val, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const r = (Math.max(0, Math.min(val, 10)) / 10) * radius;
          const cx = center + r * Math.cos(angle);
          const cy = center + r * Math.sin(angle);
          return (
            <circle
              key={`orange-dot-${i}`}
              cx={cx}
              cy={cy}
              r="4"
              fill="#ea580c"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          );
        })}

        {/* 7. 파란색 꼭짓점 포인트 */}
        {values.map((val, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const r = (Math.max(0, Math.min(val, 10)) / 10) * radius;
          const cx = center + r * Math.cos(angle);
          const cy = center + r * Math.sin(angle);
          return (
            <circle
              key={`blue-dot-${i}`}
              cx={cx}
              cy={cy}
              r="4"
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          );
        })}

        {/* 8. 축 라벨 텍스트 */}
        {labels.map((label, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const labelRadius = radius + 20;
          const lx = center + labelRadius * Math.cos(angle);
          const ly = center + labelRadius * Math.sin(angle);
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-extrabold fill-slate-700 select-none"
            >
              {label} ({values[i]})
            </text>
          );
        })}
      </svg>

      {/* 범례 표시 */}
      <div className="flex items-center justify-center gap-3 text-[11px] font-bold pt-1">
        <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block border border-white"></span>
          <span className="text-blue-900">당일 성취도</span>
        </div>
        {orangeValues && (
          <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block border border-dashed border-orange-700"></span>
            <span className="text-orange-900">최근 2주 평균</span>
          </div>
        )}
      </div>
    </div>
  );
}
