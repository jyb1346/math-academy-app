'use client';

import React, { useMemo } from 'react';
import { parseEvaluationRecord } from '@/lib/evalUtils';

/**
 * 📊 학생별 진도 & 교재별 과제 체크표 (엑셀 과제표 뷰)
 */
export default function StudentHomeworkTable({ studentName = '학생', evaluations = [] }) {
  // 1. 모든 평가 레코드에서 사용된 고유 교재명 목록 추출 (순서 유지)
  const { tableRows, allBookNames } = useMemo(() => {
    // 날짜 오름차순(과거 ➔ 최신순) 정렬
    const sortedEvals = [...evaluations].sort(
      (a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
    );

    const bookOrder = [];
    const rows = [];

    sortedEvals.forEach((ev) => {
      const parsed = parseEvaluationRecord(ev);
      const rowBooks = {};

      (parsed.homeworkBooks || []).forEach((b) => {
        if (b.name && b.name.trim()) {
          const trimmedName = b.name.trim();
          if (!bookOrder.includes(trimmedName)) {
            bookOrder.push(trimmedName);
          }
          rowBooks[trimmedName] = {
            range: b.range || '-',
            status: b.status || '미체크',
          };
        }
      });

      // 날짜 포맷 (예: 2026-03-05 ➔ 3/5)
      const dateParts = (ev.eval_date || '').split('-');
      const formattedDate = dateParts.length >= 3 ? `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}` : ev.eval_date;

      rows.push({
        id: ev.id,
        rawDate: ev.eval_date,
        formattedDate,
        lessonProgress: parsed.lessonProgress || '-',
        testType: parsed.testType,
        testScore: parsed.testScore,
        rowBooks,
      });
    });

    return {
      tableRows: rows,
      allBookNames: bookOrder,
    };
  }, [evaluations]);

  const renderStatusBadge = (status) => {
    if (status === '완료') {
      return (
        <span className="inline-block bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none shadow-2xs whitespace-nowrap">
          완료
        </span>
      );
    }
    if (status === '일부완료') {
      return (
        <span className="inline-block bg-sky-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none shadow-2xs whitespace-nowrap">
          일부완료
        </span>
      );
    }
    if (status === '미완료') {
      return (
        <span className="inline-block bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none shadow-2xs whitespace-nowrap">
          미완료
        </span>
      );
    }
    if (status === '질문남음') {
      return (
        <span className="inline-block bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none shadow-2xs whitespace-nowrap">
          질문남음
        </span>
      );
    }
    return <span className="text-slate-300 text-[11px]">-</span>;
  };

  if (tableRows.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold">
        아직 등록된 진도 및 과제 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* 표 제목 */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-1.5">
        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
          <span>📑</span>
          <span>{studentName} 과제표</span>
        </h3>
        <span className="text-[11px] font-bold text-slate-500">
          총 {tableRows.length}회차 수업 누적 기록
        </span>
      </div>

      {/* 엑셀 스타일 반응형 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-xs bg-white">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-extrabold text-[11px] sm:text-xs">
              <th className="py-2.5 px-2 border-r border-slate-300 w-12 sm:w-14 whitespace-nowrap">
                날짜
              </th>
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[140px] text-left">
                진도
              </th>
              {allBookNames.map((bName) => (
                <th key={bName} colSpan={2} className="py-2.5 px-2 border-r border-slate-300 min-w-[120px]">
                  {bName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={`border-b border-slate-200 hover:bg-slate-50/80 transition ${
                  idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                }`}
              >
                {/* 1. 날짜 */}
                <td className="py-3 px-1 border-r border-slate-200 font-black text-slate-700 text-xs sm:text-sm whitespace-nowrap">
                  {row.formattedDate}
                </td>

                {/* 2. 진도 */}
                <td className="py-3 px-3 border-r border-slate-200 text-left font-bold text-slate-800 text-xs sm:text-sm">
                  {row.lessonProgress && row.lessonProgress !== '-' ? (
                    <span className="text-slate-900">{row.lessonProgress}</span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>

                {/* 3. 교재별 과제 범위 & 체크 뱃지 */}
                {allBookNames.map((bName) => {
                  const bookData = row.rowBooks[bName];
                  const hasData = Boolean(bookData && bookData.range && bookData.range !== '-');

                  return (
                    <React.Fragment key={bName}>
                      {/* 과제 범위 */}
                      <td className="py-3 px-2 border-r border-slate-200 font-medium text-slate-700 text-xs">
                        {hasData ? bookData.range : <span className="text-slate-300">-</span>}
                      </td>

                      {/* 체크 상태 뱃지 */}
                      <td className="py-3 px-1 border-r border-slate-200 w-14">
                        {hasData ? renderStatusBadge(bookData.status) : <span className="text-slate-200">-</span>}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 상태 범례 (교재가 있는 경우에만 표시) */}
      {allBookNames.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600 justify-end flex-wrap pt-1">
          <span className="text-slate-400 font-semibold">숙제 상태:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> 완료
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> 일부완료
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> 질문남음
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span> 미완료
          </span>
        </div>
      )}
    </div>
  );
}
