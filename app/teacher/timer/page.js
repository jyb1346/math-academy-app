'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClientCache, setClientCache } from '@/lib/clientCache';

// 🔔 브라우저 내장 Web Audio API를 활용한 알림 비프음 (외부 파일 의존 없음)
function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 음
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);

    // 0.2초 후 2번째 비프음
    setTimeout(() => {
      try {
        const ctx2 = new AudioContext();
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, ctx2.currentTime); // D6 음
        osc2.frequency.exponentialRampToValueAtTime(587.33, ctx2.currentTime + 0.4);
        gain2.gain.setValueAtTime(0.35, ctx2.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.start();
        osc2.stop(ctx2.currentTime + 0.45);
      } catch (e) {}
    }, 200);
  } catch (e) {}
}

const STORAGE_KEY = 'pum_exam_timers_data_v1';

export default function TeacherExamTimerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 학원 반 및 학생 데이터
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classStudents, setClassStudents] = useState([]);

  // 타이머 상태 관리: studentId -> timerObject
  // timerObject = {
  //   status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'EXPIRED' | 'COMPLETED',
  //   durationMinutes: 45,
  //   totalSeconds: 2700,
  //   startTimestamp: number,
  //   targetEndTimestamp: number,
  //   pausedRemainingSeconds: number | null,
  //   completedElapsedSeconds: number | null,
  //   alarmTriggered: boolean
  // }
  const [timers, setTimers] = useState({});

  // 1초 단위 리렌더링용 틱 타임스탬프
  const [now, setNow] = useState(Date.now());

  // 필터 & 설정 상태
  const [defaultDuration, setDefaultDuration] = useState(45); // 기본 45분
  const [customInputMinutes, setCustomInputMinutes] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'RUNNING' | 'EXPIRED' | 'IDLE'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [viewMode, setViewMode] = useState('CARD'); // 'CARD' | 'COMPACT'

  // 다중 선택 상태 (일괄 시작용)
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // 1. 초기 사용자 및 타이머 로컬스토리지 로드
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'TEACHER' && parsedUser.role !== 'HEAD_TEACHER') {
        alert('선생님 및 원장님만 이용 가능한 화면입니다.');
        router.push('/');
        return;
      }
      setUser(parsedUser);

      // 로컬스토리지에 저장된 이전 타이머 상태 복원
      try {
        const savedTimers = localStorage.getItem(STORAGE_KEY);
        if (savedTimers) {
          setTimers(JSON.parse(savedTimers));
        }
      } catch (e) {
        console.warn('Failed to parse saved timers:', e);
      }

      // 교사 데이터 불러오기
      const cached = getClientCache(`teacher_data_${parsedUser.id}`);
      if (cached) {
        setClasses(cached.classes || []);
        setStudents(cached.students || []);
        setClassStudents(cached.classStudents || []);
        setLoading(false);
      }

      fetchTeacherData(parsedUser.id);
    } catch (e) {
      router.push('/login');
    }
  }, []);

  const fetchTeacherData = async (teacherId) => {
    try {
      const res = await fetch('/api/teacher/data');
      if (!res.ok) throw new Error('데이터 조회 실패');
      const data = await res.json();
      setClientCache(`teacher_data_${teacherId}`, data);
      setClasses(data.classes || []);
      setStudents(data.students || []);
      setClassStudents(data.classStudents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. 1초마다 틱 갱신 및 만료 감지
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      // 만료 타이머 확인 및 알림음 재생
      setTimers((prev) => {
        let changed = false;
        const next = { ...prev };

        Object.keys(next).forEach((stId) => {
          const t = next[stId];
          if (t && t.status === 'RUNNING') {
            const remaining = Math.floor((t.targetEndTimestamp - currentNow) / 1000);
            if (remaining <= 0 && !t.alarmTriggered) {
              changed = true;
              next[stId] = {
                ...t,
                status: 'EXPIRED',
                alarmTriggered: true,
              };
              if (soundEnabled) {
                playBeepSound();
              }
            }
          }
        });

        if (changed) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch (e) {}
          return next;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [soundEnabled]);

  // 타이머 상태가 변경될 때마다 로컬스토리지에 안전하게 자동 저장
  const saveTimersState = (updatedTimers) => {
    setTimers(updatedTimers);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTimers));
    } catch (e) {}
  };

  // ⏱️ 특정 학생 타이머 시작 (단일)
  const handleStartTimer = (studentId, customMinutes = null) => {
    const mins = customMinutes || defaultDuration;
    const totalSecs = mins * 60;
    const currentTime = Date.now();

    const updated = {
      ...timers,
      [studentId]: {
        status: 'RUNNING',
        durationMinutes: mins,
        totalSeconds: totalSecs,
        startTimestamp: currentTime,
        targetEndTimestamp: currentTime + totalSecs * 1000,
        pausedRemainingSeconds: null,
        completedElapsedSeconds: null,
        alarmTriggered: false,
      },
    };
    saveTimersState(updated);
  };

  // ⏸️ 일시정지
  const handlePauseTimer = (studentId) => {
    const t = timers[studentId];
    if (!t || t.status !== 'RUNNING') return;

    const remaining = Math.max(0, Math.floor((t.targetEndTimestamp - Date.now()) / 1000));
    const updated = {
      ...timers,
      [studentId]: {
        ...t,
        status: 'PAUSED',
        pausedRemainingSeconds: remaining,
      },
    };
    saveTimersState(updated);
  };

  // ▶️ 일시정지 후 재개
  const handleResumeTimer = (studentId) => {
    const t = timers[studentId];
    if (!t || t.status !== 'PAUSED') return;

    const remainingSecs = t.pausedRemainingSeconds !== null ? t.pausedRemainingSeconds : 0;
    const currentTime = Date.now();

    const updated = {
      ...timers,
      [studentId]: {
        ...t,
        status: remainingSecs <= 0 ? 'EXPIRED' : 'RUNNING',
        targetEndTimestamp: currentTime + remainingSecs * 1000,
        pausedRemainingSeconds: null,
      },
    };
    saveTimersState(updated);
  };

  // ➕ 시간 연장/추가 (분 단위)
  const handleAddMinutes = (studentId, addMins) => {
    const t = timers[studentId];
    if (!t) return;

    const addMs = addMins * 60 * 1000;
    let newTarget = t.targetEndTimestamp + addMs;
    let newStatus = t.status;
    let newPausedSecs = t.pausedRemainingSeconds;

    if (t.status === 'EXPIRED') {
      // 이미 종료된 상태에서 시간 추가 시 다시 진행 중으로 복귀
      newTarget = Date.now() + addMs;
      newStatus = 'RUNNING';
    } else if (t.status === 'PAUSED' && newPausedSecs !== null) {
      newPausedSecs += addMins * 60;
    }

    const updated = {
      ...timers,
      [studentId]: {
        ...t,
        status: newStatus,
        targetEndTimestamp: newTarget,
        totalSeconds: t.totalSeconds + addMins * 60,
        durationMinutes: t.durationMinutes + addMins,
        pausedRemainingSeconds: newPausedSecs,
        alarmTriggered: false,
      },
    };
    saveTimersState(updated);
  };

  // ✅ 시험 완료 처리
  const handleCompleteTimer = (studentId) => {
    const t = timers[studentId];
    if (!t) return;

    let elapsedSecs = 0;
    if (t.startTimestamp) {
      elapsedSecs = Math.max(0, Math.floor((Date.now() - t.startTimestamp) / 1000));
    }

    const updated = {
      ...timers,
      [studentId]: {
        ...t,
        status: 'COMPLETED',
        completedElapsedSeconds: elapsedSecs,
      },
    };
    saveTimersState(updated);
  };

  // 🔄 타이머 초기화 (대기 상태로 리셋)
  const handleResetTimer = (studentId) => {
    const updated = { ...timers };
    delete updated[studentId];
    saveTimersState(updated);
  };

  // ⚡ 선택 학생 일괄 시작
  const handleStartSelected = () => {
    if (selectedStudentIds.size === 0) return alert('시작할 학생을 먼저 선택해 주세요.');
    const currentTime = Date.now();
    const mins = defaultDuration;
    const totalSecs = mins * 60;

    const updated = { ...timers };
    selectedStudentIds.forEach((stId) => {
      updated[stId] = {
        status: 'RUNNING',
        durationMinutes: mins,
        totalSeconds: totalSecs,
        startTimestamp: currentTime,
        targetEndTimestamp: currentTime + totalSecs * 1000,
        pausedRemainingSeconds: null,
        completedElapsedSeconds: null,
        alarmTriggered: false,
      };
    });

    saveTimersState(updated);
    setSelectedStudentIds(new Set());
    alert(`${selectedStudentIds.size}명의 학생 시험 타이머(${mins}분)가 일괄 시작되었습니다!`);
  };

  // ⏸️ 전체 일시정지
  const handlePauseAll = () => {
    let count = 0;
    const updated = { ...timers };
    const currentTime = Date.now();

    Object.keys(updated).forEach((stId) => {
      const t = updated[stId];
      if (t && t.status === 'RUNNING') {
        const remaining = Math.max(0, Math.floor((t.targetEndTimestamp - currentTime) / 1000));
        updated[stId] = {
          ...t,
          status: 'PAUSED',
          pausedRemainingSeconds: remaining,
        };
        count++;
      }
    });

    if (count === 0) return alert('현재 진행 중인 타이머가 없습니다.');
    saveTimersState(updated);
  };

  // ▶️ 전체 재개
  const handleResumeAll = () => {
    let count = 0;
    const updated = { ...timers };
    const currentTime = Date.now();

    Object.keys(updated).forEach((stId) => {
      const t = updated[stId];
      if (t && t.status === 'PAUSED') {
        const remaining = t.pausedRemainingSeconds || 0;
        updated[stId] = {
          ...t,
          status: remaining <= 0 ? 'EXPIRED' : 'RUNNING',
          targetEndTimestamp: currentTime + remaining * 1000,
          pausedRemainingSeconds: null,
        };
        count++;
      }
    });

    if (count === 0) return alert('일시정지된 타이머가 없습니다.');
    saveTimersState(updated);
  };

  // 🧹 전체 타이머 초기화 (확인 후)
  const handleResetAll = () => {
    const activeCount = Object.keys(timers).length;
    if (activeCount === 0) return alert('초기화할 타이머 기록이 없습니다.');
    if (!confirm('현재 모든 학생의 시험 타이머 기록을 전부 초기화(대기 상태로 리셋)하시겠습니까?')) return;

    saveTimersState({});
  };

  // 🎯 다중 선택 토글
  const toggleSelectStudent = (stId) => {
    const next = new Set(selectedStudentIds);
    if (next.has(stId)) next.delete(stId);
    else next.add(stId);
    setSelectedStudentIds(next);
  };

  // 🎯 반별 학생 필터링
  const enrolledStudentIdsByClass = new Set(
    selectedClassId === 'ALL'
      ? classStudents.map((cs) => cs.student_id)
      : classStudents
          .filter((cs) => String(cs.class_id) === String(selectedClassId))
          .map((cs) => cs.student_id)
  );

  const filteredStudents = students.filter((st) => {
    // 1. 반 필터
    if (selectedClassId !== 'ALL' && !enrolledStudentIdsByClass.has(st.id)) {
      return false;
    }
    // 2. 검색어 필터
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      if (!st.name.toLowerCase().includes(term)) return false;
    }
    // 3. 상태 필터
    const t = timers[st.id];
    const status = t?.status || 'IDLE';
    if (statusFilter === 'RUNNING') {
      return status === 'RUNNING' || status === 'PAUSED';
    } else if (statusFilter === 'EXPIRED') {
      return status === 'EXPIRED';
    } else if (statusFilter === 'IDLE') {
      return status === 'IDLE' || status === 'COMPLETED';
    }

    return true;
  });

  // 카운트 통계
  const runningCount = Object.values(timers).filter((t) => t.status === 'RUNNING' || t.status === 'PAUSED').length;
  const expiredCount = Object.values(timers).filter((t) => t.status === 'EXPIRED').length;
  const completedCount = Object.values(timers).filter((t) => t.status === 'COMPLETED').length;

  // 전체 화면 토글 헬퍼
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/80 pb-36 font-sans text-slate-800">
      
      {/* 📘 1. 헤더 (고정 상단) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/teacher/dashboard')}
                className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold transition border border-slate-200 shrink-0"
                title="교무실 대시보드로 돌아가기"
              >
                ←
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight flex items-center gap-1.5">
                    <span>⏱️</span>
                    <span>개별 시험 실시간 타이머</span>
                  </h1>
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-block">
                    수업 집중 모드
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  학생 이름을 누르면 즉시 개별 카운트다운 시작 • 시간 초과 시 빨간색 깜빡임 알림
                </p>
              </div>
            </div>

            {/* 모바일 화면용 소리 토글 */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl text-xs font-bold border transition ${
                  soundEnabled
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
                title={soundEnabled ? '종료 알림음 켜짐' : '무음 모드'}
              >
                {soundEnabled ? '🔔 소리' : '🔕 무음'}
              </button>
            </div>
          </div>

          {/* 우측 상단 카운트 요약 & 글로벌 버튼 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {/* 요약 뱃지 */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 shrink-0 text-xs font-extrabold">
              <span className={`px-2.5 py-1 rounded-xl transition ${runningCount > 0 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500'}`}>
                🔥 진행 중 {runningCount}
              </span>
              <span className={`px-2.5 py-1 rounded-xl transition ${expiredCount > 0 ? 'bg-rose-600 text-white animate-pulse shadow-2xs' : 'text-slate-400'}`}>
                🚨 종료 {expiredCount}
              </span>
              <span className="px-2 py-1 text-slate-400 font-bold hidden sm:inline">
                완료 {completedCount}
              </span>
            </div>

            {/* 전체 일시정지 / 재개 버튼 */}
            <button
              onClick={handlePauseAll}
              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-2 rounded-xl transition whitespace-nowrap shrink-0 shadow-2xs"
              title="시험 진행 중인 모든 학생 일시정지"
            >
              ⏸ 전체 정지
            </button>
            <button
              onClick={handleResumeAll}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 font-bold px-3 py-2 rounded-xl transition whitespace-nowrap shrink-0 shadow-2xs"
              title="일시정지된 모든 학생 재개"
            >
              ▶ 전체 재개
            </button>

            {/* 데스크톱 알림음 토글 */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition whitespace-nowrap shrink-0 hidden md:inline-block ${
                soundEnabled
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              {soundEnabled ? '🔔 소리 켜짐' : '🔕 무음 모드'}
            </button>

            {/* 전체화면 버튼 */}
            <button
              onClick={toggleFullScreen}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-2 rounded-xl border border-slate-200 shrink-0 hidden lg:inline-block"
              title="전체 화면으로 넓게 보기"
            >
              ⛶
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-5 space-y-4">
        
        {/* 🎯 2. 기본 시험 시간 설정 바 (상단 프리셋 버튼) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span>⏱️ 기본 시험 시간 설정</span>
                <span className="text-[10px] text-slate-400 font-normal">(이름 클릭 시 이 시간으로 즉시 카운트다운 시작)</span>
              </span>
            </div>

            {/* 다중 선택 일괄 시작 버튼 */}
            {selectedStudentIds.size > 0 && (
              <button
                onClick={handleStartSelected}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs px-4 py-2 rounded-2xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 animate-in fade-in"
              >
                <span>🚀 선택한 {selectedStudentIds.size}명 일괄 시작 ({defaultDuration}분)</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[30, 40, 45, 50, 60, 90].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setDefaultDuration(mins);
                  setCustomInputMinutes('');
                }}
                className={`py-2 px-3.5 rounded-2xl text-xs font-black transition ${
                  defaultDuration === mins && !customInputMinutes
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                }`}
              >
                {mins === 45 ? '⭐ 45분 (기본)' : `${mins}분`}
              </button>
            ))}

            {/* 직접 입력 */}
            <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">직접설정:</span>
              <input
                type="number"
                min="1"
                max="240"
                placeholder="분"
                value={customInputMinutes}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomInputMinutes(val);
                  if (val && !isNaN(val) && Number(val) > 0) {
                    setDefaultDuration(Number(val));
                  }
                }}
                className="w-14 bg-white border border-slate-300 rounded-lg text-xs font-black text-center py-1 text-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs font-bold text-slate-600">분</span>
            </div>
          </div>
        </div>

        {/* 🎯 3. 반 선택 필터 & 검색 & 보기 모드 토글 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-xs">
          
          {/* 반 필터 & 상태 탭 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 반 선택 드롭다운 */}
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="p-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">🏫 내 전체 담당 학생 ({students.length}명)</option>
              {classes.map((c) => {
                const count = classStudents.filter((cs) => String(cs.class_id) === String(c.id)).length;
                return (
                  <option key={c.id} value={String(c.id)}>
                    🎯 [{c.name}] ({count}명)
                  </option>
                );
              })}
            </select>

            {/* 상태별 탭 필터 */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                전체
              </button>
              <button
                onClick={() => setStatusFilter('RUNNING')}
                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'RUNNING' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                진행 중 ({runningCount})
              </button>
              <button
                onClick={() => setStatusFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'EXPIRED' ? 'bg-rose-600 text-white shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                종료 ({expiredCount})
              </button>
              <button
                onClick={() => setStatusFilter('IDLE')}
                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'IDLE' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                대기 중
              </button>
            </div>
          </div>

          {/* 검색창 & 뷰 토글 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="학생 이름 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 sm:w-44 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />

            {/* 뷰 모드 토글 */}
            <button
              onClick={() => setViewMode(viewMode === 'CARD' ? 'COMPACT' : 'CARD')}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition shrink-0"
              title={viewMode === 'CARD' ? '컴팩트 목록으로 보기' : '카드 뷰로 보기'}
            >
              {viewMode === 'CARD' ? '📋 목록' : '🗂️ 카드'}
            </button>

            {/* 전체 리셋 */}
            <button
              onClick={handleResetAll}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition shrink-0"
              title="모든 학생 타이머 초기화"
            >
              🔄 초기화
            </button>
          </div>

        </div>

        {/* 🎯 4. 학생 타이머 목록 */}
        {loading ? (
          <div className="bg-white p-16 rounded-3xl text-center border border-slate-200 shadow-xs text-slate-400 font-bold">
            학생 명단을 불러오는 중입니다...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl text-center border border-slate-200 shadow-xs space-y-2">
            <span className="text-4xl">📭</span>
            <p className="text-base font-extrabold text-slate-800">해당 조건의 학생이 없습니다.</p>
            <p className="text-xs text-slate-400 font-medium">반 선택 필터 또는 검색어를 확인해 주세요.</p>
          </div>
        ) : (
          <div className={
            viewMode === 'CARD'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5'
              : 'space-y-2'
          }>
            {filteredStudents.map((st) => {
              const t = timers[st.id];
              const status = t?.status || 'IDLE';

              // 남은 시간(초) 계산
              let remainingSeconds = 0;
              let isOverdue = false;
              let overdueSeconds = 0;

              if (t) {
                if (status === 'RUNNING') {
                  const diff = Math.floor((t.targetEndTimestamp - now) / 1000);
                  if (diff >= 0) {
                    remainingSeconds = diff;
                  } else {
                    isOverdue = true;
                    overdueSeconds = Math.abs(diff);
                  }
                } else if (status === 'PAUSED') {
                  remainingSeconds = t.pausedRemainingSeconds || 0;
                } else if (status === 'EXPIRED') {
                  const diff = Math.floor((now - t.targetEndTimestamp) / 1000);
                  isOverdue = true;
                  overdueSeconds = Math.max(0, diff);
                }
              }

              const minutes = Math.floor(remainingSeconds / 60);
              const seconds = remainingSeconds % 60;
              const formatTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

              const overdueMins = Math.floor(overdueSeconds / 60);
              const overdueSecs = overdueSeconds % 60;
              const formatOverdue = `+${String(overdueMins).padStart(2, '0')}:${String(overdueSecs).padStart(2, '0')}`;

              // 진행률(%) 계산 (100% -> 0%)
              const totalSec = t?.totalSeconds || (defaultDuration * 60);
              const progressPct = t && status !== 'IDLE'
                ? Math.max(0, Math.min(100, (remainingSeconds / totalSec) * 100))
                : 100;

              // 반 이름 매핑
              const stClassNames = classStudents
                .filter((cs) => cs.student_id === st.id)
                .map((cs) => classes.find((c) => c.id === cs.class_id)?.name)
                .filter(Boolean);

              const isSelected = selectedStudentIds.has(st.id);

              // -------------------------------------------------------------
              // 🗂️ 카드 뷰 (CARD MODE)
              // -------------------------------------------------------------
              if (viewMode === 'CARD') {
                return (
                  <div
                    key={st.id}
                    className={`rounded-3xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                      status === 'EXPIRED'
                        ? 'bg-rose-50/90 border-rose-500 shadow-lg shadow-rose-500/10 ring-2 ring-rose-500/50 animate-pulse'
                        : status === 'RUNNING'
                        ? 'bg-white border-indigo-300 shadow-md shadow-indigo-950/5 ring-1 ring-indigo-500/20'
                        : status === 'PAUSED'
                        ? 'bg-amber-50/90 border-amber-300 shadow-xs'
                        : status === 'COMPLETED'
                        ? 'bg-emerald-50/60 border-emerald-200 opacity-90'
                        : 'bg-white border-slate-200/90 shadow-2xs hover:border-indigo-300'
                    }`}
                  >
                    {/* 상단: 체크박스 + 이름 + 상태 뱃지 */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {status === 'IDLE' && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStudent(st.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          )}
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 truncate flex items-center gap-1.5">
                              <span>{st.name}</span>
                            </h3>
                            {stClassNames.length > 0 && (
                              <p className="text-[10.5px] font-bold text-slate-400 truncate">
                                {stClassNames.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 상태 뱃지 */}
                        <div>
                          {status === 'IDLE' && (
                            <span className="bg-slate-100 text-slate-600 font-extrabold text-[10.5px] px-2.5 py-1 rounded-full border border-slate-200">
                              대기 중
                            </span>
                          )}
                          {status === 'RUNNING' && (
                            <span className="bg-indigo-600 text-white font-black text-[10.5px] px-2.5 py-1 rounded-full shadow-2xs flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              <span>시험 중</span>
                            </span>
                          )}
                          {status === 'PAUSED' && (
                            <span className="bg-amber-500 text-white font-black text-[10.5px] px-2.5 py-1 rounded-full shadow-2xs">
                              ⏸ 외출/정지
                            </span>
                          )}
                          {status === 'EXPIRED' && (
                            <span className="bg-rose-600 text-white font-black text-[11px] px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                              <span>🚨 시간 종료!</span>
                            </span>
                          )}
                          {status === 'COMPLETED' && (
                            <span className="bg-emerald-600 text-white font-black text-[10.5px] px-2.5 py-1 rounded-full">
                              ✓ 시험 완료
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 중앙: 대형 타이머 숫자 표시 */}
                      <div className="py-2 text-center">
                        {status === 'IDLE' && (
                          <div className="py-3 text-slate-300">
                            <span className="text-3xl font-black tracking-tight text-slate-400">
                              {defaultDuration}:00
                            </span>
                            <p className="text-[11px] text-slate-400 font-bold mt-0.5">클릭 시 {defaultDuration}분 시작</p>
                          </div>
                        )}

                        {(status === 'RUNNING' || status === 'PAUSED') && (
                          <div className="space-y-1">
                            <span className={`text-4xl sm:text-5xl font-black tracking-tight tabular-nums ${
                              remainingSeconds < 300 ? 'text-amber-600 animate-pulse' : 'text-slate-900'
                            }`}>
                              {formatTime}
                            </span>
                            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500">
                              <span>총 {t.durationMinutes}분 시험</span>
                              {status === 'PAUSED' && <span className="text-amber-600 font-extrabold">(일시정지 중)</span>}
                            </div>
                          </div>
                        )}

                        {status === 'EXPIRED' && (
                          <div className="space-y-1 py-1">
                            <span className="text-4xl sm:text-5xl font-black tracking-tight text-rose-600 tabular-nums">
                              {formatOverdue}
                            </span>
                            <p className="text-xs font-black text-rose-700">
                              시험 시간 경과! 시험지를 회수해 주세요.
                            </p>
                          </div>
                        )}

                        {status === 'COMPLETED' && (
                          <div className="py-2 text-center space-y-0.5">
                            <span className="text-2xl font-black text-emerald-700">제출 완료</span>
                            <p className="text-xs font-bold text-slate-500">
                              총 소요: {Math.floor((t.completedElapsedSeconds || 0) / 60)}분 {(t.completedElapsedSeconds || 0) % 60}초
                            </p>
                          </div>
                        )}

                        {/* 진행 게이지 바 */}
                        {(status === 'RUNNING' || status === 'PAUSED' || status === 'EXPIRED') && (
                          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-full transition-all duration-1000 ${
                                status === 'EXPIRED'
                                  ? 'bg-rose-500 w-full'
                                  : remainingSeconds < 300
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{ width: status === 'EXPIRED' ? '100%' : `${progressPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 하단 컨트롤 버튼 그룹 */}
                    <div className="pt-3 border-t border-slate-100 mt-2">
                      {status === 'IDLE' && (
                        <button
                          type="button"
                          onClick={() => handleStartTimer(st.id)}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-3 rounded-2xl text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <span>▶</span>
                          <span>{defaultDuration}분 시험 시작</span>
                        </button>
                      )}

                      {(status === 'RUNNING' || status === 'PAUSED') && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            {status === 'RUNNING' ? (
                              <button
                                type="button"
                                onClick={() => handlePauseTimer(st.id)}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold py-2 rounded-xl text-xs transition"
                              >
                                ⏸ 일시정지
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleResumeTimer(st.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 rounded-xl text-xs transition"
                              >
                                ▶ 계속하기
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleAddMinutes(st.id, 5)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition border border-slate-200"
                            >
                              +5분 연장
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCompleteTimer(st.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition shadow-2xs"
                            >
                              ✅ 시험 완료
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetTimer(st.id)}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-500 font-medium py-2 rounded-xl text-xs transition border border-slate-200"
                            >
                              🔄 리셋
                            </button>
                          </div>
                        </div>
                      )}

                      {status === 'EXPIRED' && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => handleCompleteTimer(st.id)}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition"
                          >
                            ✅ 시험지 회수 (완료)
                          </button>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddMinutes(st.id, 5)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition border border-slate-200"
                            >
                              +5분 더 풀기
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetTimer(st.id)}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-500 font-medium py-2 rounded-xl text-xs transition border border-slate-200"
                            >
                              🔄 리셋
                            </button>
                          </div>
                        </div>
                      )}

                      {status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleResetTimer(st.id)}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition border border-slate-200"
                        >
                          🔄 다시 풀기 (초기화)
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // -------------------------------------------------------------
              // 📋 컴팩트 목록 뷰 (COMPACT ROW MODE)
              // -------------------------------------------------------------
              return (
                <div
                  key={st.id}
                  className={`p-3 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
                    status === 'EXPIRED'
                      ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/40 animate-pulse'
                      : status === 'RUNNING'
                      ? 'bg-white border-indigo-300 shadow-2xs'
                      : status === 'PAUSED'
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {status === 'IDLE' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectStudent(st.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">{st.name}</span>
                        {stClassNames.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {stClassNames.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* 타이머 시간 표시 */}
                    <div className="text-right">
                      {status === 'IDLE' && (
                        <span className="text-base font-bold text-slate-400">{defaultDuration}:00</span>
                      )}
                      {(status === 'RUNNING' || status === 'PAUSED') && (
                        <span className={`text-xl sm:text-2xl font-black tabular-nums ${
                          remainingSeconds < 300 ? 'text-amber-600 animate-pulse' : 'text-slate-900'
                        }`}>
                          {formatTime}
                        </span>
                      )}
                      {status === 'EXPIRED' && (
                        <span className="text-xl sm:text-2xl font-black text-rose-600 tabular-nums">
                          {formatOverdue} (종료)
                        </span>
                      )}
                      {status === 'COMPLETED' && (
                        <span className="text-sm font-black text-emerald-700">제출완료</span>
                      )}
                    </div>

                    {/* 버튼 컨트롤 */}
                    <div className="flex items-center gap-1.5">
                      {status === 'IDLE' && (
                        <button
                          type="button"
                          onClick={() => handleStartTimer(st.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs transition"
                        >
                          ▶ 시작
                        </button>
                      )}

                      {status === 'RUNNING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePauseTimer(st.id)}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-2.5 py-1.5 rounded-xl text-xs transition"
                          >
                            ⏸
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMinutes(st.id, 5)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-slate-200"
                          >
                            +5분
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCompleteTimer(st.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
                          >
                            완료
                          </button>
                        </>
                      )}

                      {status === 'PAUSED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResumeTimer(st.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
                          >
                            ▶ 재개
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCompleteTimer(st.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
                          >
                            완료
                          </button>
                        </>
                      )}

                      {status === 'EXPIRED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCompleteTimer(st.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-1.5 rounded-xl text-xs transition"
                          >
                            회수완료
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMinutes(st.id, 5)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-slate-200"
                          >
                            +5분
                          </button>
                        </>
                      )}

                      {status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleResetTimer(st.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-slate-200"
                        >
                          리셋
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
