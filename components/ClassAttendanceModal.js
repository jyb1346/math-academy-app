'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getTodayKstDateString, isEvalMatchingClass } from '@/lib/evalUtils';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 📋 반별 출석부 & 지각 관리 엑셀 매트릭스 모달
 * - 반별 / 전체 반 학생들의 수업일자별 출석·지각(분)·결석 현황을 스프레드시트 형태로 한눈에 조회
 * - 최근 3주 / 1개월 / 2개월 / 전체 누적 기간 필터 지원
 * - 지각/결석 학생 집중 필터 및 엑셀(TSV) 원클릭 클립보드 복사
 * - 셀 클릭 시 즉시 출결 상태 변경(정상 ↔ 지각 ↔ 결석) 지원
 */
export default function ClassAttendanceModal({
  isOpen,
  onClose,
  initialClassId = 'ALL',
  classes = [],
  students = [],
  user = null,
}) {
  const [selectedClassId, setSelectedClassId] = useState(initialClassId || 'ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('3WEEKS'); // '3WEEKS' | '1MONTH' | '2MONTHS' | 'ALL'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LATE_OR_ABSENT' | 'PERFECT'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalStudents, setModalStudents] = useState(Array.isArray(students) ? students : []);
  const [evaluations, setEvaluations] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { evalId, studentId, studentName, evalDate, currentStatus, currentMinutes }
  const [toastMsg, setToastMsg] = useState('');
  const popoverRef = useRef(null);

  // 모달이 열릴 때 초기 반 세팅
  useEffect(() => {
    if (isOpen) {
      const targetClass = initialClassId || 'ALL';
      setSelectedClassId(targetClass);
      if (Array.isArray(students) && students.length > 0) {
        setModalStudents(students);
      }
      fetchClassData(targetClass);
    }
  }, [isOpen, initialClassId, students]);

  // 반 변경 시 데이터 조회
  const fetchClassData = async (classId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eval/class/${classId}`);
      if (!res.ok) throw new Error('출결 데이터를 불러오지 못했습니다.');
      const data = await res.json();
      if (Array.isArray(data.students)) {
        setModalStudents(data.students);
      }
      setEvaluations(data.evaluations || []);
    } catch (err) {
      console.error(err);
      showToast('출결 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClass = (newClassId) => {
    setSelectedClassId(newClassId);
    setEditingCell(null);
    fetchClassData(newClassId);
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // 1. 해당 반에 소속된 학생 목록 (API에서 반별로 자동 필터링되어 제공됨)
  const enrolledStudents = useMemo(() => {
    const list = Array.isArray(modalStudents) ? [...modalStudents] : [];
    // 이름순(가나다) 정렬
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [modalStudents]);

  // 2. 수업 일자 목록 추출 및 기간 필터링
  const availableDates = useMemo(() => {
    const datesSet = new Set();
    const enrolledIds = new Set(enrolledStudents.map((s) => s.id));

    (evaluations || []).forEach((ev) => {
      if (selectedClassId !== 'ALL' && !isEvalMatchingClass(ev, selectedClassId, user?.id)) {
        return;
      }
      if (ev.eval_date && (selectedClassId === 'ALL' || enrolledIds.has(ev.student_id))) {
        datesSet.add(ev.eval_date);
      }
    });

    const allSorted = Array.from(datesSet).sort((a, b) => a.localeCompare(b)); // 오래된 순 -> 최신 순(오른쪽)

    const todayStr = getTodayKstDateString();
    const todayTime = new Date(todayStr + 'T00:00:00').getTime();

    if (dateRangeFilter === '3WEEKS') {
      const cutoff = new Date(todayTime - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const filtered = allSorted.filter((d) => d >= cutoff);
      return filtered.length >= 3 ? filtered : allSorted.slice(-8);
    }
    if (dateRangeFilter === '1MONTH') {
      const cutoff = new Date(todayTime - 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const filtered = allSorted.filter((d) => d >= cutoff);
      return filtered.length >= 4 ? filtered : allSorted.slice(-12);
    }
    if (dateRangeFilter === '2MONTHS') {
      const cutoff = new Date(todayTime - 62 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return allSorted.filter((d) => d >= cutoff);
    }

    return allSorted;
  }, [evaluations, enrolledStudents, selectedClassId, dateRangeFilter]);

  // 3. 학생별 + 날짜별 출결 데이터 매핑 & 개별 통계 집계
  const studentMatrixRows = useMemo(() => {
    // eval_date -> student_id -> evaluation
    const dateStudentMap = {};
    (evaluations || []).forEach((ev) => {
      if (selectedClassId !== 'ALL' && !isEvalMatchingClass(ev, selectedClassId, user?.id)) {
        return;
      }
      if (!dateStudentMap[ev.eval_date]) {
        dateStudentMap[ev.eval_date] = {};
      }
      const existing = dateStudentMap[ev.eval_date][ev.student_id];
      if (!existing || ev.attendance_status === 'LATE' || (ev.attendance_status === 'ABSENT' && existing.attendance_status !== 'LATE')) {
        dateStudentMap[ev.eval_date][ev.student_id] = ev;
      }
    });

    const rows = enrolledStudents.map((st) => {
      let attendCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let totalRecorded = 0;
      let lateMinutesTotal = 0;

      const dateMap = {};

      availableDates.forEach((date) => {
        const ev = dateStudentMap[date] ? dateStudentMap[date][st.id] : null;
        if (ev) {
          totalRecorded += 1;
          const status = ev.attendance_status || 'ATTEND';
          const mins = status === 'LATE' ? (parseInt(ev.lateness_minutes, 10) || 5) : 0;
          if (status === 'LATE') {
            lateCount += 1;
            lateMinutesTotal += mins;
          } else if (status === 'ABSENT') {
            absentCount += 1;
          } else {
            attendCount += 1;
          }

          dateMap[date] = {
            id: ev.id,
            status,
            latenessMinutes: mins,
            teacherId: ev.teacher_id,
          };
        } else {
          dateMap[date] = null;
        }
      });

      const onTimeRate = totalRecorded > 0 ? Math.round((attendCount / totalRecorded) * 100) : 100;
      const hasIssues = lateCount > 0 || absentCount > 0;
      const isPerfect = totalRecorded > 0 && lateCount === 0 && absentCount === 0;

      return {
        student: st,
        dateMap,
        attendCount,
        lateCount,
        absentCount,
        totalRecorded,
        lateMinutesTotal,
        onTimeRate,
        hasIssues,
        isPerfect,
      };
    });

    // 검색어 및 상태 필터 적용
    return rows.filter((row) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = (row.student.name || '').toLowerCase().includes(q);
        const matchesPhone = (row.student.parent_phone || '').includes(q);
        if (!matchesName && !matchesPhone) return false;
      }

      if (statusFilter === 'LATE_OR_ABSENT') {
        return row.hasIssues;
      }
      if (statusFilter === 'PERFECT') {
        return row.isPerfect;
      }

      return true;
    });
  }, [enrolledStudents, availableDates, evaluations, searchQuery, statusFilter]);

  // 4. 날짜별(열 기준) 반 전체 출결 합계 집계 (표 하단 요약용)
  const columnTotals = useMemo(() => {
    return availableDates.map((date) => {
      let attend = 0;
      let late = 0;
      let absent = 0;
      let total = 0;

      studentMatrixRows.forEach((row) => {
        const cell = row.dateMap[date];
        if (cell) {
          total += 1;
          if (cell.status === 'LATE') late += 1;
          else if (cell.status === 'ABSENT') absent += 1;
          else attend += 1;
        }
      });

      const onTimePct = total > 0 ? Math.round((attend / total) * 100) : 0;
      return { date, attend, late, absent, total, onTimePct };
    });
  }, [availableDates, studentMatrixRows]);

  // 5. 반 전체 KPI 요약
  const overallKPI = useMemo(() => {
    let totalSessions = availableDates.length;
    let totalAttends = 0;
    let totalLates = 0;
    let totalAbsents = 0;
    let totalRecords = 0;
    let totalLateMinutes = 0;

    studentMatrixRows.forEach((r) => {
      totalAttends += r.attendCount;
      totalLates += r.lateCount;
      totalAbsents += r.absentCount;
      totalRecords += r.totalRecorded;
      totalLateMinutes += r.lateMinutesTotal;
    });

    const avgOnTimeRate = totalRecords > 0 ? Math.round((totalAttends / totalRecords) * 100) : 100;
    return {
      totalSessions,
      totalStudents: studentMatrixRows.length,
      totalAttends,
      totalLates,
      totalAbsents,
      totalLateMinutes,
      avgOnTimeRate,
    };
  }, [availableDates, studentMatrixRows]);

  // 6. 셀 클릭 시 인라인 출결 빠른 수정
  const handleCellClick = (student, date, cell) => {
    setEditingCell({
      evalId: cell ? cell.id : null,
      studentId: student.id,
      studentName: student.name,
      evalDate: date,
      currentStatus: cell ? cell.status : 'ATTEND',
      currentMinutes: cell ? cell.latenessMinutes : 5,
    });
  };

  const handleUpdateStatus = async (newStatus, latenessMins = 0) => {
    if (!editingCell) return;
    const { evalId, studentId, evalDate, studentName } = editingCell;

    try {
      if (evalId) {
        // 기존 레코드 업데이트
        const res = await fetch(`/api/eval/${evalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendance_status: newStatus,
            lateness_minutes: newStatus === 'LATE' ? latenessMins : 0,
          }),
        });

        if (!res.ok) throw new Error('수정에 실패했습니다.');
      } else {
        // 신규 평가 레코드 등록 (기존 평가가 없던 날짜)
        const res = await fetch('/api/eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            evalDate,
            payload: {
              attendance_status: newStatus,
              lateness_minutes: newStatus === 'LATE' ? latenessMins : 0,
              teacher_comment: '',
            },
          }),
        });

        if (!res.ok) throw new Error('등록에 실패했습니다.');
      }

      // 로컬 evaluations 상태 즉시 낙관적 업데이트
      setEvaluations((prev) => {
        const foundIndex = prev.findIndex(
          (e) => e.student_id === studentId && e.eval_date === evalDate
        );
        const updatedRecord = {
          ...(foundIndex >= 0 ? prev[foundIndex] : {}),
          id: evalId || `temp_${Date.now()}`,
          student_id: studentId,
          eval_date: evalDate,
          attendance_status: newStatus,
          lateness_minutes: newStatus === 'LATE' ? latenessMins : 0,
        };

        if (foundIndex >= 0) {
          const next = [...prev];
          next[foundIndex] = updatedRecord;
          return next;
        } else {
          return [...prev, updatedRecord];
        }
      });

      const label = newStatus === 'LATE' ? `${latenessMins}분 지각` : newStatus === 'ABSENT' ? '결석' : '정상 출석';
      showToast(`${studentName} 학생 [${evalDate}] 출결이 '${label}'(으)로 반영되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('출결 변경에 실패했습니다.');
    } finally {
      setEditingCell(null);
    }
  };

  // 7. 엑셀(TSV) 클립보드 복사 기능
  const handleCopyExcel = () => {
    if (studentMatrixRows.length === 0) return alert('복사할 출결 데이터가 없습니다.');

    // 헤더 행 생성
    const headerRow = [
      '학생명',
      '소속반',
      ...availableDates.map((d) => `${d}(${DAY_NAMES[new Date(d + 'T00:00:00').getDay()] || ''})`),
      '정시출석률',
      '정상출석',
      '지각',
      '결석',
      '총수업',
    ];

    const dataRows = studentMatrixRows.map((row) => {
      const dateCols = availableDates.map((d) => {
        const cell = row.dateMap[d];
        if (!cell) return '-';
        if (cell.status === 'LATE') return `지각(${cell.latenessMinutes}분)`;
        if (cell.status === 'ABSENT') return '결석';
        return '정상';
      });

      const className = classes.find((c) => c.id === row.student.classId)?.name || '담당반';

      return [
        row.student.name || '학생',
        className,
        ...dateCols,
        `${row.onTimeRate}%`,
        row.attendCount,
        row.lateCount,
        row.absentCount,
        row.totalRecorded,
      ];
    });

    const tsvContent = [headerRow.join('\t'), ...dataRows.map((r) => r.join('\t'))].join('\n');

    navigator.clipboard.writeText(tsvContent).then(
      () => {
        showToast('📋 출석부가 클립보드에 복사되었습니다! 엑셀(Ctrl+V)에 바로 붙여넣으세요.');
      },
      () => {
        alert('클립보드 복사에 실패했습니다.');
      }
    );
  };

  if (!isOpen) return null;

  const currentClassName =
    selectedClassId === 'ALL'
      ? '전체 반'
      : classes.find((c) => String(c.id) === String(selectedClassId))?.name || '선택된 반';

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-1 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white w-full max-w-7xl h-full sm:h-[94vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* 1️⃣ 모달 상단 헤더 (모바일 초슬림화) */}
        <div className="bg-slate-900 text-white px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-xl shrink-0">📋</span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black tracking-tight text-white truncate">
                [{currentClassName}] 출석부 & 지각 관리 엑셀표
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-black px-2.5 sm:px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
              title="클립보드 복사 후 엑셀에 Ctrl+V로 붙여넣기"
            >
              <span>📑</span>
              <span className="hidden sm:inline">엑셀 복사</span>
            </button>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              ✕ 닫기
            </button>
          </div>
        </div>

        {/* 2️⃣ 반 탭 & 조회 기간 & 필터 툴바 (초슬림 2줄 통합) */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 sm:py-2 space-y-1.5 shrink-0 text-xs">
          
          {/* 1열: 반 선택 가로 스크롤 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => handleSelectClass('ALL')}
              className={`text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
                selectedClassId === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              🌐 전체 반 통합
            </button>
            {classes.map((c) => {
              const isSelected = String(selectedClassId) === String(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectClass(c.id)}
                  className={`text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* 2열: 기간 + 상태 필터 + 검색창을 한 줄 가로 스크롤로 통합 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {/* 기간 필터 */}
            <span className="text-[10.5px] font-bold text-slate-400 shrink-0">기간:</span>
            {[
              { key: '3WEEKS', label: '최근 3주' },
              { key: '1MONTH', label: '1개월' },
              { key: '2MONTHS', label: '2개월' },
              { key: 'ALL', label: '전체' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setDateRangeFilter(t.key)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                  dateRangeFilter === t.key
                    ? 'bg-teal-600 text-white font-black'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}

            <span className="text-slate-300 shrink-0">|</span>

            {/* 상태 필터 */}
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-black'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              전체({enrolledStudents.length})
            </button>
            <button
              onClick={() => setStatusFilter('LATE_OR_ABSENT')}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-0.5 ${
                statusFilter === 'LATE_OR_ABSENT'
                  ? 'bg-amber-600 text-white font-black'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <span>⚠️ 지각·결석만</span>
            </button>
            <button
              onClick={() => setStatusFilter('PERFECT')}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-0.5 ${
                statusFilter === 'PERFECT'
                  ? 'bg-emerald-600 text-white font-black'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              }`}
            >
              <span>🔥 올출석</span>
            </button>

            <span className="text-slate-300 shrink-0">|</span>

            <input
              type="text"
              placeholder="이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-0.5 focus:outline-teal-500 w-24 shrink-0 font-semibold"
            />
          </div>
        </div>

        {/* 3️⃣ 초슬림 한 줄 KPI 요약 바 (거대 카드 5개 완전 제거) */}
        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 overflow-x-auto scrollbar-none shrink-0 gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span className="text-[11px] text-slate-500">수업 {overallKPI.totalSessions}회</span>
            <span className="text-slate-300">·</span>
            <span>정시출석률 <strong className={`text-xs font-black ${
              overallKPI.avgOnTimeRate >= 90 ? 'text-emerald-600' : overallKPI.avgOnTimeRate >= 75 ? 'text-amber-600' : 'text-rose-600'
            }`}>{overallKPI.avgOnTimeRate}%</strong></span>
          </div>

          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 text-[11px]">
            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              정상 {overallKPI.totalAttends}건
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-amber-700 font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              지각 {overallKPI.totalLates}건
              {overallKPI.totalLateMinutes > 0 && (
                <span className="text-[10px] text-slate-500 font-normal">({overallKPI.totalLateMinutes}분)</span>
              )}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-rose-700 font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              결석 {overallKPI.totalAbsents}건
            </span>
          </div>
        </div>

        {/* 4️⃣ 엑셀 매트릭스 표 본문 */}
        <div className="flex-1 overflow-auto relative">
          {loading ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400 flex flex-col items-center justify-center gap-2">
              <span className="animate-spin text-2xl">⏳</span>
              <span>출석부 데이터를 불러오는 중입니다...</span>
            </div>
          ) : studentMatrixRows.length === 0 ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400">
              조건에 일치하는 학생이나 출결 기록이 없습니다.
            </div>
          ) : (
            <table className="w-full border-collapse text-xs text-left min-w-[700px]">
              
              {/* 테이블 헤더 */}
              <thead className="bg-slate-800 text-white sticky top-0 z-20 shadow-xs text-[11.5px]">
                <tr>
                  <th className="p-3 border-r border-slate-700 w-12 text-center sticky left-0 z-30 bg-slate-800">
                    No
                  </th>
                  <th className="p-3 border-r border-slate-700 min-w-[120px] sticky left-12 z-30 bg-slate-800 font-black">
                    학생명
                  </th>
                  {availableDates.map((date) => {
                    const dayName = DAY_NAMES[new Date(date + 'T00:00:00').getDay()] || '';
                    const dateShort = date.slice(5).replace('-', '/');
                    const isWeekend = dayName === '토' || dayName === '일';

                    return (
                      <th
                        key={date}
                        className={`p-2.5 border-r border-slate-700 min-w-[76px] text-center whitespace-nowrap font-bold ${
                          isWeekend ? 'bg-slate-750 text-amber-200' : ''
                        }`}
                      >
                        <div className="leading-tight">
                          <span className="block font-black text-xs">{dateShort}</span>
                          <span className="text-[10px] opacity-80">({dayName})</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-3 border-r border-slate-700 min-w-[90px] text-center font-black bg-slate-850">
                    정시출석률
                  </th>
                  <th className="p-3 border-r border-slate-700 min-w-[65px] text-center font-black bg-emerald-950/60 text-emerald-300">
                    정상
                  </th>
                  <th className="p-3 border-r border-slate-700 min-w-[75px] text-center font-black bg-amber-950/60 text-amber-300">
                    지각
                  </th>
                  <th className="p-3 border-r border-slate-700 min-w-[65px] text-center font-black bg-rose-950/60 text-rose-300">
                    결석
                  </th>
                </tr>
              </thead>

              {/* 테이블 바디 */}
              <tbody className="divide-y divide-slate-200 font-semibold">
                {studentMatrixRows.map((row, idx) => {
                  const isCaution = row.lateCount > 0 || row.absentCount > 0;
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';

                  return (
                    <tr
                      key={row.student.id}
                      className={`hover:bg-teal-50/50 transition-colors ${rowBg}`}
                    >
                      {/* 1. 번호 (고정) */}
                      <td className="p-2.5 border-r border-slate-200 text-center text-slate-400 font-bold sticky left-0 z-10 bg-inherit text-[11px]">
                        {idx + 1}
                      </td>

                      {/* 2. 학생 이름 (고정) */}
                      <td className="p-2.5 border-r border-slate-200 sticky left-12 z-10 bg-inherit whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900 text-xs sm:text-[13px]">
                            {row.student.name}
                          </span>
                          {row.isPerfect && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.2 rounded">
                              올출석
                            </span>
                          )}
                          {isCaution && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded">
                              관리
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. 날짜별 셀 */}
                      {availableDates.map((date) => {
                        const cell = row.dateMap[date];
                        const isLate = cell?.status === 'LATE';
                        const isAbsent = cell?.status === 'ABSENT';
                        const isAttend = cell?.status === 'ATTEND';

                        return (
                          <td
                            key={date}
                            onClick={() => handleCellClick(row.student, date, cell)}
                            className="p-1.5 border-r border-slate-200 text-center cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all select-none"
                            title="클릭하여 출결 상태 변경"
                          >
                            {isAttend && (
                              <span className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black px-2 py-1 rounded-lg w-full shadow-2xs">
                                🟢 정상
                              </span>
                            )}
                            {isLate && (
                              <span className="inline-flex items-center justify-center bg-amber-100 border border-amber-400 text-amber-900 text-[11px] font-black px-2 py-1 rounded-lg w-full shadow-2xs animate-pulse">
                                🟡 {cell.latenessMinutes}분
                              </span>
                            )}
                            {isAbsent && (
                              <span className="inline-flex items-center justify-center bg-rose-100 border border-rose-400 text-rose-900 text-[11px] font-black px-2 py-1 rounded-lg w-full shadow-2xs">
                                🔴 결석
                              </span>
                            )}
                            {!cell && (
                              <span className="text-slate-300 text-xs font-bold block py-1">
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* 4. 학생별 요약 컬럼들 */}
                      <td className="p-2.5 border-r border-slate-200 text-center whitespace-nowrap bg-slate-50/50">
                        <span className={`inline-block font-black text-xs px-2 py-0.5 rounded-full ${
                          row.onTimeRate >= 90
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : row.onTimeRate >= 75
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {row.onTimeRate}%
                        </span>
                      </td>

                      <td className="p-2.5 border-r border-slate-200 text-center font-black text-emerald-700 bg-emerald-50/30">
                        {row.attendCount}회
                      </td>

                      <td className={`p-2.5 border-r border-slate-200 text-center font-black bg-amber-50/30 ${
                        row.lateCount > 0 ? 'text-amber-700 font-extrabold' : 'text-slate-400'
                      }`}>
                        {row.lateCount > 0 ? `${row.lateCount}회 (${row.lateMinutesTotal}분)` : '0회'}
                      </td>

                      <td className={`p-2.5 border-r border-slate-200 text-center font-black bg-rose-50/30 ${
                        row.absentCount > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-400'
                      }`}>
                        {row.absentCount > 0 ? `${row.absentCount}회` : '0회'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* 테이블 푸터 (날짜별 합계 행) */}
              <tfoot className="bg-slate-900 text-white sticky bottom-0 z-20 font-black text-xs shadow-md">
                <tr>
                  <td colSpan={2} className="p-3 text-center border-r border-slate-700 sticky left-0 z-30 bg-slate-900">
                    전체 합계 (출석률)
                  </td>
                  {columnTotals.map((col) => (
                    <td
                      key={col.date}
                      className="p-2 border-r border-slate-700 text-center whitespace-nowrap text-[11px] leading-tight"
                    >
                      <span className="block font-black text-teal-300">{col.onTimePct}%</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({col.attend}/{col.total})
                      </span>
                    </td>
                  ))}
                  <td className="p-3 text-center border-r border-slate-700 text-teal-300">
                    {overallKPI.avgOnTimeRate}%
                  </td>
                  <td className="p-3 text-center border-r border-slate-700 text-emerald-400">
                    {overallKPI.totalAttends}
                  </td>
                  <td className="p-3 text-center border-r border-slate-700 text-amber-400">
                    {overallKPI.totalLates}
                  </td>
                  <td className="p-3 text-center border-r border-slate-700 text-rose-400">
                    {overallKPI.totalAbsents}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* 5️⃣ 모달 푸터 (초슬림 닫기 바) */}
        <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-slate-500 truncate">
            💡 셀을 클릭하면 <strong>정상 / 지각(분) / 결석</strong> 상태를 즉시 변경할 수 있습니다.
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded-xl transition cursor-pointer text-xs shrink-0 ml-2"
          >
            닫기
          </button>
        </div>
      </div>

      {/* ⚡ 인라인 출결 빠른 수정 팝오버 모달 */}
      {editingCell && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-2xs z-60 flex items-center justify-center p-4 animate-fade-in">
          <div
            ref={popoverRef}
            className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full border border-slate-200 space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b pb-2.5">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  출결 빠른 변경
                </h4>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  {editingCell.studentName} 학생 ({editingCell.evalDate})
                </p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleUpdateStatus('ATTEND')}
                className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-black p-3 rounded-2xl flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span>🟢</span>
                  <span>정상 출석</span>
                </span>
                <span className="text-xs text-emerald-700">정시 착석</span>
              </button>

              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <span>🟡</span>
                  <span>지각 (지각 시간 선택)</span>
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[5, 10, 15, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleUpdateStatus('LATE', mins)}
                      className="bg-white hover:bg-amber-500 hover:text-white border border-amber-300 text-amber-900 text-xs font-black py-2 rounded-xl transition cursor-pointer shadow-2xs"
                    >
                      {mins >= 30 ? '30분+' : `${mins}분`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleUpdateStatus('ABSENT')}
                className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-black p-3 rounded-2xl flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span>🔴</span>
                  <span>결석 처리</span>
                </span>
                <span className="text-xs text-rose-700">미등원</span>
              </button>
            </div>

            <button
              onClick={() => setEditingCell(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ⚡ 액션 알림 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-70 bg-slate-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-slide-up">
          <span>⚡</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
