'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_EVAL_KEYS,
  formatTeacherCommentWithTestScoreAndItems,
  parseEvaluationRecord,
} from '@/lib/evalUtils';

export default function TeacherEvalPage() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // 직전 피드백 비교 상태
  const [prevEval, setPrevEval] = useState(null);
  const [loadingPrevEval, setLoadingPrevEval] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState(false);

  // 평가 항목 상태
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('ATTEND');
  const [latenessMinutes, setLatenessMinutes] = useState(5);

  // 🎯 기본 6개 항목 활성화 여부 및 점수
  const [activeDefaultKeys, setActiveDefaultKeys] = useState([
    'concept',
    'calc',
    'app',
    'attitude',
    'homework',
    'perseverance',
  ]);
  const [defaultScores, setDefaultScores] = useState({
    concept: 8,
    calc: 8,
    app: 8,
    attitude: 8,
    homework: 8,
    perseverance: 8,
  });

  // ✨ 커스텀 추가 항목 상태: [{ id, name, score }]
  const [customItems, setCustomItems] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [showAddCustomInput, setShowAddCustomInput] = useState(false);

  // 📝 시험 성적 및 종류 상태 (단원평가, 일일테스트, 주간테스트, 모의고사, 기타)
  const [testType, setTestType] = useState('단원평가');
  const [customTestType, setCustomTestType] = useState('');
  const [testScore, setTestScore] = useState('');
  
  const [teacherComment, setTeacherComment] = useState('');
  const [loading, setLoading] = useState(true);

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

  // 선택된 학생이나 날짜가 변경될 때 직전 피드백 기록 조회
  useEffect(() => {
    if (selectedStudentId) {
      fetchPreviousEval(selectedStudentId, evalDate);
    } else {
      setPrevEval(null);
    }
  }, [selectedStudentId, evalDate]);

  const fetchPreviousEval = async (studentId, currentDate) => {
    try {
      setLoadingPrevEval(true);
      const { data, error } = await supabase
        .from('daily_evaluations')
        .select('*')
        .eq('student_id', studentId)
        .neq('eval_date', currentDate)
        .order('eval_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPrevEval(data || null);
    } catch (err) {
      console.error('fetchPreviousEval error:', err);
      setPrevEval(null);
    } finally {
      setLoadingPrevEval(false);
    }
  };

  const handleCopyPrevScores = () => {
    if (!prevEval) return;
    const prevParsed = parseEvaluationRecord(prevEval);

    // 1. 기본 항목 중 직전에 활성화되었던 항목 및 점수 복사
    const prevActiveKeys = [];
    const newScores = { ...defaultScores };
    DEFAULT_EVAL_KEYS.forEach((def) => {
      const val = prevEval[def.dbCol];
      if (val !== null && val !== undefined) {
        prevActiveKeys.push(def.key);
        newScores[def.key] = Number(val);
      }
    });

    if (prevActiveKeys.length > 0) {
      setActiveDefaultKeys(prevActiveKeys);
      setDefaultScores(newScores);
    }

    // 2. 커스텀 항목 복사
    if (prevParsed.customItems && prevParsed.customItems.length > 0) {
      setCustomItems(
        prevParsed.customItems.map((c, idx) => ({
          id: `custom_${Date.now()}_${idx}`,
          name: c.name,
          score: Number(c.score) || 8,
        }))
      );
    } else {
      setCustomItems([]);
    }

    // 3. 출결 상태 복사
    setAttendanceStatus(prevEval.attendance_status || 'ATTEND');
    if (prevEval.lateness_minutes) {
      setLatenessMinutes(prevEval.lateness_minutes);
    }

    // 4. 시험 종류 및 점수 복사
    if (prevParsed.testScore) {
      if (['단원평가', '일일테스트', '주간테스트', '모의고사'].includes(prevParsed.testType)) {
        setTestType(prevParsed.testType);
        setCustomTestType('');
      } else {
        setTestType('기타');
        setCustomTestType(prevParsed.testType);
      }
      setTestScore(prevParsed.testScore);
    }

    setCopySuccessToast(true);
    setTimeout(() => setCopySuccessToast(false), 3000);
  };

  const toggleDefaultKey = (key) => {
    setActiveDefaultKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAddCustomItem = () => {
    const trimmed = newCustomName.trim();
    if (!trimmed) return alert('항목 이름을 입력해 주세요.');
    if (customItems.some((c) => c.name === trimmed)) {
      return alert('이미 추가된 항목 이름입니다.');
    }
    setCustomItems((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, name: trimmed, score: 8 },
    ]);
    setNewCustomName('');
    setShowAddCustomInput(false);
  };

  const handleRemoveCustomItem = (id) => {
    setCustomItems((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCustomScoreChange = (id, newScore) => {
    setCustomItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, score: Number(newScore) } : c))
    );
  };

  const renderScoreDiffBadge = (currentScore, prevScore) => {
    if (prevScore === undefined || prevScore === null) return null;
    const diff = Number(currentScore) - Number(prevScore);
    if (diff > 0) {
      return (
        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
          <span>▲</span>+{diff} (직전 {prevScore})
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
          <span>▼</span>{diff} (직전 {prevScore})
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded-md">
        - 동일 (직전 {prevScore})
      </span>
    );
  };

  const fetchData = async (currentUser) => {
    try {
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', currentUser.id);
      
      const classList = cData || [];
      setClasses(classList);

      if (classList.length > 0) {
        setSelectedClassId(String(classList[0].id));
        fetchClassStudents(classList[0].id);
      } else {
        const { data: stData } = await supabase
          .from('users')
          .select('id, name, email, parent_phone')
          .eq('role', 'STUDENT')
          .eq('teacher_id', currentUser.id);
        setStudents(stData || []);
        if (stData && stData.length > 0) setSelectedStudentId(stData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassStudents = async (classId) => {
    try {
      const { data: csData } = await supabase
        .from('class_students')
        .select('student_id, users(id, name, email, parent_phone)')
        .eq('class_id', classId);

      if (csData) {
        const stList = csData.map((item) => item.users).filter(Boolean);
        setStudents(stList);
        if (stList.length > 0) setSelectedStudentId(stList[0].id);
        else setSelectedStudentId('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClassChange = (e) => {
    const cId = e.target.value;
    setSelectedClassId(cId);
    fetchClassStudents(cId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) return alert('학생을 선택해 주세요.');

    if (activeDefaultKeys.length === 0 && customItems.length === 0) {
      return alert('최소 1개 이상의 평가 항목을 선택해 주세요.');
    }

    const selectedStudent = students.find((s) => s.id === selectedStudentId);
    const studentName = selectedStudent ? selectedStudent.name : '해당';

    try {
      const { data: existingEval, error: checkError } = await supabase
        .from('daily_evaluations')
        .select('id')
        .eq('student_id', selectedStudentId)
        .eq('eval_date', evalDate)
        .maybeSingle();

      if (checkError) throw checkError;

      const effectiveTestType = testType === '기타' ? (customTestType.trim() || '기타평가') : testType;

      const combinedComment = formatTeacherCommentWithTestScoreAndItems({
        comment: teacherComment,
        testScore,
        testType: effectiveTestType,
        customItems,
      });

      const payload = {
        teacher_id: user.id,
        student_id: selectedStudentId,
        eval_date: evalDate,
        attendance_status: attendanceStatus,
        lateness_minutes: attendanceStatus === 'LATE' ? parseInt(latenessMinutes) : 0,
        concept_score: activeDefaultKeys.includes('concept') ? parseInt(defaultScores.concept) : null,
        calc_score: activeDefaultKeys.includes('calc') ? parseInt(defaultScores.calc) : null,
        app_score: activeDefaultKeys.includes('app') ? parseInt(defaultScores.app) : null,
        attitude_score: activeDefaultKeys.includes('attitude') ? parseInt(defaultScores.attitude) : null,
        homework_score: activeDefaultKeys.includes('homework') ? parseInt(defaultScores.homework) : null,
        perseverance_score: activeDefaultKeys.includes('perseverance') ? parseInt(defaultScores.perseverance) : null,
        teacher_comment: combinedComment,
      };

      let evalId = null;

      if (existingEval) {
        const confirmOverwrite = confirm(
          `⚠️ [${studentName}] 학생의 ${evalDate} 날짜 피드백이 이미 작성되어 있습니다.\n\n새로 작성한 내용으로 수정(덮어쓰기)하고 학부모님께 알림을 재발송하시겠습니까?\n'취소'를 누르면 기존 피드백이 유지됩니다.`
        );

        if (!confirmOverwrite) {
          alert('기존 피드백이 유지되었습니다.');
          return;
        }

        const { error: updateError } = await supabase
          .from('daily_evaluations')
          .update(payload)
          .eq('id', existingEval.id);

        if (updateError) throw updateError;
        evalId = existingEval.id;
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from('daily_evaluations')
          .insert([payload])
          .select('id')
          .single();

        if (insertError) throw insertError;
        evalId = insertedData?.id;
      }

      // 📲 학부모님께 카카오톡/문자 피드백 리포트 링크 자동 발송
      let messageNotice = '';
      if (evalId && selectedStudent?.parent_phone) {
        try {
          const res = await fetch('/api/solapi/send-eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evalId,
              studentId: selectedStudentId,
              studentName: selectedStudent.name,
              evalDate,
              parentPhone: selectedStudent.parent_phone,
              teacherName: user?.name,
            }),
          });
          const sendResult = await res.json();
          if (sendResult.success) {
            messageNotice = `\n\n📲 학부모님(${selectedStudent.parent_phone})께 피드백 리포트 링크가 성공적으로 발송되었습니다!`;
          } else if (sendResult.skipped) {
            messageNotice = `\n\nℹ️ ${sendResult.message}`;
          } else {
            messageNotice = `\n\n⚠️ 알림 발송 안내: ${sendResult.error || '발송 실패'}`;
          }
        } catch (msgErr) {
          console.error('Solapi send error:', msgErr);
          messageNotice = `\n\n⚠️ 알림 발송 오류: ${msgErr.message}`;
        }
      } else if (!selectedStudent?.parent_phone) {
        messageNotice = '\n\n(등록된 학부모 연락처가 없어 알림 발송은 건너뛰었습니다.)';
      }

      alert(`[${studentName}] 학생의 ${evalDate} 피드백이 성공적으로 저장되었습니다!${messageNotice}`);
      setTeacherComment('');
      setTestScore('');
      setCustomTestType('');
      fetchPreviousEval(selectedStudentId, evalDate);
    } catch (err) {
      console.error(err);
      alert('피드백 저장에 실패했습니다.');
    }
  };

  if (loading) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  const prevParsed = prevEval ? parseEvaluationRecord(prevEval) : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 onClick={() => router.push('/teacher/dashboard')} className="text-xl font-bold text-blue-600 cursor-pointer">
          품수학 학원 교무실
        </h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/teacher/eval/history')} className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition">
            📋 피드백 이력 관리
          </button>
          <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
            ← 뒤로가기
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800">✍️ 일일 학습 피드백 작성</h2>
            <p className="text-xs text-slate-500 mt-1">오늘 수업에 맞게 평가할 항목을 선택하고 점수와 출결, 시험 결과를 기록합니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. 반 / 학생 / 수업일자 선택 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">🏫 담당 반 선택</label>
                <select
                  value={selectedClassId}
                  onChange={handleClassChange}
                  className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>📘 {cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">👤 학생 선택</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                >
                  {students.length === 0 ? (
                    <option value="">등록된 학생 없음</option>
                  ) : (
                    students.map((st) => (
                      <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">📅 수업 날짜</label>
                <input
                  type="date"
                  value={evalDate}
                  onChange={(e) => setEvalDate(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs bg-white font-bold text-slate-800"
                />
              </div>
            </div>

            {/* 🔍 2. 선택된 학생의 직전 피드백 비교 요약 카드 */}
            {loadingPrevEval ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs font-bold text-slate-400 animate-pulse">
                선택 학생의 직전 피드백 기록을 조회하는 중...
              </div>
            ) : prevEval && prevParsed ? (
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                      직전 수업 기록
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-100">
                      📅 {prevEval.eval_date} 수업 피드백
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
                      {prevEval.attendance_status === 'LATE'
                        ? `⏰ ${prevEval.lateness_minutes || 5}분 지각`
                        : prevEval.attendance_status === 'ABSENT'
                        ? '🔴 결석'
                        : '🟢 정상 출석'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPrevScores}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
                    title="직전 항목과 점수 구성을 오늘 폼에 1초 만에 그대로 적용합니다"
                  >
                    <span>📋</span>
                    <span>직전 점수 그대로 불러오기</span>
                  </button>
                </div>

                {/* 직전 평가 항목 점수 요약 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 text-center text-[11px] font-bold">
                  {prevParsed.items.map((it) => (
                    <div key={it.key || it.name} className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 text-[10px] block truncate">{it.name}</span>
                      <span className="text-blue-400 font-black text-xs">{it.score}점</span>
                    </div>
                  ))}
                </div>

                {/* 직전 총평 코멘트 & 직전 시험 성적 요약 */}
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-xs space-y-1">
                  {prevParsed.testScore && (
                    <div className="text-indigo-300 font-extrabold flex items-center gap-1 pb-0.5">
                      <span>📝 직전 {prevParsed.testType}:</span>
                      <span className="text-amber-300 font-black">{prevParsed.testScore}</span>
                    </div>
                  )}
                  <p className="text-slate-300 font-medium leading-relaxed">
                    <span className="text-slate-400 font-bold mr-1">💬 직전 코멘트:</span>
                    {prevParsed.comment || '작성된 코멘트가 없었습니다.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-2">
                <span>ℹ️</span>
                <span>선택된 학생의 이전 피드백 기록이 없습니다. (첫 피드백 작성)</span>
              </div>
            )}

            {copySuccessToast && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-800 flex items-center gap-2 animate-fade-in">
                <span>✅</span>
                <span>직전 피드백의 평가 항목 및 점수 구성을 성공적으로 불러왔습니다!</span>
              </div>
            )}

            {/* 3. 출결 상태 선택 */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <span className="text-xs font-extrabold text-amber-900 block">⏰ 출석 및 지각 상태 기록</span>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('ATTEND')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    attendanceStatus === 'ATTEND'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  🟢 정시 출석
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('LATE')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    attendanceStatus === 'LATE'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  ⏰ 지각
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('ABSENT')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    attendanceStatus === 'ABSENT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  🔴 결석
                </button>

                {attendanceStatus === 'LATE' && (
                  <div className="flex items-center gap-1.5 ml-2 bg-white px-3 py-1.5 rounded-xl border border-amber-300">
                    <span className="text-xs font-bold text-amber-800">지각 범위:</span>
                    <select
                      value={latenessMinutes}
                      onChange={(e) => setLatenessMinutes(e.target.value)}
                      className="text-xs font-extrabold text-amber-900 bg-transparent focus:outline-none"
                    >
                      <option value={5}>5분 이내 지각</option>
                      <option value={10}>10분 이내 지각</option>
                      <option value={15}>15분 이내 지각</option>
                      <option value={20}>20분 이내 지각</option>
                      <option value={30}>30분 이상 지각</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 4. 📊 평가 항목 선택 칩 & 점수 슬라이더 */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 border-b pb-2">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>📊</span>
                    <span>학습 성취도 평가 항목 관리</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    오늘 수업에서 평가할 항목을 선택(ON/OFF)하거나, 새로운 맞춤 항목을 자유롭게 추가하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomInput(!showAddCustomInput)}
                  className="self-start sm:self-auto bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black px-3 py-1.5 rounded-xl border border-indigo-200 transition flex items-center gap-1"
                >
                  <span>✨</span>
                  <span>+ 새 항목 추가</span>
                </button>
              </div>

              {/* 새 항목 인라인 추가 폼 */}
              {showAddCustomInput && (
                <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 flex gap-2 items-center animate-fade-in">
                  <input
                    type="text"
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    placeholder="예: 서술형 풀이, 교재 필기 상태, 질문 적극성 등"
                    className="flex-1 p-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomItem();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs shrink-0"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddCustomInput(false); setNewCustomName(''); }}
                    className="text-slate-400 hover:text-slate-600 text-xs px-2 shrink-0"
                  >
                    취소
                  </button>
                </div>
              )}

              {/* 기본 6개 항목 토글 칩 */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">기본 역량 선택 (클릭하여 켜기/끄기):</span>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_EVAL_KEYS.map((def) => {
                    const isActive = activeDefaultKeys.includes(def.key);
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => toggleDefaultKey(def.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition border flex items-center gap-1 ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 opacity-60'
                        }`}
                      >
                        <span>{def.icon}</span>
                        <span>{def.name}</span>
                        <span className="text-[10px]">{isActive ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 활성화된 항목들의 점수 슬라이더 리스트 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                
                {/* 1) 활성화된 기본 항목 슬라이더 */}
                {DEFAULT_EVAL_KEYS.filter((def) => activeDefaultKeys.includes(def.key)).map((def) => (
                  <div key={def.key} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-800 flex items-center gap-1">
                        <span>{def.icon}</span>
                        <span>{def.name}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {renderScoreDiffBadge(defaultScores[def.key], prevEval?.[def.dbCol])}
                        <span className="text-blue-600 font-black">{defaultScores[def.key]}점</span>
                        <button
                          type="button"
                          onClick={() => toggleDefaultKey(def.key)}
                          className="text-slate-300 hover:text-rose-500 text-xs ml-1"
                          title="항목 제외"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <input
                      type="range" min="1" max="10" value={defaultScores[def.key]}
                      onChange={(e) => setDefaultScores({ ...defaultScores, [def.key]: Number(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>
                ))}

                {/* 2) 커스텀 추가 항목 슬라이더 */}
                {customItems.map((c) => (
                  <div key={c.id} className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200 space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-indigo-950 flex items-center gap-1">
                        <span>✨</span>
                        <span>{c.name}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-indigo-600 font-black">{c.score}점</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomItem(c.id)}
                          className="text-slate-400 hover:text-rose-500 text-xs ml-1 font-bold"
                          title="항목 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <input
                      type="range" min="1" max="10" value={c.score}
                      onChange={(e) => handleCustomScoreChange(c.id, e.target.value)}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                ))}

              </div>
            </div>

            {/* 5. 📝 시험 성적 기록 (단원평가, 일일테스트, 주간테스트, 모의고사, 기타 직접입력) */}
            <div className="bg-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <span>📝</span>
                  <span>시험 성적 기록</span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/90 px-2 py-0.5 rounded-full">
                    선택 입력
                  </span>
                </label>
                {testScore && (
                  <button
                    type="button"
                    onClick={() => { setTestScore(''); setCustomTestType(''); }}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-500 underline"
                  >
                    점수 지우기 ✕
                  </button>
                )}
              </div>

              {/* 시험 종류 5가지 선택 탭 */}
              <div>
                <span className="block text-[11px] font-bold text-indigo-900 mb-1.5">📌 시험 종류 구분:</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { key: '단원평가', label: '📘 단원평가' },
                    { key: '일일테스트', label: '⚡ 일일테스트' },
                    { key: '주간테스트', label: '📝 주간테스트' },
                    { key: '모의고사', label: '🎯 모의고사' },
                    { key: '기타', label: '✍️ 기타 (직접입력)' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTestType(item.key)}
                      className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition border text-center ${
                        testType === item.key
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white border-indigo-200 text-indigo-900 hover:bg-indigo-100/60'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* '기타' 선택 시 나타나는 커스텀 시험명 입력창 */}
              {testType === '기타' && (
                <div className="animate-fade-in space-y-1">
                  <label className="block text-[11px] font-bold text-indigo-900">
                    ✍️ 기타 시험 명칭 직접 입력:
                  </label>
                  <input
                    type="text"
                    value={customTestType}
                    onChange={(e) => setCustomTestType(e.target.value)}
                    placeholder="예: 3월 월말평가, 중간고사 대비 모의테스트, 총괄평가 등"
                    className="w-full p-2.5 border border-indigo-300 rounded-xl text-xs font-bold text-indigo-950 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              )}

              {/* 시험 점수 입력창 */}
              <div>
                <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                  🎯 획득 점수 / 결과:
                </label>
                <input
                  type="text"
                  value={testScore}
                  onChange={(e) => setTestScore(e.target.value)}
                  placeholder="예: 95점 또는 24/25, 1등급(96점) (시험을 안 본 날은 빈칸으로 둡니다)"
                  className="w-full p-2.5 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <p className="text-[10.5px] text-indigo-700/80 font-medium">
                💡 점수를 입력하면 학부모 리포트에 <strong>[{testType === '기타' ? (customTestType || '기타 시험') : testType} 결과 카드]</strong>가 생성되며, <strong>빈칸으로 두시면 리포트에 시험 항목이 표시되지 않습니다.</strong>
              </p>
            </div>

            {/* 6. 선생님 총평 코멘트 */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">✍️ 선생님 총평 코멘트</label>
              <textarea
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="오늘 수업 성취 및 칭찬/보완할 점을 적어주세요."
                className="w-full p-3 border rounded-xl text-xs h-24 font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow transition text-sm"
            >
              일일 피드백 등록하기
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
