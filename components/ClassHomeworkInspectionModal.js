'use client';

import React, { useState, useMemo } from 'react';
import { parseEvaluationRecord, HOMEWORK_STATUS_OPTIONS } from '@/lib/evalUtils';

/**
 * 📋 반 전체 과제 일괄 검사표 모달
 * - [🌐 전체 누적 과제 통합 뷰]: 모든 날짜의 과제를 한눈에 모아서 검사
 * - [📅 특정 수업일자별 뷰]: 특정 수업일의 과제만 집중 검사
 * - 미완료/보완 필요 학생만 모아보기 필터링
 * - 미완료 학생 명단 원클릭 클립보드 복사
 * - 학생별 누적 미완료 과제 원클릭 일괄 완료 처리
 */
export default function ClassHomeworkInspectionModal({
  isOpen,
  onClose,
  selectedClass,
  classes = [],
  onSelectClass,
  students = [],
  classAllEvals = [],
  onStatusChange,
  onBulkUpdateStudentStatus,
  onBulkUpdateStudentAllPending,
  onOpenStudentModal,
  showToast,
}) {
  if (!isOpen) return null;

  // 1. 과제가 부여된 과거/현재 수업 날짜 목록 추출 (최신순 정렬)
  const availableDates = useMemo(() => {
    const datesMap = new Map();
    (classAllEvals || []).forEach((ev) => {
      const parsed = parseEvaluationRecord(ev);
      if (parsed.homeworkBooks && parsed.homeworkBooks.length > 0) {
        datesMap.set(ev.eval_date, (datesMap.get(ev.eval_date) || 0) + 1);
      }
    });

    return Array.from(datesMap.keys()).sort((a, b) => new Date(b) - new Date(a));
  }, [classAllEvals]);

  // 2. 검사 범위 필터: 'ALL' (모든 날짜 누적 통합) | 'YYYY-MM-DD' (특정 날짜)
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL');

  // 3. 필터 탭: 'ALL' (전체) | 'INCOMPLETE' (미완료/보완필요) | 'COMPLETED' (완료)
  const [filterTab, setFilterTab] = useState('ALL');

  // 4. 뷰 모드: 'CARDS' (학생별 카드 뷰) | 'TABLE' (엑셀 매트릭스 표 뷰)
  const [viewMode, setViewMode] = useState('CARDS');

  // 5. 검색어 (학생 이름)
  const [searchQuery, setSearchQuery] = useState('');

  // 6. 학생별 과제 데이터 집계 (전체 누적 또는 특정 날짜)
  const studentInspectionRows = useMemo(() => {
    if (!students || students.length === 0) return [];

    return students.map((st) => {
      const studentEvals = (classAllEvals || []).filter((e) => e.student_id === st.id);

      // 대상 평가 레코드들 결정
      let targetEvals = [];
      if (selectedDateFilter === 'ALL') {
        // 모든 날짜 중 과제가 있는 평가들을 최신순으로 정렬
        targetEvals = studentEvals
          .map((e) => ({ ...e, parsed: parseEvaluationRecord(e) }))
          .filter((e) => (e.parsed.homeworkBooks || []).length > 0)
          .sort((a, b) => new Date(b.eval_date) - new Date(a.eval_date));
      } else {
        const found = studentEvals.find((e) => e.eval_date === selectedDateFilter);
        if (found) {
          targetEvals = [{ ...found, parsed: parseEvaluationRecord(found) }];
        }
      }

      // 전체 과제 항목(Task) 목록 플랫화
      // [{ evalId, evalDate, formattedDate, bookName, range, status }]
      const allTasks = [];
      targetEvals.forEach((ev) => {
        const dateParts = (ev.eval_date || '').split('-');
        const formattedDate =
          dateParts.length >= 3 ? `${parseInt(dateParts[1], 10)}/${parseInt(dateParts[2], 10)}` : ev.eval_date;

        (ev.parsed.homeworkBooks || []).forEach((b) => {
          allTasks.push({
            evalId: ev.id,
            evalDate: ev.eval_date,
            formattedDate,
            bookName: b.name,
            range: b.range || '',
            status: b.status || '미체크',
          });
        });
      });

      const totalTasksCount = allTasks.length;
      const completedTasksCount = allTasks.filter((t) => t.status === '완료').length;
      const incompleteTasks = allTasks.filter(
        (t) => t.status === '미완료' || t.status === '일부완료' || t.status === '질문남음' || t.status === '미체크' || !t.status
      );
      const incompleteTasksCount = incompleteTasks.length;

      const hasTasks = totalTasksCount > 0;
      const allCompleted = hasTasks && incompleteTasksCount === 0;
      const hasIncomplete = incompleteTasksCount > 0;

      // 가장 최근 출결 상태
      const latestEval = studentEvals.sort((a, b) => new Date(b.eval_date) - new Date(a.eval_date))[0];

      return {
        student: st,
        attendanceStatus: latestEval?.attendance_status || 'ATTEND',
        targetEvals,
        allTasks,
        incompleteTasks,
        totalTasksCount,
        completedTasksCount,
        incompleteTasksCount,
        hasTasks,
        allCompleted,
        hasIncomplete,
      };
    });
  }, [students, classAllEvals, selectedDateFilter]);

  // 7. 통계 계산
  const stats = useMemo(() => {
    const totalStudents = studentInspectionRows.length;
    let completedCount = 0;
    let incompleteCount = 0;
    let noHomeworkCount = 0;
    let totalPendingTasks = 0;

    studentInspectionRows.forEach((row) => {
      totalPendingTasks += row.incompleteTasksCount;
      if (!row.hasTasks) {
        noHomeworkCount++;
      } else if (row.allCompleted) {
        completedCount++;
      } else {
        incompleteCount++;
      }
    });

    return { totalStudents, completedCount, incompleteCount, noHomeworkCount, totalPendingTasks };
  }, [studentInspectionRows]);

  // 8. 필터 및 검색 적용된 행 목록
  const filteredRows = useMemo(() => {
    return studentInspectionRows.filter((row) => {
      if (searchQuery.trim() && !row.student.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }
      if (filterTab === 'COMPLETED') {
        return row.hasTasks && row.allCompleted;
      }
      if (filterTab === 'INCOMPLETE') {
        return row.hasTasks && row.hasIncomplete;
      }
      return true;
    });
  }, [studentInspectionRows, filterTab, searchQuery]);

  // 9. 미완료자 명단 클립보드 복사 핸들러
  const handleCopyIncompleteStudents = () => {
    const incompleteRows = studentInspectionRows.filter((r) => r.hasTasks && r.hasIncomplete);

    if (incompleteRows.length === 0) {
      alert('🎉 현재 미완료 과제가 있는 학생이 없습니다!');
      return;
    }

    const className = selectedClass?.name || '해당 반';
    const isAllMode = selectedDateFilter === 'ALL';
    const scopeLabel = isAllMode ? '전체 누적' : `${selectedDateFilter}`;

    const lines = [
      `🚨 [${className}] ${scopeLabel} 과제 미완료 학생 명단 (총 ${incompleteRows.length}명 / 미완료 ${stats.totalPendingTasks}건)`,
      '----------------------------------------',
    ];

    incompleteRows.forEach((r) => {
      lines.push(`• ${r.student.name}:`);
      r.incompleteTasks.forEach((t) => {
        const dateTag = isAllMode ? `[${t.formattedDate}] ` : '';
        lines.push(`   - ${dateTag}${t.bookName}(${t.range}): ${t.status}`);
      });
    });

    lines.push('----------------------------------------');
    lines.push('※ 빠른 확인 및 다음 등원 전까지 과제 보완 부탁드립니다.');

    const textToCopy = lines.join('\n');
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        if (showToast) {
          showToast('📋 미완료 학생 명단이 클립보드에 복사되었습니다!');
        } else {
          alert('📋 미완료 학생 명단이 복사되었습니다!\n카카오톡 단체방이나 문자 메시지에 붙여넣기(Ctrl+V)하세요.');
        }
      })
      .catch(() => {
        prompt('아래 명단을 복사해 주세요:', textToCopy);
      });
  };

  // 10. 학생의 모든 누적 미완료 과제 일괄 완료 처리
  const handleCompleteAllForStudent = async (studentId, studentName) => {
    if (!studentId) return;
    if (onBulkUpdateStudentAllPending) {
      await onBulkUpdateStudentAllPending(studentId, '완료');
    } else if (onBulkUpdateStudentStatus) {
      const row = studentInspectionRows.find((r) => r.student.id === studentId);
      if (row && row.targetEvals.length > 0) {
        for (const ev of row.targetEvals) {
          await onBulkUpdateStudentStatus(ev.id, '완료');
        }
      }
    }
  };

  // 11. 엑셀 표(Matrix) 뷰를 위한 고유 날짜/교재 열(Columns) 목록 추출
  const matrixColumns = useMemo(() => {
    if (viewMode !== 'TABLE') return [];

    const colMap = new Map();
    studentInspectionRows.forEach((row) => {
      row.allTasks.forEach((task) => {
        const colKey = `${task.evalDate}_${task.bookName}`;
        if (!colMap.has(colKey)) {
          colMap.set(colKey, {
            key: colKey,
            evalDate: task.evalDate,
            formattedDate: task.formattedDate,
            bookName: task.bookName,
          });
        }
      });
    });

    // 날짜 최신순 정렬
    return Array.from(colMap.values()).sort(
      (a, b) => new Date(b.evalDate).getTime() - new Date(a.evalDate).getTime()
    );
  }, [studentInspectionRows, viewMode]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">📋</span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  <span>반 전체 과제 일괄 검사표</span>
                  {selectedClass && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {selectedClass.name}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {selectedDateFilter === 'ALL'
                    ? '📚 전체 기간 누적 통합 뷰: 날짜와 상관없이 학생들의 모든 과거/현재 과제를 한 번에 검사합니다.'
                    : `📅 [${selectedDateFilter}] 수업일 과제 집중 검사 모드입니다.`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 font-black text-xl p-1.5 rounded-xl hover:bg-slate-200 transition cursor-pointer"
              title="닫기"
            >
              ✕
            </button>
          </div>

          {/* 컨트롤 바: 반 선택 / 검사 범위(전체 or 날짜) / 뷰 모드 / 검색 */}
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 반 선택 */}
              {classes && classes.length > 1 && (
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">반:</span>
                  <select
                    value={selectedClass?.id || ''}
                    onChange={(e) => onSelectClass && onSelectClass(e.target.value)}
                    className="text-xs font-extrabold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 검사 범위: [🌐 전체 누적 통합] or [특정 수업일] */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shadow-2xs">
                <span className="text-xs font-bold text-indigo-900">검사 범위:</span>
                <select
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="text-xs font-black text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">🌐 전체 기간 (모든 과제 누적 통합)</option>
                  {availableDates.map((date, idx) => (
                    <option key={date} value={date}>
                      📅 {date} {idx === 0 ? '(최근 수업)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 뷰 모드 전환 버튼: 카드 뷰 vs 엑셀 표 뷰 */}
              <div className="flex items-center p-0.5 bg-slate-200/70 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('CARDS')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    viewMode === 'CARDS'
                      ? 'bg-white text-indigo-700 font-extrabold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="학생별 과제 카드 뷰"
                >
                  📑 카드 뷰
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('TABLE')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    viewMode === 'TABLE'
                      ? 'bg-white text-indigo-700 font-extrabold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="반 전체 엑셀 현황표 뷰"
                >
                  📊 엑셀 표 뷰
                </button>
              </div>
            </div>

            {/* 학생 검색 */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="학생 이름 검색..."
                className="w-36 sm:w-44 p-1.5 pl-7 bg-white border border-slate-200 rounded-xl text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
              />
              <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
            </div>
          </div>
        </div>

        {/* 통계 요약 바 & 필터 탭 */}
        <div className="px-4 sm:px-5 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* 필터 탭 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              전체 학생 ({stats.totalStudents}명)
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('INCOMPLETE')}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'INCOMPLETE'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <span>🚨 미완료 학생</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10.5px]">
                {stats.incompleteCount}명 ({stats.totalPendingTasks}건)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('COMPLETED')}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span>🟢 전체 완료</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px]">
                {stats.completedCount}명
              </span>
            </button>
          </div>

          {/* 우측 퀵 액션: 미완료자 명단 복사 */}
          <button
            type="button"
            onClick={handleCopyIncompleteStudents}
            className="px-3 py-1 text-xs font-extrabold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl shadow-2xs transition flex items-center gap-1 active:scale-95 cursor-pointer"
            title="미완료 학생 명단과 누적 교재 현황을 복사하여 알림 등에 활용합니다"
          >
            <span>📋</span>
            <span>미완료자 명단 복사</span>
          </button>
        </div>

        {/* 메인 내용: 뷰 모드에 따른 렌더링 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <span className="text-3xl">🎉</span>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                {filterTab === 'INCOMPLETE'
                  ? '현재 미완료 과제가 있는 학생이 없습니다! 모든 과제가 완료되었습니다.'
                  : filterTab === 'COMPLETED'
                  ? '아직 과제를 전체 완료한 학생이 없습니다.'
                  : '조건에 해당하는 학생이 없습니다.'}
              </p>
            </div>
          ) : viewMode === 'TABLE' ? (
            /* 📊 1. 엑셀 매트릭스 표 뷰 */
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse bg-white">
                <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 whitespace-nowrap min-w-[120px]">학생명</th>
                    <th className="p-3 text-center whitespace-nowrap min-w-[110px]">과제 달성률</th>
                    {matrixColumns.map((col) => (
                      <th key={col.key} className="p-2.5 text-center min-w-[140px] border-l border-slate-200/80">
                        <div className="font-extrabold text-slate-800 truncate" title={col.bookName}>
                          {col.bookName}
                        </div>
                        <div className="text-[10px] text-indigo-600 font-bold">
                          {col.formattedDate} 수업
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-center whitespace-nowrap min-w-[100px] border-l border-slate-200">
                      빠른 조작
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={row.student.id} className="hover:bg-slate-50/70 transition">
                      {/* 학생 이름 */}
                      <td className="p-3 font-black text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{row.student.name}</span>
                          {row.attendanceStatus === 'ABSENT' && (
                            <span className="text-[9.5px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-black">
                              결석
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 달성률 */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {row.hasTasks ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                              row.allCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.completedTasksCount}/{row.totalTasksCount}건
                            {row.allCompleted ? ' 🟢' : ' 🚨'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">과제 없음</span>
                        )}
                      </td>

                      {/* 각 날짜/교재별 셀 */}
                      {matrixColumns.map((col) => {
                        const task = row.allTasks.find(
                          (t) => t.evalDate === col.evalDate && t.bookName === col.bookName
                        );

                        if (!task) {
                          return (
                            <td key={col.key} className="p-2 text-center text-slate-300 border-l border-slate-100">
                              -
                            </td>
                          );
                        }

                        const currentStatus = task.status || '미체크';

                        return (
                          <td key={col.key} className="p-2 border-l border-slate-100">
                            <div className="space-y-1">
                              <div className="text-[10px] text-slate-500 font-bold text-center truncate">
                                {task.range || '범위 미지정'}
                              </div>
                              <div className="flex items-center justify-center gap-0.5">
                                {HOMEWORK_STATUS_OPTIONS.map((opt) => {
                                  const isSelected = currentStatus === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => onStatusChange && onStatusChange(task.evalId, task.bookName, opt.value)}
                                      className={`px-1 py-0.5 text-[9.5px] font-extrabold rounded transition ${
                                        isSelected
                                          ? opt.value === '완료'
                                            ? 'bg-emerald-600 text-white shadow-2xs font-black'
                                            : opt.value === '일부완료'
                                            ? 'bg-sky-500 text-white shadow-2xs font-black'
                                            : opt.value === '미완료'
                                            ? 'bg-rose-600 text-white shadow-2xs font-black'
                                            : opt.value === '질문남음'
                                            ? 'bg-amber-500 text-white shadow-2xs font-black'
                                            : 'bg-slate-700 text-white shadow-2xs'
                                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                                      }`}
                                      title={`${task.formattedDate} [${task.bookName}] 상태를 '${opt.value}'(으)로 변경`}
                                    >
                                      {opt.value === '일부완료' ? '일부' : opt.value === '질문남음' ? '질문' : opt.value}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        );
                      })}

                      {/* 빠른 조작 */}
                      <td className="p-3 text-center border-l border-slate-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {row.hasIncomplete && (
                            <button
                              type="button"
                              onClick={() => handleCompleteAllForStudent(row.student.id, row.student.name)}
                              className="text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-lg transition active:scale-95"
                              title="이 학생의 모든 미완료 과제를 완료로 변경"
                            >
                              ⚡ 모두 완료
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenStudentModal && onOpenStudentModal({ ...row.student, student_id: row.student.id })}
                            className="text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-lg transition"
                            title="개별 과제표 모달 열기"
                          >
                            과제표 ↗
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* 📑 2. 학생별 카드 뷰 (상세 리스트 형태) */
            <div className="space-y-3">
              {filteredRows.map((row) => (
                <div
                  key={row.student.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition space-y-3 ${
                    row.allCompleted
                      ? 'bg-emerald-50/40 border-emerald-200/90'
                      : row.hasIncomplete
                      ? 'bg-white border-rose-200/90 shadow-2xs hover:border-rose-300'
                      : 'bg-slate-50/60 border-slate-200 opacity-75'
                  }`}
                >
                  {/* 학생 헤더 행 */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-800">{row.student.name}</span>
                      <span className="text-[11px] text-slate-400 font-medium">({row.student.email})</span>

                      {row.attendanceStatus === 'ABSENT' ? (
                        <span className="text-[10.5px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700">
                          🔴 결석
                        </span>
                      ) : row.attendanceStatus === 'LATE' ? (
                        <span className="text-[10.5px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
                          ⚡ 지각
                        </span>
                      ) : null}

                      {/* 종합 상태 뱃지 */}
                      {!row.hasTasks ? (
                        <span className="text-[10.5px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          부여된 과제 없음
                        </span>
                      ) : row.allCompleted ? (
                        <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          <span>🟢</span>
                          <span>전체 완료 ({row.completedTasksCount}건)</span>
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-black text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          <span>🚨</span>
                          <span>
                            미완료 {row.incompleteTasksCount}건 / 완료 {row.completedTasksCount}건 (총 {row.totalTasksCount}건)
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* 누적 미완료 과제 일괄 완료 버튼 */}
                      {row.hasIncomplete && (
                        <button
                          type="button"
                          onClick={() => handleCompleteAllForStudent(row.student.id, row.student.name)}
                          className="text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl transition shadow-2xs active:scale-95"
                          title="이 학생의 모든 미완료 과제를 '완료 🟢' 상태로 일괄 변경합니다"
                        >
                          ⚡ 누적 과제 모두 완료
                        </button>
                      )}

                      {/* 개별 과제표 모달 열기 */}
                      <button
                        type="button"
                        onClick={() => onOpenStudentModal && onOpenStudentModal({ ...row.student, student_id: row.student.id })}
                        className="text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl transition shadow-2xs active:scale-95 flex items-center gap-0.5"
                        title="누적 과제표 및 상세 히스토리 보기"
                      >
                        <span>📑</span>
                        <span>과제표</span>
                      </button>
                    </div>
                  </div>

                  {/* 과제 태스크 리스트 (날짜 뱃지 + 교재 + 5개 상태 버튼) */}
                  {row.hasTasks ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      {row.allTasks.map((task, idx) => {
                        const currentStatus = task.status || '미체크';

                        return (
                          <div
                            key={`${task.evalId}_${task.bookName}_${idx}`}
                            className={`p-2.5 rounded-xl border transition space-y-1.5 ${
                              currentStatus === '완료'
                                ? 'bg-slate-50/70 border-slate-200'
                                : 'bg-white border-rose-200/90 shadow-2xs ring-1 ring-rose-100'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs gap-1.5">
                              <div className="flex items-center gap-1.5 truncate">
                                {/* 날짜 태그 (전체 누적 뷰일 때 매우 유용) */}
                                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 shrink-0">
                                  {task.formattedDate}
                                </span>
                                <span className="font-extrabold text-slate-800 truncate" title={task.bookName}>
                                  📖 {task.bookName}
                                </span>
                              </div>
                              <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[130px] shrink-0">
                                {task.range || '범위 미지정'}
                              </span>
                            </div>

                            {/* 5가지 상태 선택 버튼 바 (1클릭 변경) */}
                            <div className="grid grid-cols-5 gap-1 pt-0.5">
                              {HOMEWORK_STATUS_OPTIONS.map((opt) => {
                                const isSelected = currentStatus === opt.value;

                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => onStatusChange && onStatusChange(task.evalId, task.bookName, opt.value)}
                                    className={`py-1 text-[10.5px] font-extrabold rounded-lg border transition text-center cursor-pointer active:scale-95 ${
                                      isSelected
                                        ? opt.value === '완료'
                                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-300'
                                          : opt.value === '일부완료'
                                          ? 'bg-sky-500 text-white border-sky-600 shadow-xs ring-1 ring-sky-300'
                                          : opt.value === '미완료'
                                          ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-1 ring-rose-300'
                                          : opt.value === '질문남음'
                                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-1 ring-amber-300'
                                          : 'bg-slate-700 text-white border-slate-800 shadow-xs'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                    title={`${task.formattedDate} [${task.bookName}] 과제 상태를 '${opt.value}'(으)로 변경`}
                                  >
                                    {opt.value}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-medium py-1">
                      부여된 교재 과제 기록이 없습니다.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 모달 하단 닫기 바 */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 버튼을 누르면 DB에 즉시 반영되며, 학부모 리포트 및 일일 피드백 화면에 실시간 동기화됩니다.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-black bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-xs transition cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
