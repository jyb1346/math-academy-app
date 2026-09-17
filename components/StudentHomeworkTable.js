'use client';

import React, { useMemo, useState } from 'react';
import { parseEvaluationRecord, HOMEWORK_STATUS_OPTIONS } from '@/lib/evalUtils';

/**
 * 📊 학생별 진도 & 교재별 과제 체크표 (엑셀 과제표 + 일자별 카드 뷰)
 * @param {string} studentName - 학생 이름
 * @param {Array} evaluations - 학생의 일일 평가 레코드 목록
 * @param {boolean} isEditable - 선생님 수정 모드 활성화 여부
 * @param {Function} onStatusChange - (evalId, bookName, newStatus) => Promise<void>
 * @param {Function} onUpdateEvaluation - (evalId, updatedProgress, updatedBooks, testType, testScore) => Promise<void>
 * @param {Function} onDeleteEvaluation - (evalId, formattedDate) => Promise<void>
 */
export default function StudentHomeworkTable({
  studentName = '학생',
  evaluations = [],
  isEditable = false,
  currentUserId = null,
  userRole = null,
  onStatusChange,
  onUpdateEvaluation,
  onDeleteEvaluation,
}) {
  // 모달 수정 상태: { isOpen, evalId, rawDate, formattedDate, lessonProgress, books: [{ id, name, range, status }] }
  const [editingRow, setEditingRow] = useState(null);
  const [newBookNameInModal, setNewBookNameInModal] = useState('');
  const [showAddBookInModal, setShowAddBookInModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // 📜 이전 수업 기록 접기/펼치기 상태 (기본 6개 최근 수업만 노출)
  const [showAllRows, setShowAllRows] = useState(false);
  const DEFAULT_VISIBLE_COUNT = 6;

  // 🎯 뷰 모드: 'TABLE' (엑셀 표 뷰) | 'CARDS' (일자별 세로 카드 뷰)
  const [viewMode, setViewMode] = useState('TABLE');

  // 📌 최근 진행 중인 교재만 필터링 여부 (기본 true)
  const [onlyActiveBooks, setOnlyActiveBooks] = useState(true);

  // 1. 모든 평가 레코드에서 사용된 고유 교재명 목록 추출 및 최신 사용순 정렬
  const { tableRows, allBookNames, activeBookNames } = useMemo(() => {
    // 날짜 오름차순(과거 ➔ 최신순) 정렬
    const sortedEvals = [...evaluations].sort(
      (a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
    );

    // 각 교재별 가장 최근에 등장한 날짜 기록 { bookName: timestamp }
    const bookLatestTimestamp = {};
    const bookOrder = [];
    const rows = [];

    sortedEvals.forEach((ev) => {
      const parsed = parseEvaluationRecord(ev);
      const rowBooks = {};
      const evalTimestamp = new Date(ev.eval_date).getTime();

      (parsed.homeworkBooks || []).forEach((b) => {
        if (b.name && b.name.trim()) {
          const trimmedName = b.name.trim();
          if (!bookOrder.includes(trimmedName)) {
            bookOrder.push(trimmedName);
          }
          bookLatestTimestamp[trimmedName] = Math.max(
            bookLatestTimestamp[trimmedName] || 0,
            evalTimestamp
          );
          rowBooks[trimmedName] = {
            range: b.range || '-',
            status: b.status || '미체크',
          };
        }
      });

      // 날짜 포맷 (예: 2026-03-05 ➔ 3/5)
      const dateParts = (ev.eval_date || '').split('-');
      const formattedDate =
        dateParts.length >= 3
          ? `${parseInt(dateParts[1], 10)}/${parseInt(dateParts[2], 10)}`
          : ev.eval_date;
      const teacherName = ev.users?.name || ev.teacher_name || ev.teacher?.name || '';

      rows.push({
        id: ev.id,
        rawDate: ev.eval_date,
        formattedDate,
        teacherId: ev.teacher_id,
        teacherName,
        lessonProgress: parsed.lessonProgress || '-',
        testType: parsed.testType,
        testScore: parsed.testScore,
        rawHomeworkBooks: parsed.homeworkBooks || [],
        rowBooks,
      });
    });

    // ⚡ 최신 수업에 사용된 교재가 왼쪽(앞쪽)에 오도록 정렬
    const sortedAllBooks = [...bookOrder].sort(
      (a, b) => (bookLatestTimestamp[b] || 0) - (bookLatestTimestamp[a] || 0)
    );

    // 현재 표시되는 행(최근 N회)에서 실제 숙제가 부여된 교재 추출
    const recentRows = rows.slice(-DEFAULT_VISIBLE_COUNT);
    const activeSet = new Set();
    recentRows.forEach((r) => {
      Object.keys(r.rowBooks).forEach((bName) => {
        if (r.rowBooks[bName] && r.rowBooks[bName].range !== '-') {
          activeSet.add(bName);
        }
      });
    });

    const activeBooks = sortedAllBooks.filter((b) => activeSet.has(b));

    return {
      tableRows: rows,
      allBookNames: sortedAllBooks,
      activeBookNames: activeBooks.length > 0 ? activeBooks : sortedAllBooks,
    };
  }, [evaluations]);

  const hasMoreRows = tableRows.length > DEFAULT_VISIBLE_COUNT;
  const displayedRows = useMemo(() => {
    if (showAllRows || !hasMoreRows) {
      return tableRows;
    }
    return tableRows.slice(-DEFAULT_VISIBLE_COUNT);
  }, [tableRows, showAllRows, hasMoreRows]);

  // 표에 렌더링할 최종 교재 컬럼 목록 (진행 중 교재만 or 전체 교재)
  const displayedBookNames = useMemo(() => {
    if (onlyActiveBooks && activeBookNames.length > 0) {
      return activeBookNames;
    }
    return allBookNames;
  }, [onlyActiveBooks, activeBookNames, allBookNames]);

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

  // 모달 열기
  const handleOpenEditModal = (row) => {
    setEditingRow({
      evalId: row.id,
      rawDate: row.rawDate,
      formattedDate: row.formattedDate,
      teacherName: row.teacherName,
      lessonProgress: row.lessonProgress !== '-' ? row.lessonProgress : '',
      testType: row.testType || '단원평가',
      testScore: row.testScore && row.testScore !== '-' ? String(row.testScore) : '',
      books: (row.rawHomeworkBooks || []).map((b, idx) => ({
        id: `edit_book_${Date.now()}_${idx}`,
        name: b.name,
        range: b.range || '',
        status: b.status || '미체크',
      })),
    });
    setShowAddBookInModal(false);
    setNewBookNameInModal('');
  };

  // 모달 내 교재 추가
  const handleAddBookInModal = () => {
    const trimmed = newBookNameInModal.trim();
    if (!trimmed) return alert('교재명을 입력해 주세요.');
    if (editingRow.books.some((b) => b.name === trimmed)) {
      return alert('이미 존재하는 교재명입니다.');
    }
    setEditingRow((prev) => ({
      ...prev,
      books: [
        ...prev.books,
        { id: `book_${Date.now()}`, name: trimmed, range: '', status: '미체크' },
      ],
    }));
    setNewBookNameInModal('');
    setShowAddBookInModal(false);
  };

  // 모달 저장
  const handleSaveModal = async () => {
    if (!editingRow || !onUpdateEvaluation) return;

    setSavingEdit(true);
    try {
      const validBooks = editingRow.books
        .filter((b) => b.name && b.name.trim())
        .map((b) => ({
          name: b.name.trim(),
          range: (b.range || '').trim(),
          status: b.status || '미체크',
        }));

      await onUpdateEvaluation(
        editingRow.evalId,
        editingRow.lessonProgress.trim(),
        validBooks,
        editingRow.testType?.trim() || '단원평가',
        editingRow.testScore?.trim() || ''
      );
      setEditingRow(null);
    } catch (err) {
      console.error(err);
      alert('과제표 수정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingEdit(false);
    }
  };

  // 행 삭제
  const handleDeleteRow = async (row) => {
    if (
      !confirm(
        `[${studentName}] 학생의 ${row.formattedDate} (${row.rawDate}) 피드백 및 과제 기록을 정말 삭제하시겠습니까?\n\n⚠️ 삭제 후에는 복구할 수 없습니다.`
      )
    ) {
      return;
    }
    if (onDeleteEvaluation) {
      await onDeleteEvaluation(row.id, row.formattedDate);
    }
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
      {/* 표 상단 툴바 (제목 + 뷰 모드 전환 + 교재 필터 토글) */}
      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <span>📑</span>
            <span>{studentName} 과제표</span>
          </h3>
          {isEditable && (
            <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
              ⚡ 실시간 수정 가능
            </span>
          )}
        </div>

        {/* 뷰 모드 및 교재 필터 버튼 그룹 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 1. 진행 중 교재만 보기 필터 (엑셀 표 모드일 때) */}
          {viewMode === 'TABLE' && allBookNames.length > activeBookNames.length && (
            <button
              type="button"
              onClick={() => setOnlyActiveBooks(!onlyActiveBooks)}
              className={`text-xs font-black px-2.5 py-1 rounded-xl border transition flex items-center gap-1 ${
                onlyActiveBooks
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
              title="최근 수업에 나간 교재만 모아서 가로 스크롤을 대폭 줄입니다"
            >
              <span>{onlyActiveBooks ? '📌 진행 중 교재만' : '🌐 전체 교재 펼침'}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded-full ${
                onlyActiveBooks ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {onlyActiveBooks ? activeBookNames.length : allBookNames.length}권
              </span>
            </button>
          )}

          {/* 2. 뷰 모드 전환 토글 (표 ↔ 카드) */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-black">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                viewMode === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📊</span>
              <span>엑셀 표</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                viewMode === 'CARDS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📋</span>
              <span>일자별 카드</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. 📊 엑셀 스타일 테이블 뷰 (좌측 열 Sticky 고정 + 최신 교재 우선) */}
      {/* ========================================================= */}
      {viewMode === 'TABLE' && (
        <div className="relative overflow-x-auto rounded-xl border border-slate-300 shadow-xs bg-white">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-extrabold text-[11px] sm:text-xs">
                {/* 📌 1. 날짜 (Sticky Left 0) */}
                <th className="py-2.5 px-2 border-r border-slate-300 w-14 sm:w-16 min-w-[56px] sm:min-w-[64px] whitespace-nowrap sticky left-0 z-30 bg-slate-100">
                  날짜
                </th>
                {/* 📌 2. 진도 (Sticky Left 56px / 64px) */}
                <th className="py-2.5 px-3 border-r border-slate-300 w-[130px] sm:w-[150px] min-w-[130px] sm:min-w-[150px] text-left sticky left-[56px] sm:left-[64px] z-30 bg-slate-100">
                  진도
                </th>
                {/* 📌 3. 테스트 점수 (Sticky Left 186px / 214px) */}
                <th className="py-2.5 px-2 border-r-2 border-slate-400 w-[85px] sm:w-[95px] min-w-[85px] sm:min-w-[95px] whitespace-nowrap sticky left-[186px] sm:left-[214px] z-30 bg-amber-100 text-amber-950 font-black shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)]">
                  📝 테스트
                </th>

                {/* 📚 교재별 컬럼 (최신 사용 교재 순 정렬) */}
                {displayedBookNames.map((bName) => (
                  <th
                    key={bName}
                    colSpan={2}
                    className="py-2.5 px-2 border-r border-slate-300 min-w-[125px] sm:min-w-[140px] whitespace-nowrap bg-slate-50 text-slate-800"
                  >
                    <div className="truncate max-w-[180px] mx-auto" title={bName}>
                      {bName}
                    </div>
                  </th>
                ))}

                {/* ⚙️ 관리 버튼 컬럼 */}
                {isEditable && (
                  <th className="py-2.5 px-3 min-w-[120px] whitespace-nowrap bg-slate-200/80 text-slate-700">
                    관리
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, idx) => {
                const canEditThisRow =
                  isEditable && (!row.teacherId || row.teacherId === currentUserId);
                const isEven = idx % 2 === 1;
                const rowBg = isEven ? 'bg-slate-50/70' : 'bg-white';

                return (
                  <tr
                    key={row.id || idx}
                    className={`border-b border-slate-200 hover:bg-indigo-50/40 transition group ${rowBg}`}
                  >
                    {/* 📌 1. 날짜 & 담당 선생님 뱃지 (Sticky Left 0) */}
                    <td
                      className={`py-2.5 px-1 border-r border-slate-200 font-black text-slate-700 text-xs sm:text-sm whitespace-nowrap text-center sticky left-0 z-20 ${rowBg} group-hover:bg-indigo-50/90`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span>{row.formattedDate}</span>
                        {row.teacherName && (
                          <span className="inline-block mt-0.5 text-[9.5px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/90 px-1.5 py-0.2 rounded-md leading-tight whitespace-nowrap shadow-2xs">
                            {row.teacherName}T
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 📌 2. 진도 (Sticky Left 56px / 64px) */}
                    <td
                      className={`py-3 px-3 border-r border-slate-200 text-left font-bold text-slate-800 text-xs sm:text-sm sticky left-[56px] sm:left-[64px] z-20 ${rowBg} group-hover:bg-indigo-50/90`}
                    >
                      {row.lessonProgress && row.lessonProgress !== '-' ? (
                        <span className="text-slate-900 line-clamp-2">{row.lessonProgress}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 📌 3. 📝 테스트 점수 (Sticky Left 186px / 214px + 구분자 그림자) */}
                    <td
                      className={`py-3 px-1 border-r-2 border-slate-400 whitespace-nowrap text-center sticky left-[186px] sm:left-[214px] z-20 bg-amber-50/95 group-hover:bg-amber-100/90 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)]`}
                    >
                      {row.testScore &&
                      String(row.testScore).trim() &&
                      String(row.testScore).trim() !== '-' ? (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="inline-block bg-amber-100 text-amber-950 border border-amber-300/90 font-black px-1.5 py-0.5 rounded-lg text-[11px] shadow-2xs">
                            {String(row.testScore).includes('점')
                              ? row.testScore
                              : `${row.testScore}점`}
                          </span>
                          {row.testType && (
                            <span className="text-[9.5px] font-bold text-amber-800/80 leading-tight truncate max-w-[80px]">
                              {row.testType}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>

                    {/* 📚 교재별 과제 범위 & 체크 상태 */}
                    {displayedBookNames.map((bName) => {
                      const bookData = row.rowBooks[bName];
                      const hasData = Boolean(
                        bookData && bookData.range && bookData.range !== '-'
                      );

                      return (
                        <React.Fragment key={bName}>
                          {/* 과제 범위 */}
                          <td className="py-3 px-2 border-r border-slate-200 font-medium text-slate-700 text-xs whitespace-nowrap max-w-[120px] truncate">
                            {hasData ? (
                              bookData.range
                            ) : (
                              <span className="text-slate-200">-</span>
                            )}
                          </td>

                          {/* 체크 상태 드롭다운 / 뱃지 */}
                          <td className="py-3 px-1 border-r border-slate-200 min-w-[70px]">
                            {hasData ? (
                              canEditThisRow ? (
                                <select
                                  value={bookData.status || '미체크'}
                                  onChange={(e) =>
                                    onStatusChange?.(row.id, bName, e.target.value)
                                  }
                                  className={`text-[10px] font-black py-0.5 px-1 rounded border cursor-pointer transition shadow-2xs ${
                                    bookData.status === '완료'
                                      ? 'bg-emerald-600 text-white border-emerald-700'
                                      : bookData.status === '일부완료'
                                      ? 'bg-sky-500 text-white border-sky-600'
                                      : bookData.status === '미완료'
                                      ? 'bg-rose-600 text-white border-rose-700'
                                      : bookData.status === '질문남음'
                                      ? 'bg-amber-500 text-white border-amber-600'
                                      : 'bg-slate-100 text-slate-600 border-slate-300'
                                  }`}
                                  title="클릭하여 과제 상태를 즉시 변경할 수 있습니다"
                                >
                                  {HOMEWORK_STATUS_OPTIONS.map((opt) => (
                                    <option
                                      key={opt.value}
                                      value={opt.value}
                                      className="bg-white text-slate-900 font-bold"
                                    >
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                renderStatusBadge(bookData.status)
                              )
                            ) : (
                              <span className="text-slate-200">-</span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* ⚙️ 수정 / 삭제 버튼 */}
                    {isEditable && (
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        {canEditThisRow ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(row)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-1 rounded-lg transition shadow-2xs flex items-center gap-0.5"
                              title="이 날짜의 진도 및 교재별 과제 범위를 수정합니다"
                            >
                              <span>✏️</span>
                              <span>수정</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold px-2 py-1 rounded-lg transition shadow-2xs flex items-center gap-0.5"
                              title="이 날짜의 기록을 삭제합니다"
                            >
                              <span>🗑️</span>
                              <span>삭제</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                            🔒 타 강사
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. 📋 일자별 과제 카드 뷰 (가로 스크롤 완전 제거 모바일/고3 특화) */}
      {/* ========================================================= */}
      {viewMode === 'CARDS' && (
        <div className="space-y-3">
          {displayedRows.map((row, idx) => {
            const canEditThisRow =
              isEditable && (!row.teacherId || row.teacherId === currentUserId);
            const activeBooksInThisRow = (row.rawHomeworkBooks || []).filter(
              (b) => b.name && b.name.trim() && b.range && b.range !== '-'
            );

            return (
              <div
                key={row.id || idx}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 hover:border-indigo-300 transition"
              >
                {/* 카드 상단 헤더: 날짜, 강사, 테스트 점수, 관리 버튼 */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-2.5 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
                      📅 {row.formattedDate} ({row.rawDate})
                    </span>
                    {row.teacherName && (
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                        {row.teacherName}T
                      </span>
                    )}
                    {row.testScore &&
                      String(row.testScore).trim() &&
                      String(row.testScore).trim() !== '-' && (
                        <span className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span>📝 {row.testType || '테스트'}:</span>
                          <span>
                            {String(row.testScore).includes('점')
                              ? row.testScore
                              : `${row.testScore}점`}
                          </span>
                        </span>
                      )}
                  </div>

                  {/* 관리 버튼 */}
                  {isEditable && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canEditThisRow ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(row)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-indigo-200"
                          >
                            ✏️ 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-lg border border-rose-200"
                          >
                            🗑️ 삭제
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded">
                          🔒 타 강사
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 진도 내용 */}
                <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-indigo-600 font-black mr-1.5">🎯 진도:</span>
                  <span>{row.lessonProgress !== '-' ? row.lessonProgress : '기록 없음'}</span>
                </div>

                {/* 당일 부여된 교재 과제 리스트 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-slate-500 block">
                    📚 당일 부여된 과제 ({activeBooksInThisRow.length}개):
                  </span>
                  {activeBooksInThisRow.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-1">부여된 과제가 없습니다.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeBooksInThisRow.map((b, bIdx) => (
                        <div
                          key={bIdx}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex justify-between items-center gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-900 block truncate">
                              {b.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block truncate">
                              범위: {b.range || '-'}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {canEditThisRow ? (
                              <select
                                value={b.status || '미체크'}
                                onChange={(e) =>
                                  onStatusChange?.(row.id, b.name, e.target.value)
                                }
                                className={`text-[10px] font-black py-1 px-1.5 rounded-lg border cursor-pointer ${
                                  b.status === '완료'
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : b.status === '일부완료'
                                    ? 'bg-sky-500 text-white border-sky-600'
                                    : b.status === '미완료'
                                    ? 'bg-rose-600 text-white border-rose-700'
                                    : b.status === '질문남음'
                                    ? 'bg-amber-500 text-white border-amber-600'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {HOMEWORK_STATUS_OPTIONS.map((opt) => (
                                  <option
                                    key={opt.value}
                                    value={opt.value}
                                    className="bg-white text-slate-900 font-bold"
                                  >
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              renderStatusBadge(b.status)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📜 이전 수업 과제 기록 더보기 / 접기 버튼 */}
      {hasMoreRows && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowAllRows(!showAllRows)}
            className="w-full sm:w-auto text-xs font-black px-5 py-2.5 rounded-2xl border border-slate-300/80 bg-slate-50 hover:bg-slate-100 text-slate-700 shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>{showAllRows ? '🔼' : '📜'}</span>
            <span>
              {showAllRows
                ? `최근 ${DEFAULT_VISIBLE_COUNT}개 수업만 보기 (접기)`
                : `이전 수업 과제 기록 더보기 (총 ${tableRows.length}회 중 ${tableRows.length - DEFAULT_VISIBLE_COUNT}개 이전 수업) ▾`}
            </span>
          </button>
        </div>
      )}

      {/* 하단 상태 범례 */}
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

      {/* 🛠️ 과거 수업 진도 & 과제 빠른 수정 모달 */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            {/* 모달 헤더 */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>✏️</span>
                  <span>
                    {editingRow.formattedDate}{' '}
                    {editingRow.teacherName ? `(${editingRow.teacherName}T)` : ''} 수업 진도 및 과제
                    수정
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  과거에 잘못 등록된 진도 내용이나 숙제 범위를 바로잡습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* 진도 내용 수정 */}
            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700">
                🎯 {editingRow.formattedDate} 학습 진도:
              </label>
              <input
                type="text"
                value={editingRow.lessonProgress}
                onChange={(e) =>
                  setEditingRow({ ...editingRow, lessonProgress: e.target.value })
                }
                placeholder="예: 02. 항등식과 나머지정리 (p.24~31)"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 bg-slate-50 focus:bg-white"
              />
            </div>

            {/* 📝 테스트 점수 및 시험 종류 수정 */}
            <div className="grid grid-cols-2 gap-2.5 p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-amber-950">
                  📝 시험 종류:
                </label>
                <input
                  type="text"
                  value={editingRow.testType || ''}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, testType: e.target.value })
                  }
                  placeholder="예: 일일테스트, 단원평가"
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-amber-950">
                  💯 획득 점수:
                </label>
                <input
                  type="text"
                  value={editingRow.testScore || ''}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, testScore: e.target.value })
                  }
                  placeholder="예: 95점 / 100점 (없으면 빈칸)"
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-black text-amber-900 focus:outline-none"
                />
              </div>
            </div>

            {/* 교재별 과제 범위 및 상태 수정 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-700">
                  📚 부여된 교재 및 과제 범위:
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddBookInModal(!showAddBookInModal)}
                  className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200 transition"
                >
                  + 교재 추가
                </button>
              </div>

              {/* 모달 내 새 교재 추가 인라인 폼 */}
              {showAddBookInModal && (
                <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 flex gap-1.5 items-center animate-fade-in">
                  <input
                    type="text"
                    value={newBookNameInModal}
                    onChange={(e) => setNewBookNameInModal(e.target.value)}
                    placeholder="새 교재명 입력"
                    className="flex-1 p-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBookInModal();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddBookInModal}
                    className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shrink-0 shadow-xs"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBookInModal(false);
                      setNewBookNameInModal('');
                    }}
                    className="text-slate-400 text-xs px-1.5"
                  >
                    취소
                  </button>
                </div>
              )}

              {/* 교재 리스트 */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {editingRow.books.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    등록된 교재가 없습니다. (+ 교재 추가 버튼을 눌러보세요)
                  </p>
                ) : (
                  editingRow.books.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={b.name}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              books: editingRow.books.map((item) =>
                                item.id === b.id ? { ...item, name: e.target.value } : item
                              ),
                            })
                          }
                          className="text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1 w-32 focus:border-indigo-600 focus:outline-none"
                          placeholder="교재명"
                        />

                        {/* 상태 선택 드롭다운 */}
                        <select
                          value={b.status || '미체크'}
                          onChange={(e) =>
                            setEditingRow({
                              ...editingRow,
                              books: editingRow.books.map((item) =>
                                item.id === b.id ? { ...item, status: e.target.value } : item
                              ),
                            })
                          }
                          className="text-xs font-bold p-1 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none"
                        >
                          {HOMEWORK_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingRow({
                              ...editingRow,
                              books: editingRow.books.filter((item) => item.id !== b.id),
                            })
                          }
                          className="text-slate-400 hover:text-rose-500 font-bold text-xs p-1"
                          title="이 교재 삭제"
                        >
                          ✕
                        </button>
                      </div>

                      <input
                        type="text"
                        value={b.range}
                        onChange={(e) =>
                          setEditingRow({
                            ...editingRow,
                            books: editingRow.books.map((item) =>
                              item.id === b.id ? { ...item, range: e.target.value } : item
                            ),
                          })
                        }
                        placeholder="과제 범위 (예: p.10~25)"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={savingEdit}
                className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {savingEdit ? '저장 중...' : '💾 수정 완료 및 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
