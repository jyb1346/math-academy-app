'use client';

import React, { useMemo, useState } from 'react';
import { parseEvaluationRecord, HOMEWORK_STATUS_OPTIONS } from '@/lib/evalUtils';

/**
 * 📊 학생별 진도 & 교재별 과제 체크표 (엑셀 과제표 뷰)
 * @param {string} studentName - 학생 이름
 * @param {Array} evaluations - 학생의 일일 평가 레코드 목록
 * @param {boolean} isEditable - 선생님 수정 모드 활성화 여부
 * @param {Function} onStatusChange - (evalId, bookName, newStatus) => Promise<void>
 * @param {Function} onUpdateEvaluation - (evalId, updatedProgress, updatedBooks) => Promise<void>
 */
export default function StudentHomeworkTable({
  studentName = '학생',
  evaluations = [],
  isEditable = false,
  onStatusChange,
  onUpdateEvaluation,
}) {
  // 모달 수정 상태: { isOpen, evalId, rawDate, formattedDate, lessonProgress, books: [{ id, name, range, status }] }
  const [editingRow, setEditingRow] = useState(null);
  const [newBookNameInModal, setNewBookNameInModal] = useState('');
  const [showAddBookInModal, setShowAddBookInModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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
        rawHomeworkBooks: parsed.homeworkBooks || [],
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

  // 모달 열기
  const handleOpenEditModal = (row) => {
    setEditingRow({
      evalId: row.id,
      rawDate: row.rawDate,
      formattedDate: row.formattedDate,
      lessonProgress: row.lessonProgress !== '-' ? row.lessonProgress : '',
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
        validBooks
      );
      setEditingRow(null);
    } catch (err) {
      console.error(err);
      alert('과제표 수정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingEdit(false);
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
      {/* 표 헤더 */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-1.5">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          {isEditable && (
            <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
              (표에서 상태를 바로 변경하거나 [✏️] 버튼으로 진도/범위를 수정할 수 있습니다)
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-500">
            총 {tableRows.length}회차 수업
          </span>
        </div>
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
                <th key={bName} colSpan={2} className="py-2.5 px-2 border-r border-slate-300 min-w-[130px]">
                  {bName}
                </th>
              ))}
              {isEditable && (
                <th className="py-2.5 px-2 w-14 whitespace-nowrap bg-slate-200/70 text-slate-700">
                  관리
                </th>
              )}
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

                {/* 3. 교재별 과제 범위 & 체크 드롭다운/뱃지 */}
                {allBookNames.map((bName) => {
                  const bookData = row.rowBooks[bName];
                  const hasData = Boolean(bookData && bookData.range && bookData.range !== '-');

                  return (
                    <React.Fragment key={bName}>
                      {/* 과제 범위 */}
                      <td className="py-3 px-2 border-r border-slate-200 font-medium text-slate-700 text-xs">
                        {hasData ? bookData.range : <span className="text-slate-300">-</span>}
                      </td>

                      {/* 체크 상태 (선생님 모드: 드롭다운 / 학부모 모드: 뱃지) */}
                      <td className="py-3 px-1 border-r border-slate-200 min-w-[70px]">
                        {hasData ? (
                          isEditable ? (
                            <select
                              value={bookData.status || '미체크'}
                              onChange={(e) => onStatusChange?.(row.id, bName, e.target.value)}
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

                {/* 4. 수정 액션 버튼 (선생님 모드) */}
                {isEditable && (
                  <td className="py-3 px-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(row)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2 py-1 rounded-lg transition shadow-2xs flex items-center gap-0.5 mx-auto"
                      title="이 날짜의 진도 및 교재별 과제 범위를 수정합니다"
                    >
                      <span>✏️</span>
                      <span>수정</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <span>✏️</span>
                  <span>{editingRow.formattedDate} 수업 진도 및 과제 수정</span>
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
