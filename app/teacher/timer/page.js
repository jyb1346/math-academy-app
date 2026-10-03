'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClientCache, setClientCache } from '@/lib/clientCache';

// 🔔 브라우저 내장 Web Audio API를 활용한 알림 비프음
function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);

    setTimeout(() => {
      try {
        const ctx2 = new AudioContext();
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, ctx2.currentTime);
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

  // 타이머 상태 저장
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

  // 🧹 전체 타이머 초기화
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
    if (selectedClassId !== 'ALL' && !enrolledStudentIdsByClass.has(st.id)) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      if (!st.name.toLowerCase().includes(term)) return false;
    }
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

  // 🌟 스마트 우선순위 정렬:
  // 1. 시간 종료(EXPIRED, 빨간색 깜빡임) -> 맨 위 최우선!
  // 2. 진행 중(RUNNING, 남은 시간 적은 순) -> 그다음
  // 3. 일시정지(PAUSED) -> 그다음
  // 4. 대기 중(IDLE, 가나다순) -> 아래
  // 5. 완료(COMPLETED) -> 맨 아래
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const tA = timers[a.id];
    const tB = timers[b.id];
    const statusA = tA?.status || 'IDLE';
    const statusB = tB?.status || 'IDLE';

    const priority = {
      EXPIRED: 1,
      RUNNING: 2,
      PAUSED: 3,
      IDLE: 4,
      COMPLETED: 5,
    };

    const pA = priority[statusA] || 4;
    const pB = priority[statusB] || 4;

    if (pA !== pB) return pA - pB;

    if (statusA === 'RUNNING' && statusB === 'RUNNING') {
      return (tA?.targetEndTimestamp || 0) - (tB?.targetEndTimestamp || 0);
    }
    if (statusA === 'EXPIRED' && statusB === 'EXPIRED') {
      return (tA?.targetEndTimestamp || 0) - (tB?.targetEndTimestamp || 0);
    }

    return (a.name || '').localeCompare(b.name || '', 'ko');
  });

  // 통계 카운트
  const runningCount = Object.values(timers).filter((t) => t.status === 'RUNNING' || t.status === 'PAUSED').length;
  const expiredCount = Object.values(timers).filter((t) => t.status === 'EXPIRED').length;
  const completedCount = Object.values(timers).filter((t) => t.status === 'COMPLETED').length;

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 pb-32 font-sans text-slate-800">
      
      {/* 📘 1. 컴팩트 헤더 (고정 상단) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-5 py-2.5 shadow-xs">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          
          {/* 좌측 타이틀 & 뒤로가기 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/teacher/dashboard')}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition border border-slate-200 shrink-0"
              title="교무실 대시보드로 돌아가기"
            >
              ←
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight flex items-center gap-1.5">
                  <span>⏱️</span>
                  <span>개별 시험 타이머</span>
                </h1>
                {/* 실시간 요약 카운트 뱃지 */}
                <div className="flex items-center gap-1 text-[11px] font-black">
                  <span className={`px-2 py-0.5 rounded-lg transition ${runningCount > 0 ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-400'}`}>
                    진행 {runningCount}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg transition ${expiredCount > 0 ? 'bg-rose-600 text-white animate-pulse shadow-2xs' : 'bg-slate-100 text-slate-400'}`}>
                    종료 {expiredCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 우측 상단 빠른 액션 버튼 */}
          <div className="flex items-center gap-1.5">
            {selectedStudentIds.size > 0 && (
              <button
                onClick={handleStartSelected}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 animate-in fade-in"
              >
                <span>🚀 {selectedStudentIds.size}명 일괄 시작</span>
              </button>
            )}

            <button
              onClick={handlePauseAll}
              className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2.5 py-1.5 rounded-xl transition whitespace-nowrap shadow-2xs"
              title="시험 진행 중인 모든 학생 일시정지"
            >
              ⏸ 전체 정지
            </button>
            <button
              onClick={handleResumeAll}
              className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 font-bold px-2.5 py-1.5 rounded-xl transition whitespace-nowrap shadow-2xs"
              title="일시정지된 모든 학생 재개"
            >
              ▶ 전체 재개
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition whitespace-nowrap ${
                soundEnabled
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              {soundEnabled ? '🔔 소리' : '🔕 무음'}
            </button>

            <button
              onClick={handleResetAll}
              className="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-xl font-bold transition whitespace-nowrap"
              title="모든 학생 타이머 초기화"
            >
              🔄 초기화
            </button>

            <button
              onClick={toggleFullScreen}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-xl border border-slate-200 hidden sm:inline-block"
              title="전체 화면으로 넓게 보기"
            >
              ⛶
            </button>
          </div>

        </div>
      </header>

      {/* 🎯 2. 컴팩트 1줄 통합 컨트롤 바 (시간 설정 + 반 필터 + 검색) */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 mt-3 space-y-2.5">
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          
          {/* 기본 시험 시간 프리셋 버튼 그룹 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-500 shrink-0 mr-0.5">
              기본 시간:
            </span>
            {[30, 40, 45, 50, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setDefaultDuration(mins);
                  setCustomInputMinutes('');
                }}
                className={`py-1 px-2.5 rounded-xl text-xs font-black transition ${
                  defaultDuration === mins && !customInputMinutes
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {mins === 45 ? '⭐ 45분' : `${mins}분`}
              </button>
            ))}

            <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-xl border border-slate-200">
              <input
                type="number"
                min="1"
                max="240"
                placeholder="직접"
                value={customInputMinutes}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomInputMinutes(val);
                  if (val && !isNaN(val) && Number(val) > 0) {
                    setDefaultDuration(Number(val));
                  }
                }}
                className="w-10 bg-white border border-slate-300 rounded text-[11px] font-black text-center py-0.5 text-slate-800 focus:outline-none"
              />
              <span className="text-[11px] font-bold text-slate-600">분</span>
            </div>
          </div>

          {/* 반 필터 & 상태 필터 & 검색 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 반 드롭다운 */}
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">🏫 전체 학생 ({students.length}명)</option>
              {classes.map((c) => {
                const count = classStudents.filter((cs) => String(cs.class_id) === String(c.id)).length;
                return (
                  <option key={c.id} value={String(c.id)}>
                    🎯 [{c.name}] ({count}명)
                  </option>
                );
              })}
            </select>

            {/* 상태 필터 탭 */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-1 rounded-lg transition ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500'}`}
              >
                전체
              </button>
              <button
                onClick={() => setStatusFilter('RUNNING')}
                className={`px-2 py-1 rounded-lg transition ${statusFilter === 'RUNNING' ? 'bg-indigo-600 text-white font-black' : 'text-slate-500'}`}
              >
                진행 ({runningCount})
              </button>
              <button
                onClick={() => setStatusFilter('EXPIRED')}
                className={`px-2 py-1 rounded-lg transition ${statusFilter === 'EXPIRED' ? 'bg-rose-600 text-white font-black' : 'text-slate-500'}`}
              >
                종료 ({expiredCount})
              </button>
            </div>

            {/* 검색창 */}
            <input
              type="text"
              placeholder="이름 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-28 sm:w-36 p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
            />
          </div>

        </div>
      </div>

      {/* 🎯 3. [A형] 초소형 미니 타일 카드 그리드 (PC 5~6열 / 태블릿 3~4열 / 모바일 2열) */}
      <main className="max-w-[1600px] mx-auto px-3 sm:px-5 mt-3">
        {loading ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-xs text-slate-400 font-bold">
            학생 명단을 불러오는 중입니다...
          </div>
        ) : sortedStudents.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-xs space-y-2">
            <span className="text-3xl">📭</span>
            <p className="text-sm font-extrabold text-slate-800">해당 조건의 학생이 없습니다.</p>
            <p className="text-xs text-slate-400 font-medium">반 선택 필터 또는 검색어를 확인해 주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {sortedStudents.map((st) => {
              const t = timers[st.id];
              const status = t?.status || 'IDLE';

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

              const totalSec = t?.totalSeconds || (defaultDuration * 60);
              const progressPct = t && status !== 'IDLE'
                ? Math.max(0, Math.min(100, (remainingSeconds / totalSec) * 100))
                : 100;

              const stClassNames = classStudents
                .filter((cs) => cs.student_id === st.id)
                .map((cs) => classes.find((c) => c.id === cs.class_id)?.name)
                .filter(Boolean);

              const isSelected = selectedStudentIds.has(st.id);

              return (
                <div
                  key={st.id}
                  className={`rounded-2xl p-2.5 sm:p-3 border transition-all duration-200 relative flex flex-col justify-between h-[96px] sm:h-[102px] ${
                    status === 'EXPIRED'
                      ? 'bg-rose-50/95 border-rose-500 shadow-md ring-2 ring-rose-500/50 animate-pulse'
                      : status === 'RUNNING'
                      ? 'bg-white border-indigo-400 shadow-xs ring-1 ring-indigo-500/20'
                      : status === 'PAUSED'
                      ? 'bg-amber-50/90 border-amber-300'
                      : status === 'COMPLETED'
                      ? 'bg-emerald-50/70 border-emerald-200 opacity-90'
                      : 'bg-white border-slate-200/90 shadow-2xs hover:border-indigo-300'
                  }`}
                >
                  {/* 윗줄: 이름 + 반 / 남은 시간 or 뱃지 */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {status === 'IDLE' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectStudent(st.id);
                          }}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                        />
                      )}
                      <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        {st.name}
                      </span>
                      {stClassNames.length > 0 && (
                        <span className="text-[9.5px] font-bold text-slate-400 truncate max-w-[50px] hidden sm:inline-block">
                          {stClassNames[0]}
                        </span>
                      )}
                    </div>

                    {/* 시간/상태 표시 */}
                    <div className="shrink-0 text-right">
                      {status === 'IDLE' && (
                        <span className="text-[11px] font-bold text-slate-400">
                          {defaultDuration}:00
                        </span>
                      )}
                      {(status === 'RUNNING' || status === 'PAUSED') && (
                        <span className={`text-sm sm:text-base font-black tabular-nums leading-none ${
                          remainingSeconds < 300 ? 'text-amber-600 animate-pulse' : 'text-slate-900'
                        }`}>
                          {status === 'PAUSED' ? `⏸ ${formatTime}` : formatTime}
                        </span>
                      )}
                      {status === 'EXPIRED' && (
                        <span className="text-[11px] sm:text-xs font-black text-rose-600 tabular-nums leading-none animate-pulse">
                          🚨 {formatOverdue}
                        </span>
                      )}
                      {status === 'COMPLETED' && (
                        <span className="text-[11px] font-black text-emerald-600">
                          ✓ 완료
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 게이지 바 (진행 중일 때만 얇은 1줄) */}
                  {(status === 'RUNNING' || status === 'PAUSED' || status === 'EXPIRED') && (
                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden my-0.5">
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

                  {/* 아랫줄: 원터치 컴팩트 버튼 컨트롤 */}
                  <div className="pt-0.5">
                    {status === 'IDLE' && (
                      <button
                        type="button"
                        onClick={() => handleStartTimer(st.id)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1 rounded-xl text-[11px] sm:text-xs shadow-2xs transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>▶</span>
                        <span>{defaultDuration}분 시작</span>
                      </button>
                    )}

                    {status === 'RUNNING' && (
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => handlePauseTimer(st.id)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold py-1 rounded-lg text-[10.5px] transition"
                        >
                          ⏸ 정지
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddMinutes(st.id, 5)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-1 rounded-lg text-[10.5px] transition border border-slate-200"
                        >
                          +5분
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteTimer(st.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1 rounded-lg text-[10.5px] transition shadow-2xs"
                        >
                          완료
                        </button>
                      </div>
                    )}

                    {status === 'PAUSED' && (
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => handleResumeTimer(st.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-1 rounded-lg text-[10.5px] transition"
                        >
                          ▶ 재개
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddMinutes(st.id, 5)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-1 rounded-lg text-[10.5px] transition border border-slate-200"
                        >
                          +5분
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteTimer(st.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1 rounded-lg text-[10.5px] transition"
                        >
                          완료
                        </button>
                      </div>
                    )}

                    {status === 'EXPIRED' && (
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => handleCompleteTimer(st.id)}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-black py-1 rounded-lg text-[11px] transition shadow-xs"
                        >
                          ✅ 회수완료
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddMinutes(st.id, 5)}
                          className="bg-white hover:bg-slate-100 text-slate-700 font-extrabold py-1 rounded-lg text-[10.5px] transition border border-slate-200"
                        >
                          +5분 더
                        </button>
                      </div>
                    )}

                    {status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleResetTimer(st.id)}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 rounded-lg text-[11px] transition border border-slate-200"
                      >
                        🔄 리셋
                      </button>
                    )}
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
