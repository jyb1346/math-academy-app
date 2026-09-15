'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import EvaluationBarChart from '@/components/EvaluationBarChart';
import { parseEvaluationRecord, markAlimtalkSentInComment } from '@/lib/evalUtils';

function HexagonRadarChart({ scores, twoWeekAvgScores }) {
  const { concept = 8, calc = 8, app = 8, attitude = 8, homework = 8, perseverance = 8 } = scores;
  const labels = ['개념이해', '연산정확', '응용해결', '수업집중', '과제완성', '오답끈기'];
  const values = [concept, calc, app, attitude, homework, perseverance];

  const center = 100;
  const radius = 65;

  const getCoordinates = (valArray, maxVal = 10) => {
    return valArray.map((val, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const r = (val / maxVal) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
      <svg width="220" height="220" viewBox="0 0 200 200" className="overflow-visible">
        {gridLevels.map((level, idx) => (
          <polygon
            key={idx}
            points={getCoordinates([10, 10, 10, 10, 10, 10].map(v => v * level))}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray={idx === 4 ? "none" : "2 2"}
          />
        ))}

        {labels.map((_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
        })}

        {twoWeekAvgScores && (
          <polygon
            points={getCoordinates([
              twoWeekAvgScores.concept,
              twoWeekAvgScores.calc,
              twoWeekAvgScores.app,
              twoWeekAvgScores.attitude,
              twoWeekAvgScores.homework,
              twoWeekAvgScores.perseverance,
            ])}
            fill="rgba(249, 115, 22, 0.15)"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        <polygon
          points={getCoordinates(values)}
          fill="rgba(37, 99, 235, 0.3)"
          stroke="#2563eb"
          strokeWidth="2.5"
        />

        {values.map((val, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const r = (val / 10) * radius;
          const cx = center + r * Math.cos(angle);
          const cy = center + r * Math.sin(angle);
          return <circle key={i} cx={cx} cy={cy} r="3.5" fill="#2563eb" />;
        })}

        {labels.map((label, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const labelRadius = radius + 18;
          const lx = center + labelRadius * Math.cos(angle);
          const ly = center + labelRadius * Math.sin(angle);
          return (
            <text
              key={i} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              className="text-[10px] font-black fill-slate-700"
            >
              {label} ({values[i]})
            </text>
          );
        })}
      </svg>

      <div className="flex items-center justify-center gap-4 text-[11px] font-bold pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
          <span className="text-blue-900">당일 성취도</span>
        </div>
        {twoWeekAvgScores && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block border border-dashed"></span>
            <span className="text-orange-900">본인 최근 2주 평균</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvalHistoryPage() {
  const [user, setUser] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'UNSENT' | 'SENT'
  const [loading, setLoading] = useState(true);

  const [sendingId, setSendingId] = useState(null);
  const [batchSending, setBatchSending] = useState(false);
  const [batchSendProgress, setBatchSendProgress] = useState('');

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'TEACHER' && parsedUser.role !== 'HEAD_TEACHER') {
      alert('선생님 권한이 필요합니다.');
      router.push('/');
      return;
    }
    setUser(parsedUser);
    fetchData(parsedUser);
  }, []);

  const fetchData = async (currentUser) => {
    try {
      const { data: stData } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'STUDENT')
        .eq('teacher_id', currentUser.id);
      setStudents(stData || []);

      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', currentUser.id);
      setClasses(cData || []);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      const { data: evalData, error } = await supabase
        .from('daily_evaluations')
        .select('*, users!daily_evaluations_student_id_fkey(name, email, parent_phone)')
        .eq('teacher_id', currentUser.id)
        .order('eval_date', { ascending: false });

      if (error) throw error;
      setEvaluations(evalData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendNotification = async (item) => {
    return alert('🧪 [1주일 현장 점검 모드] 현재는 화면 및 기능 테스트 기간으로 학부모 알림톡 발송이 일시 비활성화되어 있습니다.');

    setSendingId(item.id);
    try {
      const res = await fetch('/api/solapi/send-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalId: item.id,
          studentId: item.student_id,
          studentName,
          evalDate: item.eval_date,
          parentPhone,
          teacherName: user?.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const sentTime = data.alimtalkSentAt || new Date().toISOString();
        setEvaluations((prev) =>
          prev.map((ev) =>
            ev.id === item.id
              ? { ...ev, teacher_comment: markAlimtalkSentInComment(ev.teacher_comment, sentTime) }
              : ev
          )
        );
        alert(`✅ [${studentName}] 학부모님(${parentPhone})께 피드백 리포트 알림이 성공적으로 발송되었습니다!`);
      } else {
        alert(`발송 실패: ${data.error || data.message}`);
      }
    } catch (err) {
      alert(`발송 오류: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  // 미발송 학생 일괄 발송 핸들러
  const handleBatchSendUnsent = async (unsentList) => {
    return alert('🧪 [1주일 현장 점검 모드] 현재는 화면 및 기능 테스트 기간으로 학부모 알림톡 발송이 일시 비활성화되어 있습니다.');

    const withoutPhone = unsentList.filter((e) => !e.users?.parent_phone);
    let confirmMsg = `🚀 현재 미발송 피드백 총 ${unsentList.length}건의 알림톡을 학부모님께 일괄 발송하시겠습니까?`;
    if (withoutPhone.length > 0) {
      confirmMsg += `\n\n(참고: 학부모 연락처 미등록 학생 ${withoutPhone.length}명은 자동 건너뜁니다)`;
    }

    if (!confirm(confirmMsg)) return;

    setBatchSending(true);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    let currentEvals = [...evaluations];

    for (let i = 0; i < unsentList.length; i++) {
      const item = unsentList[i];
      const studentName = item.users?.name || '학생';
      const parentPhone = item.users?.parent_phone;

      setBatchSendProgress(`(${i + 1}/${unsentList.length}) [${studentName}] 학생 알림톡 발송 중...`);

      if (!parentPhone) {
        skippedCount++;
        continue;
      }

      try {
        const res = await fetch('/api/solapi/send-eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evalId: item.id,
            studentId: item.student_id,
            studentName,
            evalDate: item.eval_date,
            parentPhone,
            teacherName: user?.name,
          }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
          const sentTime = data.alimtalkSentAt || new Date().toISOString();
          currentEvals = currentEvals.map((ev) =>
            ev.id === item.id
              ? { ...ev, teacher_comment: markAlimtalkSentInComment(ev.teacher_comment, sentTime) }
              : ev
          );
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Batch send error:', err);
        failCount++;
      }
    }

    setEvaluations(currentEvals);
    setBatchSending(false);
    setBatchSendProgress('');

    alert(`🎉 알림톡 일괄 발송 완료!\n\n- 발송 성공: ${successCount}건\n- 실패: ${failCount}건\n- 연락처 없음(건너뜀): ${skippedCount}건`);
  };

  const handleCopyReportLink = (evalId) => {
    const url = `${window.location.origin}/report/${evalId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`📋 학부모 리포트 링크가 복사되었습니다!\n\n${url}`);
    }).catch(() => {
      prompt('아래 주소를 복사해 주세요:', url);
    });
  };

  const handleDeleteEval = async (id, studentName, evalDate) => {
    if (!confirm(`[${studentName}] 학생의 ${evalDate} 피드백을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase.from('daily_evaluations').delete().eq('id', id);
      if (error) throw error;
      alert('삭제되었습니다.');
      fetchData(user);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const getTwoWeekAvgScores = (studentId, currentEvalDate) => {
    if (!currentEvalDate) return null;

    const targetDate = new Date(currentEvalDate);
    const twoWeeksAgo = new Date(targetDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const studentTwoWeekEvals = evaluations.filter((e) => {
      if (e.student_id !== studentId) return false;
      const evalDateObj = new Date(e.eval_date);
      return evalDateObj >= twoWeeksAgo && evalDateObj <= targetDate;
    });

    if (studentTwoWeekEvals.length === 0) return null;

    const total = studentTwoWeekEvals.reduce(
      (acc, curr) => ({
        concept: acc.concept + (curr.concept_score || 0),
        calc: acc.calc + (curr.calc_score || 0),
        app: acc.app + (curr.app_score || 0),
        attitude: acc.attitude + (curr.attitude_score || 0),
        homework: acc.homework + (curr.homework_score || 0),
        perseverance: acc.perseverance + (curr.perseverance_score || 0),
      }),
      { concept: 0, calc: 0, app: 0, attitude: 0, homework: 0, perseverance: 0 }
    );

    const count = studentTwoWeekEvals.length;
    return {
      concept: Number((total.concept / count).toFixed(1)),
      calc: Number((total.calc / count).toFixed(1)),
      app: Number((total.app / count).toFixed(1)),
      attitude: Number((total.attitude / count).toFixed(1)),
      homework: Number((total.homework / count).toFixed(1)),
      perseverance: Number((total.perseverance / count).toFixed(1)),
    };
  };

  const renderAttendanceBadge = (status, latenessMins) => {
    if (status === 'LATE') {
      const minsText = latenessMins >= 30 ? '30분 이상 지각' : `${latenessMins || 5}분 이내 지각`;
      return (
        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full">
          ⏰ {minsText}
        </span>
      );
    }
    if (status === 'ABSENT') {
      return (
        <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-2.5 py-0.5 rounded-full">
          🔴 결석
        </span>
      );
    }
    return (
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-2.5 py-0.5 rounded-full">
        🟢 정시 출석
      </span>
    );
  };

  const filteredStudents = selectedClassId === 'ALL'
    ? students
    : students.filter((st) =>
        classStudents.some(
          (cs) => String(cs.class_id) === String(selectedClassId) && String(cs.student_id) === String(st.id)
        )
      );

  const filteredEvals = evaluations.filter((item) => {
    if (selectedStudentId !== 'ALL' && item.student_id !== selectedStudentId) {
      return false;
    }
    if (selectedClassId !== 'ALL') {
      const inClass = classStudents.some(
        (cs) => String(cs.class_id) === String(selectedClassId) && cs.student_id === item.student_id
      );
      if (!inClass) return false;
    }
    if (selectedDate && item.eval_date !== selectedDate) {
      return false;
    }
    return true;
  });

  const parsedFiltered = filteredEvals.map((e) => ({
    eval: e,
    parsed: parseEvaluationRecord(e),
  }));

  const totalCount = parsedFiltered.length;
  const sentCount = parsedFiltered.filter((p) => !!p.parsed.alimtalkSentAt).length;
  const unsentCount = totalCount - sentCount;
  const unsentList = parsedFiltered.filter((p) => !p.parsed.alimtalkSentAt).map((p) => p.eval);

  const displayedList = parsedFiltered.filter((p) => {
    if (filterTab === 'UNSENT') return !p.parsed.alimtalkSentAt;
    if (filterTab === 'SENT') return !!p.parsed.alimtalkSentAt;
    return true;
  });

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 onClick={() => router.push('/teacher/dashboard')} className="text-xl font-bold text-blue-600 cursor-pointer">
          품수학 학원 교무실
        </h1>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>🔷</span> 내 작성 피드백 리포트 ({filteredEvals.length}건)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{user.name} 선생님이 작성하신 학습 피드백 전체 기록입니다.</p>
            </div>
            <button
              onClick={() => router.push('/teacher/eval')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + 새 피드백 작성
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">🏫 내 반 선택</label>
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId('ALL'); }}
                className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-700"
              >
                <option value="ALL">전체 반 보기</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">👤 내 담당 학생 선택</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-700"
              >
                <option value="ALL">전체 학생 보기</option>
                {filteredStudents.map((st) => (
                  <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-600">📅 날짜 지정</label>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="text-[10px] text-rose-500 font-bold hover:underline"
                  >
                    초기화 ✕
                  </button>
                )}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs bg-white font-bold text-slate-700"
              />
            </div>
          </div>

          {/* 📊 카카오 알림톡 발송 현황 대시보드 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition ${
            unsentCount > 0
              ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 border-amber-200 shadow-2xs'
              : 'bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-emerald-50/80 border-emerald-200 shadow-2xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{unsentCount > 0 ? '⚠️' : '✅'}</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    피드백 알림톡 발송 현황 {selectedDate ? `(${selectedDate} 기준)` : '(조회 결과 기준)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                  <span className="bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                    총 {totalCount}건 작성됨
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-300">
                    ✅ 발송 완료 {sentCount}건
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg border font-black ${
                    unsentCount > 0
                      ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {unsentCount > 0 ? `⚠️ 미발송 ${unsentCount}건 (발송 필요!)` : '⚠️ 미발송 0건 (전원 발송 완료)'}
                  </span>
                </div>
              </div>

              {unsentCount > 0 && (
                <button
                  onClick={() => handleBatchSendUnsent(unsentList)}
                  disabled={batchSending}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-1.5 whitespace-nowrap self-stretch sm:self-auto ${
                    batchSending
                      ? 'bg-slate-400 text-white cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                  }`}
                >
                  <span className="text-base shrink-0">🚀</span>
                  <span>{batchSending ? batchSendProgress || '일괄 발송 중...' : `미발송 (${unsentCount}명) 알림톡 일괄 발송`}</span>
                </button>
              )}
            </div>
          </div>

          {/* 🏷️ 발송 필터 탭 */}
          <div className="flex items-center gap-1.5 border-b pb-2 overflow-x-auto">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>전체 보기</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                filterTab === 'ALL' ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('UNSENT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'UNSENT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span>⚠️ 미발송만 모아보기</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                filterTab === 'UNSENT' ? 'bg-rose-800 text-white' : unsentCount > 0 ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-600'
              }`}>
                {unsentCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('SENT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'SENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span>✅ 발송 완료만</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                filterTab === 'SENT' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {sentCount}
              </span>
            </button>
          </div>

          <div className="space-y-6">
            {displayedList.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs font-bold">
                {filterTab === 'UNSENT'
                  ? '🎉 미발송 상태의 피드백이 없습니다. 모든 학생에게 알림톡이 발송되었습니다!'
                  : '작성하신 학습 피드백 내역이 없습니다.'}
              </p>
            ) : (
              displayedList.map(({ eval: item, parsed }) => {

                return (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-slate-800">{item.users?.name} 학생</span>
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold border border-blue-200 whitespace-nowrap">
                          📅 수업일: {item.eval_date}
                        </span>
                        
                        {renderAttendanceBadge(item.attendance_status, item.lateness_minutes)}

                        {/* 알림톡 발송 상태 뱃지 */}
                        {parsed.alimtalkSentAt ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span>✅</span>
                            <span>알림톡 발송 완료 ({new Date(parsed.alimtalkSentAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })})</span>
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <span>⚠️</span>
                            <span>알림톡 미발송</span>
                          </span>
                        )}

                        {parsed.lessonProgress && (
                          <span className="bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                            📖 진도: {parsed.lessonProgress}
                          </span>
                        )}

                        {parsed.testScore && (
                          <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                            📝 {parsed.testType}: {parsed.testScore.endsWith('점') || parsed.testScore.includes('/') || parsed.testScore.includes('등급') ? parsed.testScore : `${parsed.testScore}점`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0 pt-1 sm:pt-0">
                        <button
                          onClick={() => handleCopyReportLink(item.id)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition whitespace-nowrap shadow-2xs"
                          title="학부모 리포트 웹 주소 복사"
                        >
                          🔗 링크 복사
                        </button>
                        <button
                          onClick={() => handleResendNotification(item)}
                          disabled={sendingId === item.id || batchSending}
                          className={`px-2.5 py-1.5 text-xs font-black rounded-lg transition flex items-center gap-1 shadow-2xs disabled:opacity-50 whitespace-nowrap ${
                            parsed.alimtalkSentAt
                              ? 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300'
                              : 'text-white bg-amber-600 hover:bg-amber-700 border border-amber-700 shadow-xs'
                          }`}
                          title={parsed.alimtalkSentAt ? '학부모님 휴대폰으로 알림톡 재전송' : '학부모님 휴대폰으로 알림톡 전송'}
                        >
                          <span>{parsed.alimtalkSentAt ? '↻' : '📲'}</span>
                          <span>
                            {sendingId === item.id
                              ? '발송 중...'
                              : parsed.alimtalkSentAt
                              ? '알림톡 재발송'
                              : '학부모 알림 발송'}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteEval(item.id, item.users?.name, item.eval_date)}
                          className="text-rose-500 hover:underline font-bold px-1.5 py-1 text-xs whitespace-nowrap"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* 가로 막대 차트 */}
                      <EvaluationBarChart items={parsed.items} />

                      {/* 📚 부여된 교재 과제 범위 및 수행 상태 */}
                      {parsed.homeworkBooks && parsed.homeworkBooks.length > 0 && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-500 block">📚 부여된 과제 및 수행 상태:</span>
                          <div className="flex flex-wrap gap-2">
                            {parsed.homeworkBooks.map((b) => (
                              <span key={b.name} className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs">
                                <span className="text-indigo-600 font-extrabold">{b.name}</span>
                                <span className="text-slate-500 font-medium">{b.range}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                                  b.status === '완료' ? 'bg-emerald-100 text-emerald-800' :
                                  b.status === '일부완료' ? 'bg-sky-100 text-sky-800' :
                                  b.status === '미완료' ? 'bg-rose-100 text-rose-800' :
                                  b.status === '질문남음' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {b.status || '미체크'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 선생님 총평 & 학부모 답장 */}
                      <div className="space-y-3">
                        {parsed.comment && (
                          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-1">
                            <span className="text-xs font-bold text-blue-800 block">✍️ 선생님 학습 총평</span>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                              {parsed.comment}
                            </p>
                          </div>
                        )}

                        {item.parent_reply && (
                          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
                              <span>💌 학부모님 수신 답장</span>
                              <span className="text-emerald-600 text-[10px]">
                                {item.parent_reply_at ? new Date(item.parent_reply_at).toLocaleDateString() : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 font-bold">"{item.parent_reply}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
