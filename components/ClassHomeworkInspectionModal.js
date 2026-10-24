'use client';

import React, { useState, useMemo } from 'react';
import { parseEvaluationRecord, HOMEWORK_STATUS_OPTIONS, updateBookStatusInComment } from '@/lib/evalUtils';

/**
 * 📋 반 전체 과제 일괄 검사표 모달
 * - 반 전체 학생의 특정 수업일자 교재별 과제 상태를 한눈에 확인
 * - 원클릭으로 완료/미완료/일부완료 변경
 * - 미완료/보완 필요 학생만 모아보기 필터링
 * - 미완료 학생 명단 원클릭 클립보드 복사
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

  // 2. 현재 검사 대상 수업 일자 (기본값: 과제가 있는 가장 최근 날짜)
  const [targetDate, setTargetDate] = useState(() => {
    return availableDates.length > 0 ? availableDates[0] : '';
  });

  // availableDates가 변경되었을 때 targetDate 보정
  React.useEffect(() => {
    if (availableDates.length > 0 && (!targetDate || !availableDates.includes(targetDate))) {
      setTargetDate(availableDates[0]);
    }
  }, [availableDates, targetDate]);

  // 3. 필터 탭: 'ALL' (전체) | 'INCOMPLETE' (미완료/보완필요) | 'COMPLETED' (완료)
  const [filterTab, setFilterTab] = useState('ALL');

  // 4. 검색어 필터링 (학생 이름)
  const [searchQuery, setSearchQuery] = useState('');

  // 5. 학생별 해당 날짜 과제 데이터 집계
  const studentInspectionRows = useMemo(() => {
    if (!students || students.length === 0) return [];

    return students.map((st) => {
      // 선택된 날짜의 해당 학생 평가 레코드 찾기
      const studentEvals = (classAllEvals || []).filter((e) => e.student_id === st.id);
      const evalForDate = targetDate
        ? studentEvals.find((e) => e.eval_date === targetDate)
        : null;

      const parsed = evalForDate ? parseEvaluationRecord(evalForDate) : null;
      const books = parsed?.homeworkBooks || [];

      // 과제 완료 상태 판별
      const hasBooks = books.length > 0;
      const allCompleted = hasBooks && books.every((b) => b.status === '완료');
      const hasIncomplete = books.some(
        (b) => b.status === '미완료' || b.status === '일부완료' || b.status === '질문남음' || b.status === '미체크' || !b.status
      );

      const statusCount = {
        complete: books.filter((b) => b.status === '완료').length,
        partial: books.filter((b) => b.status === '일부완료').length,
        incomplete: books.filter((b) => b.status === '미완료').length,
        question: books.filter((b) => b.status === '질문남음').length,
        uncheck: books.filter((b) => !b.status || b.status === '미체크').length,
      };

      return {
        student: st,
        evalId: evalForDate?.id || null,
        attendanceStatus: evalForDate?.attendance_status || 'ATTEND',
        lessonProgress: parsed?.lessonProgress || '',
        books,
        hasBooks,
        allCompleted,
        hasIncomplete,
        statusCount,
      };
    });
  }, [students, classAllEvals, targetDate]);

  // 6. 통계 계산
  const stats = useMemo(() => {
    const totalStudents = studentInspectionRows.length;
    let completedCount = 0;
    let incompleteCount = 0;
    let noHomeworkCount = 0;

    studentInspectionRows.forEach((row) => {
      if (!row.hasBooks) {
        noHomeworkCount++;
      } else if (row.allCompleted) {
        completedCount++;
      } else {
        incompleteCount++;
      }
    });

    return { totalStudents, completedCount, incompleteCount, noHomeworkCount };
  }, [studentInspectionRows]);

  // 7. 필터 및 검색 적용된 행 목록
  const filteredRows = useMemo(() => {
    return studentInspectionRows.filter((row) => {
      // 검색어 필터
      if (searchQuery.trim() && !row.student.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }

      // 탭 필터
      if (filterTab === 'COMPLETED') {
        return row.hasBooks && row.allCompleted;
      }
      if (filterTab === 'INCOMPLETE') {
        return row.hasBooks && row.hasIncomplete;
      }
      return true;
    });
  }, [studentInspectionRows, filterTab, searchQuery]);

  // 8. 미완료자 명단 클립보드 복사 핸들러
  const handleCopyIncompleteStudents = () => {
    const incompleteRows = studentInspectionRows.filter((r) => r.hasBooks && r.hasIncomplete);

    if (incompleteRows.length === 0) {
      alert('🎉 현재 과제 미완료 학생이 없습니다!');
      return;
    }

    const className = selectedClass?.name || '해당 반';
    const lines = [
      `🚨 [${className}] ${targetDate || '과제'} 미완료 학생 명단 (총 ${incompleteRows.length}명)`,
      '----------------------------------------',
    ];

    incompleteRows.forEach((r) => {
      const bookDetails = r.books
        .map((b) => `${b.name}(${b.range || ''}): ${b.status || '미체크'}`)
        .join(', ');
      lines.push(`• ${r.student.name}: ${bookDetails}`);
    });

    lines.push('----------------------------------------');
    lines.push('※ 빠른 확인 및 다음 등원 전까지 과제 보완 부탁드립니다.');

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (showToast) {
        showToast('📋 미완료 학생 명단이 클립보드에 복사되었습니다!');
      } else {
        alert('📋 미완료 학생 명단이 복사되었습니다!\n카카오톡 단체방이나 문자 메시지에 붙여넣기(Ctrl+V)하세요.');
      }
    }).catch(() => {
      prompt('아래 명단을 복사해 주세요:', textToCopy);
    });
  };

  // 9. 특정 학생의 모든 교재 '완료 🟢' 일괄 변경
  const handleCompleteAllForStudent = async (evalId, studentName) => {
    if (!evalId) return;
    if (onBulkUpdateStudentStatus) {
      await onBulkUpdateStudentStatus(evalId, '완료');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 shrink-0">
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
                  반 소속 전체 학생의 교재별 숙제 수행 여부를 한눈에 확인하고 즉시 체크합니다.
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

          {/* 반 선택 & 검사 수업 일자 선택 & 검색창 */}
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 반 선택 (다른 반 전환 지원) */}
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

              {/* 검사 대상 수업 일자 선택 */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500">📅 검사할 수업일:</span>
                {availableDates.length > 0 ? (
                  <select
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="text-xs font-extrabold text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {availableDates.map((date, idx) => (
                      <option key={date} value={date}>
                        {date} {idx === 0 ? '(가장 최근)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-medium text-slate-400">과제 부여 기록 없음</span>
                )}
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
              전체 ({stats.totalStudents}명)
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
              <span>🚨 미완료/보완 필요</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10.5px]">
                {stats.incompleteCount}
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
              <span>🟢 완료</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px]">
                {stats.completedCount}
              </span>
            </button>
          </div>

          {/* 우측 퀵 액션: 미완료자 명단 복사 */}
          <button
            type="button"
            onClick={handleCopyIncompleteStudents}
            className="px-3 py-1 text-xs font-extrabold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl shadow-2xs transition flex items-center gap-1 active:scale-95"
            title="미완료 학생 명단과 교재 현황을 복사하여 알림 등에 활용합니다"
          >
            <span>📋</span>
            <span>미완료자 명단 복사</span>
          </button>
        </div>

        {/* 메인 내용: 학생별 교재 과제 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <span className="text-3xl">🎉</span>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                {filterTab === 'INCOMPLETE'
                  ? '현재 과제 미완료 학생이 없습니다! 모든 학생이 과제를 완료했습니다.'
                  : filterTab === 'COMPLETED'
                  ? '아직 과제를 완료한 학생이 없습니다.'
                  : '조건에 해당하는 학생이 없습니다.'}
              </p>
            </div>
          ) : (
            filteredRows.map((row) => (
              <div
                key={row.student.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition space-y-2.5 ${
                  row.allCompleted
                    ? 'bg-emerald-50/40 border-emerald-200/90'
                    : row.hasIncomplete
                    ? 'bg-white border-rose-200/90 shadow-2xs hover:border-rose-300'
                    : 'bg-slate-50/60 border-slate-200 opacity-75'
                }`}
              >
                {/* 1행: 학생명 + 상태 요약 뱃지 + 우측 액션 버튼들 */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
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
                    {!row.hasBooks ? (
                      <span className="text-[10.5px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        부여된 과제 없음
                      </span>
                    ) : row.allCompleted ? (
                      <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span>🟢</span>
                        <span>과제 전체 완료</span>
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span>🚨</span>
                        <span>
                          완료 {row.statusCount.complete}/{row.books.length}건
                          {row.statusCount.incomplete > 0 && ` (미완료 ${row.statusCount.incomplete})`}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 모두 완료 빠른 버튼 */}
                    {row.hasBooks && !row.allCompleted && (
                      <button
                        type="button"
                        onClick={() => handleCompleteAllForStudent(row.evalId, row.student.name)}
                        className="text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl transition shadow-2xs active:scale-95"
                        title="이 학생의 모든 교재 과제를 '완료 🟢' 상태로 변경합니다"
                      >
                        ⚡ 모두 완료
                      </button>
                    )}

                    {/* 개별 과제표 검사 모달 열기 */}
                    <button
                      type="button"
                      onClick={() => onOpenStudentModal && onOpenStudentModal({ ...row.student, student_id: row.student.id })}
                      className="text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl transition shadow-2xs active:scale-95 flex items-center gap-0.5"
                      title="누적 과제표 및 상세 히스토리 보기"
                    >
                      <span>📑</span>
                      <span>과제표</span>
                    </button>
                  </div>
                </div>

                {/* 2행: 교재별 과제 카드 & 5개 상태 원클릭 선택 버튼들 */}
                {row.hasBooks ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    {row.books.map((book) => {
                      const currentStatus = book.status || '미체크';

                      return (
                        <div
                          key={book.name}
                          className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-800 truncate" title={book.name}>
                              📖 {book.name}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                              {book.range || '범위 미지정'}
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
                                  onClick={() => onStatusChange && onStatusChange(row.evalId, book.name, opt.value)}
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
                                  title={`${book.name} 과제 상태를 '${opt.value}'(으)로 변경`}
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
                    이 날짜에는 부여된 교재 과제가 없습니다.
                  </div>
                )}
              </div>
            ))
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

