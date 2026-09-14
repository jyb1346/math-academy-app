'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import StudentHomeworkTable from '@/components/StudentHomeworkTable';
import {
  DEFAULT_EVAL_KEYS,
  HOMEWORK_STATUS_OPTIONS,
  formatTeacherCommentWithTestScoreAndItems,
  parseEvaluationRecord,
  extractRecentBookNamesFromEvaluations,
  extractAllUniqueBookNamesFromEvaluations,
  updateBookStatusInComment,
  updateEvaluationProgressAndBooksInComment,
} from '@/lib/evalUtils';

export default function TeacherEvalPage() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // 🎯 수업 모드: 'LECTURE' (판서수업 - 반 전체 공통 진도/과제 일괄 등록) | 'INDIVIDUAL' (개별수업 - 학생별 1:1 맞춤)
  const [evalMode, setEvalMode] = useState('LECTURE');
  const [classTypes, setClassTypes] = useState({});

  // 1) 1:1 개별수업 모드용 상태
  const [studentEvals, setStudentEvals] = useState([]);
  const [prevEval, setPrevEval] = useState(null);
  const [loadingPrevEval, setLoadingPrevEval] = useState(false);
  const [actionToast, setActionToast] = useState('');
  
  // 공통 평가 일자
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 개별 모드: 출결
  const [attendanceStatus, setAttendanceStatus] = useState('ATTEND');
  const [latenessMinutes, setLatenessMinutes] = useState(5);

  // 개별 모드: 기본 6대 역량 점수 및 활성화 키
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

  // 개별 모드: 커스텀 추가 항목 상태: [{ id, name, score }]
  const [customItems, setCustomItems] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [showAddCustomInput, setShowAddCustomInput] = useState(false);

  // 개별 모드: 오늘 수업 진도 및 새 숙제 부여 상태
  const [todayLessonProgress, setTodayLessonProgress] = useState('');
  const [todayHomeworkBooks, setTodayHomeworkBooks] = useState([
    { id: 'book_1', name: '개념서', range: '', status: '미체크' },
    { id: 'book_2', name: '유형서', range: '', status: '미체크' },
  ]);
  const [newBookName, setNewBookName] = useState('');
  const [showAddBookInput, setShowAddBookInput] = useState(false);

  // 개별 모드: 시험 성적 및 종류 상태
  const [testType, setTestType] = useState('단원평가');
  const [customTestType, setCustomTestType] = useState('');
  const [testScore, setTestScore] = useState('');
  const [teacherComment, setTeacherComment] = useState('');

  // 2) 👥 판서수업 (반 일괄 등록 모드) 전용 상태
  const [commonLessonProgress, setCommonLessonProgress] = useState('');
  const [commonHomeworkBooks, setCommonHomeworkBooks] = useState([
    { id: 'c_book_1', name: '개념서', range: '', status: '미체크' },
    { id: 'c_book_2', name: '유형서', range: '', status: '미체크' },
  ]);
  const [commonNewBookName, setCommonNewBookName] = useState('');
  const [showCommonAddBookInput, setShowCommonAddBookInput] = useState(false);
  const [commonClassUsedBooks, setCommonClassUsedBooks] = useState([]); // 이 반 학생들의 전체 사용 교재명 칩 목록
  
  // 판서수업: 반 소속 학생별 일괄 상태 리스트
  const [batchStudents, setBatchStudents] = useState([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchProgressText, setBatchProgressText] = useState('');

  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const showToast = (msg) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4000);
  };

  // 최근 사용된 교재명을 브라우저 로컬 스토리지에 캐싱
  const saveRecentBooksToCache = (booksOrNames) => {
    try {
      const names = (booksOrNames || [])
        .map((item) => (typeof item === 'string' ? item : item?.name))
        .map((n) => n?.trim())
        .filter(Boolean);
      if (names.length > 0) {
        localStorage.setItem('poom_recent_homework_books', JSON.stringify([...new Set(names)]));
      }
    } catch (e) {
      console.error('saveRecentBooksToCache error:', e);
    }
  };

  // 초기화 및 사용자 인증
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

    // 반 수업 유형 로드
    try {
      const storedTypes = localStorage.getItem('poom_class_types');
      if (storedTypes) {
        setClassTypes(JSON.parse(storedTypes));
      }
    } catch (e) {}

    // 저장된 최근 교재명이 있다면 즉시 초기 상태로 반영
    try {
      const cached = localStorage.getItem('poom_recent_homework_books');
      if (cached) {
        const parsedCached = JSON.parse(cached);
        if (Array.isArray(parsedCached) && parsedCached.length > 0) {
          const initBooks = parsedCached.map((name, idx) => ({
            id: `book_init_${idx}`,
            name,
            range: '',
            status: '미체크',
          }));
          setTodayHomeworkBooks(initBooks);
          setCommonHomeworkBooks(initBooks);
        }
      }
    } catch (e) {}

    fetchData(parsedUser);
  }, []);

  // 반 선택 변경 시 처리
  const handleClassChange = (e) => {
    const cId = e.target.value;
    setSelectedClassId(cId);

    // 해당 반의 수업 유형에 맞춰 모드 자동 전환
    try {
      const stored = localStorage.getItem('poom_class_types');
      const types = stored ? JSON.parse(stored) : classTypes;
      const targetType = types[cId] || 'LECTURE';
      setEvalMode(targetType);
    } catch (err) {
      setEvalMode('LECTURE');
    }

    fetchClassStudents(cId);
  };

  // 수업 모드 수동 전환 (판서수업 <-> 개별수업)
  const handleToggleEvalMode = (newMode) => {
    setEvalMode(newMode);
    if (selectedClassId) {
      const updated = { ...classTypes, [selectedClassId]: newMode };
      setClassTypes(updated);
      try {
        localStorage.setItem('poom_class_types', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  // 선택된 학생이나 날짜가 변경될 때 해당 학생의 전체 기록 및 직전 기록 조회 (1:1 개별 모드)
  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentEvaluationHistory(selectedStudentId, evalDate);
    } else {
      setStudentEvals([]);
      setPrevEval(null);
    }
  }, [selectedStudentId, evalDate]);

  // 개별 모드용 학생 기록 조회
  const fetchStudentEvaluationHistory = async (studentId, currentDate) => {
    try {
      setLoadingPrevEval(true);
      const { data, error } = await supabase
        .from('daily_evaluations')
        .select('*')
        .eq('student_id', studentId)
        .order('eval_date', { ascending: false });

      if (error) throw error;

      const evals = data || [];
      setStudentEvals(evals);

      // 현재 선택된 날짜 이전의 가장 최근 평가 1건 찾기
      const prev = evals.find((e) => e.eval_date < currentDate) || (evals.length > 0 ? evals[0] : null);
      setPrevEval(prev);

      // 🎯 역량 평가 항목 및 점수 게이지 자동 반영
      if (prev) {
        const parsedPrev = parseEvaluationRecord(prev);

        const prevActiveKeys = [];
        const newScores = {
          concept: 8,
          calc: 8,
          app: 8,
          attitude: 8,
          homework: 8,
          perseverance: 8,
        };

        DEFAULT_EVAL_KEYS.forEach((def) => {
          const val = prev[def.dbCol];
          if (val !== null && val !== undefined) {
            prevActiveKeys.push(def.key);
            newScores[def.key] = Number(val);
          }
        });

        if (prevActiveKeys.length > 0) {
          setActiveDefaultKeys(prevActiveKeys);
          setDefaultScores(newScores);
        }

        if (parsedPrev.customItems && parsedPrev.customItems.length > 0) {
          setCustomItems(
            parsedPrev.customItems.map((c, idx) => ({
              id: `custom_${Date.now()}_${idx}`,
              name: c.name,
              score: Number(c.score) || 8,
            }))
          );
        } else {
          setCustomItems([]);
        }
      } else {
        setActiveDefaultKeys([
          'concept',
          'calc',
          'app',
          'attitude',
          'homework',
          'perseverance',
        ]);
        setDefaultScores({
          concept: 8,
          calc: 8,
          app: 8,
          attitude: 8,
          homework: 8,
          perseverance: 8,
        });
        setCustomItems([]);
      }

      // 교재명 추출 및 자동 세팅
      let recentBookNames = extractRecentBookNamesFromEvaluations(evals);
      if (recentBookNames.length === 0) {
        try {
          const cached = localStorage.getItem('poom_recent_homework_books');
          if (cached) {
            const parsedCached = JSON.parse(cached);
            if (Array.isArray(parsedCached) && parsedCached.length > 0) {
              recentBookNames = parsedCached.filter(Boolean);
            }
          }
        } catch (e) {}
      }

      if (recentBookNames.length === 0) {
        recentBookNames = ['개념서', '유형서'];
      }

      const newBooks = recentBookNames.map((name, idx) => ({
        id: `book_${Date.now()}_${idx}`,
        name,
        range: '',
        status: '미체크',
      }));

      setTodayHomeworkBooks(newBooks);
      saveRecentBooksToCache(recentBookNames);
    } catch (err) {
      console.error('fetchStudentEvaluationHistory error:', err);
    } finally {
      setLoadingPrevEval(false);
    }
  };

  // 1:1 과제표 인라인 상태 변경
  const handleInlineHomeworkStatusChange = async (evalId, bookName, newStatus) => {
    try {
      const targetEval = studentEvals.find((e) => e.id === evalId);
      if (!targetEval) return;

      const updatedComment = updateBookStatusInComment(
        targetEval.teacher_comment,
        bookName,
        newStatus
      );

      const { error } = await supabase
        .from('daily_evaluations')
        .update({ teacher_comment: updatedComment })
        .eq('id', evalId);

      if (error) throw error;

      setStudentEvals((prev) =>
        prev.map((item) =>
          item.id === evalId ? { ...item, teacher_comment: updatedComment } : item
        )
      );

      showToast(`✅ [${bookName}] 과제 상태가 '${newStatus}'(으)로 즉시 변경되었습니다.`);
    } catch (err) {
      console.error('handleInlineHomeworkStatusChange error:', err);
      alert('과제 상태 수정 중 오류가 발생했습니다.');
    }
  };

  // 1:1 과제표 모달에서 진도 및 전체 교재 수정 저장
  const handleUpdateEvaluation = async (evalId, updatedProgress, updatedBooks) => {
    try {
      const targetEval = studentEvals.find((e) => e.id === evalId);
      if (!targetEval) return;

      const updatedComment = updateEvaluationProgressAndBooksInComment(
        targetEval.teacher_comment,
        updatedProgress,
        updatedBooks
      );

      const { error } = await supabase
        .from('daily_evaluations')
        .update({ teacher_comment: updatedComment })
        .eq('id', evalId);

      if (error) throw error;

      setStudentEvals((prev) =>
        prev.map((item) =>
          item.id === evalId ? { ...item, teacher_comment: updatedComment } : item
        )
      );

      fetchStudentEvaluationHistory(selectedStudentId, evalDate);
      showToast(`✅ ${targetEval.eval_date} 수업의 진도 및 과제 정보가 성공적으로 수정되었습니다.`);
    } catch (err) {
      console.error('handleUpdateEvaluation error:', err);
      alert('수정 내용 저장 중 오류가 발생했습니다.');
    }
  };

  // 1:1 과제표에서 특정 회차 삭제
  const handleDeleteEvaluation = async (evalId, formattedDate) => {
    try {
      const { error } = await supabase
        .from('daily_evaluations')
        .delete()
        .eq('id', evalId);

      if (error) throw error;

      setStudentEvals((prev) => prev.filter((item) => item.id !== evalId));
      fetchStudentEvaluationHistory(selectedStudentId, evalDate);
      showToast(`🗑️ ${formattedDate} 피드백 및 과제 기록이 성공적으로 삭제되었습니다.`);
    } catch (err) {
      console.error('handleDeleteEvaluation error:', err);
      alert('기록 삭제 중 오류가 발생했습니다.');
    }
  };

  // 기본 항목 토글 및 커스텀 항목 조작 (1:1 모드)
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

  // 1:1 모드 오늘 새 교재 추가
  const handleAddTodayBook = () => {
    const trimmed = newBookName.trim();
    if (!trimmed) return alert('교재명을 입력해 주세요.');
    if (todayHomeworkBooks.some((b) => b.name === trimmed)) {
      return alert('이미 추가된 교재명입니다.');
    }
    const updated = [
      ...todayHomeworkBooks,
      { id: `book_${Date.now()}`, name: trimmed, range: '', status: '미체크' },
    ];
    setTodayHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
    setNewBookName('');
    setShowAddBookInput(false);
  };

  const handleRemoveTodayBook = (id) => {
    const updated = todayHomeworkBooks.filter((b) => b.id !== id);
    setTodayHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
  };

  const handleTodayBookRangeChange = (id, newRange) => {
    setTodayHomeworkBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, range: newRange } : b))
    );
  };

  const handleTodayBookNameChange = (id, newName) => {
    const updated = todayHomeworkBooks.map((b) =>
      b.id === id ? { ...b, name: newName } : b
    );
    setTodayHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
  };

  // 👥 판서수업(공통) 모드 교재 추가/삭제/변경
  const handleAddCommonBook = () => {
    const trimmed = commonNewBookName.trim();
    if (!trimmed) return alert('교재명을 입력해 주세요.');
    if (commonHomeworkBooks.some((b) => b.name === trimmed)) {
      return alert('이미 추가된 교재명입니다.');
    }
    const updated = [
      ...commonHomeworkBooks,
      { id: `c_book_${Date.now()}`, name: trimmed, range: '', status: '미체크' },
    ];
    setCommonHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
    setCommonNewBookName('');
    setShowCommonAddBookInput(false);
  };

  const handleAddCommonBookFromChip = (bookName) => {
    if (commonHomeworkBooks.some((b) => b.name === bookName)) {
      showToast(`ℹ️ '${bookName}' 교재는 이미 목록에 있습니다.`);
      return;
    }
    const updated = [
      ...commonHomeworkBooks,
      { id: `c_book_${Date.now()}`, name: bookName, range: '', status: '미체크' },
    ];
    setCommonHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
    showToast(`📚 '${bookName}' 교재가 오늘 숙제 목록에 추가되었습니다.`);
  };

  const handleRemoveCommonBook = (id) => {
    const updated = commonHomeworkBooks.filter((b) => b.id !== id);
    setCommonHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
  };

  const handleCommonBookRangeChange = (id, newRange) => {
    setCommonHomeworkBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, range: newRange } : b))
    );
  };

  const handleCommonBookNameChange = (id, newName) => {
    const updated = commonHomeworkBooks.map((b) =>
      b.id === id ? { ...b, name: newName } : b
    );
    setCommonHomeworkBooks(updated);
    saveRecentBooksToCache(updated);
  };

  // 👥 판서수업: 학생별 상태 조작 핸들러들
  const handleToggleBatchStudentInclude = (studentId) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, included: !s.included } : s))
    );
  };

  const handleBatchAttendanceChange = (studentId, status) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, attendanceStatus: status } : s))
    );
  };

  const handleBatchLatenessChange = (studentId, minutes) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, latenessMinutes: minutes } : s))
    );
  };

  const handleBatchScoreChange = (studentId, key, score) => {
    setBatchStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? { ...s, scores: { ...s.scores, [key]: Number(score) } }
          : s
      )
    );
  };

  const handleBatchToggleScoreEditor = (studentId) => {
    setBatchStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId ? { ...s, showScoreEditor: !s.showScoreEditor } : s
      )
    );
  };

  const handleBatchTestTypeChange = (studentId, type) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, testType: type } : s))
    );
  };

  const handleBatchTestScoreChange = (studentId, score) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, testScore: score } : s))
    );
  };

  const handleBatchCommentChange = (studentId, comment) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, comment } : s))
    );
  };

  // 👥 판서수업: 일괄 빠른 변경 도구들
  const handleSetAllStudentsAttendance = (status) => {
    setBatchStudents((prev) =>
      prev.map((s) => ({ ...s, attendanceStatus: status }))
    );
    showToast(`✅ 모든 학생의 출결 상태가 '${status === 'ATTEND' ? '출석' : status === 'LATE' ? '지각' : '결석'}'(으)로 일괄 변경되었습니다.`);
  };

  const handleSetAllStudentsScore = (targetScore) => {
    setBatchStudents((prev) =>
      prev.map((s) => ({
        ...s,
        scores: {
          concept: targetScore,
          calc: targetScore,
          app: targetScore,
          attitude: targetScore,
          homework: targetScore,
          perseverance: targetScore,
        },
      }))
    );
    showToast(`🎯 모든 학생의 6대 역량 점수가 ${targetScore}점으로 일괄 변경되었습니다.`);
  };

  const handleSetAllStudentsPrevScores = () => {
    setBatchStudents((prev) =>
      prev.map((s) => ({
        ...s,
        scores: s.initialScores || {
          concept: 8,
          calc: 8,
          app: 8,
          attitude: 8,
          homework: 8,
          perseverance: 8,
        },
      }))
    );
    showToast('🔄 모든 학생의 점수가 직전 피드백 점수로 일괄 복원되었습니다.');
  };

  const handleToggleSelectAllStudents = () => {
    const allIncluded = batchStudents.every((s) => s.included);
    setBatchStudents((prev) => prev.map((s) => ({ ...s, included: !allIncluded })));
  };

  const renderScoreDiffBadge = (currentScore, prevScore) => {
    if (prevScore === undefined || prevScore === null) return null;
    const diff = Number(currentScore) - Number(prevScore);
    if (diff > 0) {
      return (
        <span className="text-[9.5px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 whitespace-nowrap shrink-0">
          <span>▲</span>+{diff} (직전 {prevScore})
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="text-[9.5px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 whitespace-nowrap shrink-0">
          <span>▼</span>{diff} (직전 {prevScore})
        </span>
      );
    }
    return (
      <span className="text-[9.5px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
        - (직전 {prevScore})
      </span>
    );
  };

  // 초기 반 및 학생 데이터 로드
  const fetchData = async (currentUser) => {
    try {
      const { data: cData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', currentUser.id);
      
      const classList = cData || [];
      setClasses(classList);

      if (classList.length > 0) {
        const initialClassId = String(classList[0].id);
        setSelectedClassId(initialClassId);
        
        // 반 수업 유형 확인
        try {
          const stored = localStorage.getItem('poom_class_types');
          const types = stored ? JSON.parse(stored) : {};
          setEvalMode(types[initialClassId] || 'LECTURE');
        } catch (e) {
          setEvalMode('LECTURE');
        }

        fetchClassStudents(initialClassId);
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

  // 특정 반의 소속 학생 및 일괄 데이터 불러오기
  const fetchClassStudents = async (classId) => {
    try {
      const { data: csData } = await supabase
        .from('class_students')
        .select('student_id, users(id, name, email, parent_phone)')
        .eq('class_id', classId);

      if (!csData) return;

      const stList = csData.map((item) => item.users).filter(Boolean);
      setStudents(stList);
      if (stList.length > 0) setSelectedStudentId(stList[0].id);
      else setSelectedStudentId('');

      if (stList.length === 0) {
        setBatchStudents([]);
        setCommonClassUsedBooks([]);
        return;
      }

      // 이 반 학생들의 최근 피드백 기록 일괄 조회
      const studentIds = stList.map((s) => s.id);
      const { data: batchEvals } = await supabase
        .from('daily_evaluations')
        .select('*')
        .in('student_id', studentIds)
        .order('eval_date', { ascending: false });

      const allEvals = batchEvals || [];

      // 1) 반 전체 학생들이 사용했던 고유 교재명 추출 (칩 생성용)
      const uniqueBooks = extractAllUniqueBookNamesFromEvaluations(allEvals);
      setCommonClassUsedBooks(uniqueBooks);

      // 2) 학생별 일괄 상태 객체 생성
      const initialBatchList = stList.map((st) => {
        const studentRecentEvals = allEvals.filter((e) => e.student_id === st.id);
        const prev = studentRecentEvals.length > 0 ? studentRecentEvals[0] : null;

        const scores = {
          concept: 8,
          calc: 8,
          app: 8,
          attitude: 8,
          homework: 8,
          perseverance: 8,
        };

        let customItemsList = [];
        let activeKeys = ['concept', 'calc', 'app', 'attitude', 'homework', 'perseverance'];

        if (prev) {
          const parsed = parseEvaluationRecord(prev);
          DEFAULT_EVAL_KEYS.forEach((def) => {
            const val = prev[def.dbCol];
            if (val !== null && val !== undefined) {
              scores[def.key] = Number(val);
            }
          });
          if (parsed.customItems && parsed.customItems.length > 0) {
            customItemsList = parsed.customItems.map((c, idx) => ({
              id: `custom_${st.id}_${idx}`,
              name: c.name,
              score: Number(c.score) || 8,
            }));
          }
        }

        return {
          student_id: st.id,
          name: st.name,
          email: st.email,
          parent_phone: st.parent_phone,
          included: true,
          attendanceStatus: 'ATTEND',
          latenessMinutes: 5,
          scores: { ...scores },
          initialScores: { ...scores },
          activeKeys,
          customItems: customItemsList,
          testType: '단원평가',
          customTestType: '',
          testScore: '',
          comment: '',
          showScoreEditor: false,
          prevEvalSummary: prev ? `${prev.eval_date} 피드백` : '첫 피드백',
          isSaved: false,
        };
      });

      setBatchStudents(initialBatchList);
    } catch (err) {
      console.error('fetchClassStudents error:', err);
    }
  };

  // 1️⃣ 1:1 개별 피드백 저장 핸들러
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
        lessonProgress: todayLessonProgress,
        homeworkBooks: todayHomeworkBooks.filter((b) => b.name && b.range),
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
          `⚠️ [${studentName}] 학생의 ${evalDate} 날짜 피드백이 이미 작성되어 있습니다.\n\n새로 작성한 내용으로 수정(덮어쓰기)하시겠습니까?`
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

      saveRecentBooksToCache(todayHomeworkBooks);
      fetchStudentEvaluationHistory(selectedStudentId, evalDate);
      alert(`🎉 [${studentName}] 학생의 ${evalDate} 일일 피드백 및 과제표 저장이 완료되었습니다!`);
    } catch (err) {
      console.error(err);
      alert(`저장 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  // 2️⃣ 👥 판서수업: 반 전체 일괄 등록 핸들러
  const handleBatchSubmit = async (e) => {
    e.preventDefault();

    const targets = batchStudents.filter((s) => s.included);
    if (targets.length === 0) {
      return alert('등록할 학생을 최소 1명 이상 선택해 주세요.');
    }

    const validBooks = commonHomeworkBooks.filter((b) => b.name && b.range);
    if (!commonLessonProgress.trim() && validBooks.length === 0) {
      const proceed = confirm('⚠️ 오늘 진도와 숙제 범위가 모두 비어있습니다. 그래도 등록하시겠습니까?');
      if (!proceed) return;
    }

    const currentClass = classes.find((c) => String(c.id) === String(selectedClassId));
    const className = currentClass ? currentClass.name : '해당 반';

    if (!confirm(`🚀 [${className}] 학생 총 ${targets.length}명의 피드백 및 공통 과제표를 일괄 등록하시겠습니까?`)) {
      return;
    }

    setBatchSubmitting(true);
    setBatchProgressText('피드백 데이터를 준비하는 중...');

    try {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < targets.length; i++) {
        const st = targets[i];
        setBatchProgressText(`(${i + 1}/${targets.length}) [${st.name}] 학생 피드백 저장 중...`);

        const effectiveTestType = st.testType === '기타' ? (st.customTestType.trim() || '기타평가') : st.testType;

        const combinedComment = formatTeacherCommentWithTestScoreAndItems({
          comment: st.comment,
          testScore: st.testScore,
          testType: effectiveTestType,
          customItems: st.customItems || [],
          lessonProgress: commonLessonProgress,
          homeworkBooks: validBooks,
        });

        const payload = {
          teacher_id: user.id,
          student_id: st.student_id,
          eval_date: evalDate,
          attendance_status: st.attendanceStatus,
          lateness_minutes: st.attendanceStatus === 'LATE' ? parseInt(st.latenessMinutes || 5) : 0,
          concept_score: st.scores.concept,
          calc_score: st.scores.calc,
          app_score: st.scores.app,
          attitude_score: st.scores.attitude,
          homework_score: st.scores.homework,
          perseverance_score: st.scores.perseverance,
          teacher_comment: combinedComment,
        };

        // 기존 평가 존재 여부 확인
        const { data: existing, error: findErr } = await supabase
          .from('daily_evaluations')
          .select('id')
          .eq('student_id', st.student_id)
          .eq('eval_date', evalDate)
          .maybeSingle();

        if (findErr) throw findErr;

        if (existing) {
          const { error: updErr } = await supabase
            .from('daily_evaluations')
            .update(payload)
            .eq('id', existing.id);
          if (updErr) errorCount++;
          else successCount++;
        } else {
          const { error: insErr } = await supabase
            .from('daily_evaluations')
            .insert([payload]);
          if (insErr) errorCount++;
          else successCount++;
        }
      }

      saveRecentBooksToCache(commonHomeworkBooks);
      
      // 일괄 저장 완료 후 상태 업데이트
      setBatchStudents((prev) =>
        prev.map((s) => (s.included ? { ...s, isSaved: true } : s))
      );

      alert(`🎉 [${className}] 총 ${successCount}명의 피드백 및 공통 과제표가 일괄 등록되었습니다!${errorCount > 0 ? ` (실패: ${errorCount}건)` : ''}`);
    } catch (err) {
      console.error('handleBatchSubmit error:', err);
      alert(`일괄 등록 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setBatchSubmitting(false);
      setBatchProgressText('');
    }
  };

  const currentStudent = students.find((s) => s.id === selectedStudentId);
  const currentStudentName = currentStudent ? currentStudent.name : '해당 학생';
  const currentClassObj = classes.find((c) => String(c.id) === String(selectedClassId));
  const currentClassName = currentClassObj ? currentClassObj.name : '';

  // 1:1 모드용 이 학생의 고유 교재명 칩 목록
  const studentUniqueBooks = extractAllUniqueBookNamesFromEvaluations(studentEvals);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-bold text-gray-600">피드백 작성 페이지를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 상단 헤더 바 */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 sm:py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h1 className="text-sm sm:text-base font-black text-slate-800">
            학습 피드백 및 과제표 관리
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/teacher/eval/history')}
            className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200 transition"
          >
            📋 피드백 히스토리
          </button>
          <button onClick={() => router.back()} className="text-xs sm:text-sm text-gray-600 hover:underline">
            ← 뒤로가기
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-gray-200 shadow-xs space-y-6">
          
          {/* 타이틀 및 수업 방식(모드) 전환 탭 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                <span>✍️</span>
                <span>일일 학습 피드백 & 과제표 작성</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {evalMode === 'LECTURE'
                  ? '👥 판서수업 모드: 반 전체 공통 진도 및 과제를 한 번에 작성하고 일괄 등록합니다.'
                  : '👤 개별수업 모드: 학생별 1:1 맞춤 진도, 개별 과제 및 6대 역량을 세밀하게 기록합니다.'}
              </p>
            </div>

            {/* 듀얼 모드 전환 탭 */}
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleToggleEvalMode('LECTURE')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  evalMode === 'LECTURE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👥</span>
                <span>판서수업 (반 일괄)</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleEvalMode('INDIVIDUAL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  evalMode === 'INDIVIDUAL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👤</span>
                <span>개별수업 (1:1 맞춤)</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 👥 [모드 1] 판서수업 (반 전체 공통 진도 & 과제 일괄 등록 모드) */}
          {/* ========================================================================= */}
          {evalMode === 'LECTURE' ? (
            <form onSubmit={handleBatchSubmit} className="space-y-6">
              {/* 1. 반 및 날짜 선택 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">🏫 담당 반 선택</label>
                  <select
                    value={selectedClassId}
                    onChange={handleClassChange}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>📘 {cls.name} ({classTypes[cls.id] === 'INDIVIDUAL' ? '개별' : '판서'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">📅 수업 날짜</label>
                  <input
                    type="date"
                    value={evalDate}
                    onChange={(e) => setEvalDate(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* 2. 📢 오늘 반 공통 진도 및 공통 숙제 (1회만 작성) */}
              <div className="bg-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/70 pb-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-base shrink-0">📢</span>
                    <span className="text-xs font-black text-indigo-950 truncate sm:whitespace-normal">
                      [{currentClassName || '반'}] 오늘 공통 학습 진도 및 과제 부여 (전체 동일)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCommonAddBookInput(!showCommonAddBookInput)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 self-start sm:self-auto"
                  >
                    <span>+</span>
                    <span>교재 추가</span>
                  </button>
                </div>

                {/* 공통 학습 진도 */}
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    🎯 오늘 나간 공통 진도:
                  </label>
                  <input
                    type="text"
                    value={commonLessonProgress}
                    onChange={(e) => setCommonLessonProgress(e.target.value)}
                    placeholder="예: 수1 3단원 삼각함수의 그래프 45p ~ 52p 개념 및 필수예제"
                    className="w-full p-2.5 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                {/* 교재 인라인 추가 인풋 */}
                {showCommonAddBookInput && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-300 flex gap-2 items-center animate-fade-in">
                    <input
                      type="text"
                      value={commonNewBookName}
                      onChange={(e) => setCommonNewBookName(e.target.value)}
                      placeholder="새 교재명 입력 (예: 쎈 수학, 일품, 모의고사 등)"
                      className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCommonBook();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCommonBook}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs shrink-0"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCommonAddBookInput(false); setCommonNewBookName(''); }}
                      className="text-slate-400 hover:text-slate-600 text-xs px-2 shrink-0"
                    >
                      취소
                    </button>
                  </div>
                )}

                {/* 기존 사용 교재 칩 버튼 */}
                {commonClassUsedBooks.length > 0 && (
                  <div className="p-3 bg-indigo-100/50 rounded-xl border border-indigo-200/60 space-y-1.5">
                    <span className="text-[11px] font-extrabold text-indigo-900 block flex items-center gap-1">
                      <span>🏷️</span>
                      <span>이 반의 기존 사용 교재 빠른 추가:</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {commonClassUsedBooks.map((name) => {
                        const isAlreadyAdded = commonHomeworkBooks.some((b) => b.name === name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleAddCommonBookFromChip(name)}
                            disabled={isAlreadyAdded}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                              isAlreadyAdded
                                ? 'bg-indigo-200/50 text-indigo-400 cursor-not-allowed border border-indigo-200/30'
                                : 'bg-white hover:bg-indigo-600 hover:text-white text-indigo-800 border border-indigo-300 shadow-2xs active:scale-95'
                            }`}
                          >
                            <span>{isAlreadyAdded ? '✓' : '+'}</span>
                            <span>{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 교재 및 과제 범위 리스트 */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold text-indigo-900">
                    📚 공통 과제 교재 및 범위:
                  </span>
                  {commonHomeworkBooks.map((book) => (
                    <div
                      key={book.id}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs"
                    >
                      <div className="w-full sm:w-1/3">
                        <input
                          type="text"
                          value={book.name}
                          onChange={(e) => handleCommonBookNameChange(book.id, e.target.value)}
                          placeholder="교재명"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={book.range}
                          onChange={(e) => handleCommonBookRangeChange(book.id, e.target.value)}
                          placeholder="과제 범위 입력 (예: 45p ~ 52p 또는 120번 ~ 145번)"
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-950 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      {commonHomeworkBooks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCommonBook(book.id)}
                          className="text-slate-400 hover:text-rose-500 font-bold text-xs p-1 self-end sm:self-center"
                          title="교재 삭제"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. 👥 반 학생 목록 및 개별 항목 체크 테이블 */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-800">
                      👥 소속 학생 명단 (총 {batchStudents.length}명)
                    </span>
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                      {batchStudents.filter((s) => s.included).length}명 선택됨
                    </span>
                  </div>

                  {/* 일괄 빠른 도구들 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllStudents}
                      className="text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border"
                    >
                      전체 선택/해제
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllStudentsAttendance('ATTEND')}
                      className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      모두 출석
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllStudentsScore(8)}
                      className="text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200"
                    >
                      모두 8점
                    </button>
                    <button
                      type="button"
                      onClick={handleSetAllStudentsPrevScores}
                      className="text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200"
                    >
                      모두 직전점수
                    </button>
                  </div>
                </div>

                {/* 학생 카드 리스트 */}
                {batchStudents.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                    이 반에 등록된 학생이 없습니다. 반 관리에서 학생을 배정해 주세요.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {batchStudents.map((st) => {
                      const totalScore = Object.values(st.scores).reduce((a, b) => a + Number(b), 0);
                      const avgScore = (totalScore / 6).toFixed(1);

                      return (
                        <div
                          key={st.student_id}
                          className={`p-4 rounded-2xl border transition space-y-3 ${
                            !st.included
                              ? 'bg-slate-50/60 border-slate-200 opacity-60'
                              : st.isSaved
                              ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
                              : 'bg-white border-slate-200/90 shadow-2xs hover:border-indigo-300'
                          }`}
                        >
                          {/* 1행: 체크박스 + 이름 + 출결 버튼 + 점수 슬라이더 토글 */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={st.included}
                                onChange={() => handleToggleBatchStudentInclude(st.student_id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div>
                                <span className="text-sm font-extrabold text-slate-800">{st.name}</span>
                                <span className="text-[11px] text-slate-400 font-medium ml-1.5">
                                  ({st.prevEvalSummary})
                                </span>
                              </div>
                              {st.isSaved && (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  ✅ 등록완료
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {/* 출결 3종 버튼 */}
                              <div className="flex gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleBatchAttendanceChange(st.student_id, 'ATTEND')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    st.attendanceStatus === 'ATTEND'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  🟢 출석
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBatchAttendanceChange(st.student_id, 'LATE')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    st.attendanceStatus === 'LATE'
                                      ? 'bg-amber-500 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  ⏰ 지각
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBatchAttendanceChange(st.student_id, 'ABSENT')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    st.attendanceStatus === 'ABSENT'
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  🔴 결석
                                </button>
                              </div>

                              {/* 지각 시 분 입력 */}
                              {st.attendanceStatus === 'LATE' && (
                                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                  <input
                                    type="number"
                                    min="1"
                                    max="120"
                                    value={st.latenessMinutes}
                                    onChange={(e) => handleBatchLatenessChange(st.student_id, e.target.value)}
                                    className="w-10 p-0.5 bg-white border border-amber-300 rounded text-center text-xs font-bold"
                                  />
                                  <span className="text-[11px] font-bold text-amber-900">분 지각</span>
                                </div>
                              )}

                              {/* 점수 요약 및 슬라이더 펼침 버튼 */}
                              <button
                                type="button"
                                onClick={() => handleBatchToggleScoreEditor(st.student_id)}
                                className={`text-xs px-2.5 py-1 rounded-xl font-extrabold border transition flex items-center gap-1.5 ${
                                  st.showScoreEditor
                                    ? 'bg-indigo-600 text-white border-indigo-700'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                }`}
                              >
                                <span>평균 {avgScore}점</span>
                                {st.initialScores && (() => {
                                  const prevTot = Object.values(st.initialScores).reduce((a, b) => a + Number(b), 0);
                                  const prevAvg = (prevTot / 6).toFixed(1);
                                  const diff = Number((avgScore - prevAvg).toFixed(1));
                                  if (diff > 0) return <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">▲+{diff}</span>;
                                  if (diff < 0) return <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1 py-0.2 rounded">▼{diff}</span>;
                                  return null;
                                })()}
                                <span className="text-[10px]">{st.showScoreEditor ? '▲ 접기' : '⚙️ 점수조절'}</span>
                              </button>
                            </div>
                          </div>

                          {/* 2행: 시험 성적 및 개별 코멘트 입력칸 */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-1.5 sm:col-span-1">
                              <select
                                value={st.testType}
                                onChange={(e) => handleBatchTestTypeChange(st.student_id, e.target.value)}
                                className="p-1.5 border rounded-lg text-xs bg-slate-50 font-bold text-slate-800 shrink-0"
                              >
                                <option value="단원평가">📘 단원평가</option>
                                <option value="일일테스트">⚡ 일일테스트</option>
                                <option value="주간테스트">📝 주간테스트</option>
                                <option value="모의고사">🎯 모의고사</option>
                              </select>
                              <input
                                type="text"
                                value={st.testScore}
                                onChange={(e) => handleBatchTestScoreChange(st.student_id, e.target.value)}
                                placeholder="시험점수(선택)"
                                className="w-full p-1.5 bg-white border rounded-lg text-xs font-bold placeholder:text-slate-400"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={st.comment}
                                onChange={(e) => handleBatchCommentChange(st.student_id, e.target.value)}
                                placeholder="학생별 특이사항이나 칭찬 메모 (비워두면 학부모 화면에 코멘트 영역이 숨겨집니다)"
                                className="w-full p-1.5 bg-white border rounded-lg text-xs font-medium placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* 펼쳐진 6대 역량 점수 슬라이더 에디터 */}
                          {st.showScoreEditor && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs animate-fade-in">
                              {DEFAULT_EVAL_KEYS.map((def) => {
                                const prevVal = st.initialScores?.[def.key];
                                return (
                                  <div key={def.key} className="bg-white p-2.5 rounded-xl border border-slate-200/90 space-y-1.5 shadow-2xs">
                                    <div className="flex justify-between items-center text-[11px] font-bold">
                                      <span className="text-slate-700">{def.name}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {renderScoreDiffBadge(st.scores[def.key], prevVal)}
                                        <span className="text-blue-600 font-black text-xs">{st.scores[def.key]}점</span>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      value={st.scores[def.key]}
                                      onChange={(e) => handleBatchScoreChange(st.student_id, def.key, e.target.value)}
                                      className="w-full accent-blue-600 h-1.5 cursor-pointer"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. 일괄 등록 버튼 */}
              <button
                type="submit"
                disabled={batchSubmitting}
                className={`w-full font-black py-4 px-4 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2 ${
                  batchSubmitting
                    ? 'bg-slate-400 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-98'
                }`}
              >
                <span className="text-base shrink-0">🚀</span>
                <span className="leading-snug">
                  {batchSubmitting
                    ? batchProgressText || '일괄 등록 진행 중...'
                    : `[${currentClassName || '반'}] 학생 전체 (${batchStudents.filter((s) => s.included).length}명) 피드백 일괄 등록`}
                </span>
              </button>
            </form>
          ) : (
            /* ========================================================================= */
            /* 👤 [모드 2] 개별수업 (학생별 1:1 맞춤 진도/과제 작성 모드) */
            /* ========================================================================= */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. 반 / 학생 / 수업일자 선택 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
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

              {/* 📖 오늘 수업 진도 및 새 숙제 부여 섹션 */}
              <div className="bg-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-200/80 space-y-4">
                <div className="flex justify-between items-center border-b border-indigo-200/70 pb-2">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <span>📖</span>
                    <span>오늘 수업 진도 및 새 과제 부여</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddBookInput(!showAddBookInput)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs"
                  >
                    <span>+</span>
                    <span>교재 추가</span>
                  </button>
                </div>

                {/* 오늘 나간 진도 입력창 */}
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    🎯 오늘 나간 학습 진도:
                  </label>
                  <input
                    type="text"
                    value={todayLessonProgress}
                    onChange={(e) => setTodayLessonProgress(e.target.value)}
                    placeholder="예: 02. 항등식과 나머지정리 (또는 3단원 소수와 합성수 개념 학습)"
                    className="w-full p-2.5 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                {/* 새 교재 인라인 추가 폼 */}
                {showAddBookInput && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-300 flex gap-2 items-center animate-fade-in">
                    <input
                      type="text"
                      value={newBookName}
                      onChange={(e) => setNewBookName(e.target.value)}
                      placeholder="새 교재명 입력 (예: 쎈 수학, 블랙라벨, 모의고사 프린트 등)"
                      className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTodayBook();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddTodayBook}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs shrink-0"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddBookInput(false); setNewBookName(''); }}
                      className="text-slate-400 hover:text-slate-600 text-xs px-2 shrink-0"
                    >
                      취소
                    </button>
                  </div>
                )}

                {/* 이 학생이 이전에 사용했던 교재 목록 빠른 추가 칩 */}
                {studentUniqueBooks.length > 0 && (
                  <div className="p-3 bg-indigo-100/50 rounded-xl border border-indigo-200/60 space-y-1.5">
                    <span className="text-[11px] font-extrabold text-indigo-900 block flex items-center gap-1">
                      <span>🏷️</span>
                      <span>기존 사용 교재 빠른 추가 (클릭 시 새 과제에 추가):</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {studentUniqueBooks.map((name) => {
                        const isAlreadyAdded = todayHomeworkBooks.some((b) => b.name === name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              const updated = [
                                ...todayHomeworkBooks,
                                { id: `book_${Date.now()}`, name, range: '', status: '미체크' },
                              ];
                              setTodayHomeworkBooks(updated);
                              saveRecentBooksToCache(updated);
                              showToast(`📚 '${name}' 교재가 오늘 숙제 목록에 추가되었습니다.`);
                            }}
                            disabled={isAlreadyAdded}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                              isAlreadyAdded
                                ? 'bg-indigo-200/50 text-indigo-400 cursor-not-allowed border border-indigo-200/30'
                                : 'bg-white hover:bg-indigo-600 hover:text-white text-indigo-800 border border-indigo-300 shadow-2xs active:scale-95'
                            }`}
                          >
                            <span>{isAlreadyAdded ? '✓' : '+'}</span>
                            <span>{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 교재별 과제 범위 입력 목록 */}
                <div className="space-y-2.5">
                  <span className="block text-[11px] font-bold text-indigo-900">
                    📚 교재별 숙제 범위 설정:
                  </span>
                  {todayHomeworkBooks.map((book) => (
                    <div
                      key={book.id}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs"
                    >
                      <div className="w-full sm:w-1/3">
                        <input
                          type="text"
                          value={book.name}
                          onChange={(e) => handleTodayBookNameChange(book.id, e.target.value)}
                          placeholder="교재명 (예: 개념서, 쎈, 일품)"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={book.range}
                          onChange={(e) => handleTodayBookRangeChange(book.id, e.target.value)}
                          placeholder="과제 범위 입력 (예: 21p ~ 35p 또는 105번 ~ 140번)"
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-950 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
                        />
                      </div>

                      {todayHomeworkBooks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTodayBook(book.id)}
                          className="text-slate-400 hover:text-rose-500 font-bold text-xs p-1 self-end sm:self-center"
                          title="교재 삭제"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 출결 상태 선택 */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                <span className="text-xs font-extrabold text-amber-900 block">⏰ 출석 및 지각 상태 기록</span>
                <div className="flex gap-2">
                  {[
                    { key: 'ATTEND', label: '🟢 정상 출석', desc: '지각 없음' },
                    { key: 'LATE', label: '⏰ 지각', desc: '도착 지연' },
                    { key: 'ABSENT', label: '🔴 결석', desc: '수업 불참' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setAttendanceStatus(item.key)}
                      className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                        attendanceStatus === item.key
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100/50'
                      }`}
                    >
                      <div className="font-extrabold">{item.label}</div>
                    </button>
                  ))}
                </div>

                {attendanceStatus === 'LATE' && (
                  <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-amber-300 animate-fade-in">
                    <label className="text-xs font-bold text-amber-900">지각 시간:</label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={latenessMinutes}
                      onChange={(e) => setLatenessMinutes(e.target.value)}
                      className="w-20 p-1.5 border border-amber-300 rounded-lg text-xs font-black text-center"
                    />
                    <span className="text-xs font-bold text-amber-800">분 늦게 도착</span>
                  </div>
                )}
              </div>

              {/* 6대 기본 역량 및 슬라이더 */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>학습 성취도 평가 항목 설정 (선택된 항목만 리포트에 반영)</span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      버튼을 눌러 평가할 항목을 켜고 끌 수 있습니다.
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setShowAddCustomInput(!showAddCustomInput)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs self-start sm:self-auto"
                  >
                    <span>+</span>
                    <span>직접 항목 추가</span>
                  </button>
                </div>

                {showAddCustomInput && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 flex gap-2 items-center animate-fade-in">
                    <input
                      type="text"
                      value={newCustomName}
                      onChange={(e) => setNewCustomName(e.target.value)}
                      placeholder="새 평가 항목명 입력 (예: 질문 적극성, 오답노트 작성도)"
                      className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs"
                    >
                      추가
                    </button>
                  </div>
                )}

                {/* 6대 기본 항목 토글 버튼 */}
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_EVAL_KEYS.map((def) => {
                    const isActive = activeDefaultKeys.includes(def.key);
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => toggleDefaultKey(def.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 line-through'
                        }`}
                      >
                        <span>{isActive ? '✓' : '✕'}</span>
                        <span>{def.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 점수 슬라이더 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {DEFAULT_EVAL_KEYS.filter((def) => activeDefaultKeys.includes(def.key)).map((def) => (
                    <div key={def.key} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-800">{def.name}</span>
                        <div className="flex items-center gap-2">
                          {prevEval && renderScoreDiffBadge(defaultScores[def.key], prevEval[def.dbCol])}
                          <span className="text-blue-600 font-black text-sm">{defaultScores[def.key]}점</span>
                        </div>
                      </div>
                      <input
                        type="range" min="1" max="10" value={defaultScores[def.key]}
                        onChange={(e) => setDefaultScores({ ...defaultScores, [def.key]: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  ))}

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

              {/* 시험 성적 기록 */}
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

                {testType === '기타' && (
                  <div className="animate-fade-in space-y-1">
                    <label className="block text-[11px] font-bold text-indigo-900">
                      ✍️ 기타 시험 명칭 직접 입력:
                    </label>
                    <input
                      type="text"
                      value={customTestType}
                      onChange={(e) => setCustomTestType(e.target.value)}
                      placeholder="예: 3월 월말평가, 중간고사 대비 모의테스트 등"
                      className="w-full p-2.5 border border-indigo-300 rounded-xl text-xs font-bold text-indigo-950 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                )}

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
              </div>

              {/* 선생님 총평 코멘트 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">✍️ 선생님 총평 코멘트</label>
                <textarea
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  placeholder="오늘 수업 성취 및 칭찬/보완할 점을 적어주세요. (비워두시면 학부모 리포트에서 코멘트 영역이 숨겨집니다)"
                  className="w-full p-3 border rounded-xl text-xs h-24 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition text-sm"
              >
                일일 피드백 및 과제표 저장하기
              </button>
            </form>
          )}

          {/* 📊 1:1 모드일 때 학생 누적 과제표 (실시간 수정 및 삭제 지원) */}
          {evalMode === 'INDIVIDUAL' && selectedStudentId && studentEvals.length > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <StudentHomeworkTable
                studentName={currentStudentName}
                evaluations={studentEvals}
                isEditable={true}
                onStatusChange={handleInlineHomeworkStatusChange}
                onUpdateEvaluation={handleUpdateEvaluation}
                onDeleteEvaluation={handleDeleteEvaluation}
              />
            </div>
          )}

          {/* ⚡ 실시간 변경 알림 토스트 */}
          {actionToast && (
            <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-slide-up">
              <span>⚡</span>
              <span>{actionToast}</span>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
