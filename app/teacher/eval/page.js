'use client';

import { useState, useEffect } from 'react';
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
  const [todayEvalRecord, setTodayEvalRecord] = useState(null);
  const [todayParsedRecord, setTodayParsedRecord] = useState(null);
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

  // 알림톡 자동 발송 체크 상태 (기본 false: 과금 방지)
  const [sendAlimtalk, setSendAlimtalk] = useState(false);

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
  const [commonCustomTestType, setCommonCustomTestType] = useState('');

  // 판서수업: 학생별 커스텀 평가 항목 추가 입력 상태 (studentId -> 값)
  const [batchShowAddCustomMap, setBatchShowAddCustomMap] = useState({});
  const [batchNewCustomNameMap, setBatchNewCustomNameMap] = useState({});

  // 👥 판서수업(반 일괄)용 누적 과제표 검사 모달 상태 및 반 전체 평가 기록
  const [homeworkModalStudent, setHomeworkModalStudent] = useState(null);
  const [classAllEvals, setClassAllEvals] = useState([]);

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

  // 수업 모드 수동 전환 (판서수업 <-> 개별수업) & 진도/과제 데이터 양방향 자동 동기화
  const handleToggleEvalMode = (newMode) => {
    if (newMode === 'LECTURE') {
      // 1:1 개별 모드 -> 판서수업(반 일괄) 전환
      if (todayLessonProgress && !commonLessonProgress) {
        setCommonLessonProgress(todayLessonProgress);
      }
      const validTodayBooks = todayHomeworkBooks.filter((b) => b.name && b.range);
      if (validTodayBooks.length > 0) {
        setCommonHomeworkBooks(todayHomeworkBooks);
      }
      showToast('🔄 개별 모드의 진도/과제가 일괄 모드로 자동 동기화되었습니다.');
    } else if (newMode === 'INDIVIDUAL') {
      // 판서수업(반 일괄) -> 1:1 개별 모드 전환
      if (commonLessonProgress && !todayLessonProgress) {
        setTodayLessonProgress(commonLessonProgress);
      }
      const validCommonBooks = commonHomeworkBooks.filter((b) => b.name && b.range);
      if (validCommonBooks.length > 0) {
        setTodayHomeworkBooks(commonHomeworkBooks);
      }
      showToast('🔄 일괄 모드의 공통 진도/과제가 개별 모드로 자동 동기화되었습니다.');
    }

    setEvalMode(newMode);
    if (selectedClassId) {
      const updated = { ...classTypes, [selectedClassId]: newMode };
      setClassTypes(updated);
      try {
        localStorage.setItem('poom_class_types', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  // 날짜 변경 시 판서수업 학생 상태 갱신
  useEffect(() => {
    if (selectedClassId && evalMode === 'LECTURE') {
      fetchClassStudents(selectedClassId);
    }
  }, [evalDate]);

  // 선택된 학생이나 날짜가 변경될 때 해당 학생의 전체 기록 및 직전 기록 조회 (1:1 개별 모드)
  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentEvaluationHistory(selectedStudentId, evalDate);
    } else {
      setStudentEvals([]);
      setPrevEval(null);
      setTodayEvalRecord(null);
      setTodayParsedRecord(null);
    }
  }, [selectedStudentId, evalDate]);

  // 개별 모드용 학생 기록 조회
  const fetchStudentEvaluationHistory = async (studentId, currentDate) => {
    try {
      setLoadingPrevEval(true);
      const res = await fetch(`/api/eval?studentId=${encodeURIComponent(studentId)}`);
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '조회 실패');

      const evals = resData.evaluations || [];
      setStudentEvals(evals);

      // 현재 선택된 날짜의 평가가 이미 작성되었는지 확인
      const todayEval = evals.find((e) => e.eval_date === currentDate);
      setTodayEvalRecord(todayEval || null);
      setTodayParsedRecord(todayEval ? parseEvaluationRecord(todayEval) : null);

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

      const res = await fetch(`/api/eval/${evalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherComment: updatedComment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '수정 실패');
      }

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

      const res = await fetch(`/api/eval/${evalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherComment: updatedComment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '수정 실패');
      }

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
      const res = await fetch(`/api/eval/${evalId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '삭제 실패');
      }

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

  const handleBatchRemoveDefaultKey = (studentId, key) => {
    setBatchStudents((prev) =>
      prev.map((s) => {
        if (s.student_id !== studentId) return s;
        const currentKeys = s.activeKeys || ['concept', 'calc', 'app', 'attitude', 'homework', 'perseverance'];
        if (currentKeys.length <= 1 && (!s.customItems || s.customItems.length === 0)) {
          alert('최소 1개 이상의 평가 항목이 필요합니다.');
          return s;
        }
        return {
          ...s,
          activeKeys: currentKeys.filter((k) => k !== key),
        };
      })
    );
  };

  const handleBatchAddDefaultKey = (studentId, key) => {
    setBatchStudents((prev) =>
      prev.map((s) => {
        if (s.student_id !== studentId) return s;
        const currentKeys = s.activeKeys || ['concept', 'calc', 'app', 'attitude', 'homework', 'perseverance'];
        if (currentKeys.includes(key)) return s;
        return {
          ...s,
          activeKeys: [...currentKeys, key],
        };
      })
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

  const handleBatchCustomTestTypeChange = (studentId, value) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, customTestType: value } : s))
    );
  };

  const handleBatchCommentChange = (studentId, comment) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, comment } : s))
    );
  };

  // 👥 판서수업(반 일괄)용 모달 내 과제표 상태 실시간 변경 핸들러
  const handleModalHomeworkStatusChange = async (evalId, bookName, newStatus) => {
    try {
      const targetEval = classAllEvals.find((e) => e.id === evalId);
      if (!targetEval) return;

      const updatedComment = updateBookStatusInComment(
        targetEval.teacher_comment,
        bookName,
        newStatus
      );

      const res = await fetch(`/api/eval/${evalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherComment: updatedComment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '수정 실패');
      }

      setClassAllEvals((prev) =>
        prev.map((item) =>
          item.id === evalId ? { ...item, teacher_comment: updatedComment } : item
        )
      );

      showToast(`✅ [${homeworkModalStudent?.name || '학생'}]의 [${bookName}] 과제 상태가 '${newStatus}'(으)로 변경되었습니다.`);
    } catch (err) {
      console.error('handleModalHomeworkStatusChange error:', err);
      alert('과제 상태 수정 중 오류가 발생했습니다.');
    }
  };

  const handleModalUpdateEvaluation = async (evalId, updatedProgress, updatedBooks) => {
    try {
      const targetEval = classAllEvals.find((e) => e.id === evalId);
      if (!targetEval) return;

      const updatedComment = updateEvaluationProgressAndBooksInComment(
        targetEval.teacher_comment,
        updatedProgress,
        updatedBooks
      );

      const res = await fetch(`/api/eval/${evalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherComment: updatedComment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '수정 실패');
      }

      setClassAllEvals((prev) =>
        prev.map((item) =>
          item.id === evalId ? { ...item, teacher_comment: updatedComment } : item
        )
      );

      showToast(`✅ ${targetEval.eval_date} 수업의 진도 및 과제 정보가 성공적으로 수정되었습니다.`);
    } catch (err) {
      console.error('handleModalUpdateEvaluation error:', err);
      alert('수정 내용 저장 중 오류가 발생했습니다.');
    }
  };

  const handleModalDeleteEvaluation = async (evalId, formattedDate) => {
    try {
      const res = await fetch(`/api/eval/${evalId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '삭제 실패');
      }

      setClassAllEvals((prev) => prev.filter((item) => item.id !== evalId));
      showToast(`🗑️ ${formattedDate} 피드백 및 과제 기록이 성공적으로 삭제되었습니다.`);
    } catch (err) {
      console.error('handleModalDeleteEvaluation error:', err);
      alert('기록 삭제 중 오류가 발생했습니다.');
    }
  };

  // 판서수업: 학생별 커스텀 평가 항목 추가/삭제/점수 조작
  const handleBatchToggleAddCustomInput = (studentId) => {
    setBatchShowAddCustomMap((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handleBatchCustomNameChange = (studentId, value) => {
    setBatchNewCustomNameMap((prev) => ({ ...prev, [studentId]: value }));
  };

  const handleBatchAddCustomItem = (studentId) => {
    const trimmed = (batchNewCustomNameMap[studentId] || '').trim();
    if (!trimmed) return alert('항목 이름을 입력해 주세요.');

    const target = batchStudents.find((s) => s.student_id === studentId);
    if (target && (target.customItems || []).some((c) => c.name === trimmed)) {
      return alert('이미 추가된 항목 이름입니다.');
    }

    setBatchStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              customItems: [
                ...(s.customItems || []),
                { id: `custom_${studentId}_${Date.now()}`, name: trimmed, score: 8 },
              ],
            }
          : s
      )
    );
    setBatchNewCustomNameMap((prev) => ({ ...prev, [studentId]: '' }));
    setBatchShowAddCustomMap((prev) => ({ ...prev, [studentId]: false }));
  };

  const handleBatchRemoveCustomItem = (studentId, itemId) => {
    setBatchStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? { ...s, customItems: (s.customItems || []).filter((c) => c.id !== itemId) }
          : s
      )
    );
  };

  const handleBatchCustomScoreChange = (studentId, itemId, newScore) => {
    setBatchStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              customItems: (s.customItems || []).map((c) =>
                c.id === itemId ? { ...c, score: Number(newScore) } : c
              ),
            }
          : s
      )
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

  const handleSetAllStudentsTestType = (type, customName = '') => {
    const trimmed = customName.trim();
    if (type === '기타' && !trimmed) {
      alert('기타 시험명을 입력해 주세요.');
      return;
    }
    setBatchStudents((prev) =>
      prev.map((s) => ({
        ...s,
        testType: type,
        customTestType: type === '기타' ? trimmed : s.customTestType,
      }))
    );
    const label = type === '기타' ? `기타 (${trimmed})` : type;
    showToast(`📝 모든 학생의 시험 종류가 '${label}'(으)로 일괄 변경되었습니다.`);
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
      const res = await fetch('/api/eval/classes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '조회 실패');

      const classList = data.classes || [];
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
        const stData = data.directStudents || [];
        setStudents(stData);
        if (stData.length > 0) setSelectedStudentId(stData[0].id);
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
      const res = await fetch(`/api/eval/class/${classId}`);
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '조회 실패');

      const stList = resData.students || [];
      setStudents(stList);
      if (stList.length > 0) setSelectedStudentId(stList[0].id);
      else setSelectedStudentId('');

      if (stList.length === 0) {
        setBatchStudents([]);
        setCommonClassUsedBooks([]);
        return;
      }

      const allEvals = resData.evaluations || [];
      setClassAllEvals(allEvals);

      // 1) 반 전체 학생들이 사용했던 고유 교재명 추출 (칩 생성용)
      const uniqueBooks = extractAllUniqueBookNamesFromEvaluations(allEvals);
      setCommonClassUsedBooks(uniqueBooks);

      // 2) 학생별 일괄 상태 객체 생성 (기존 작성 데이터가 있다면 100% 자동 복원)
      const initialBatchList = stList.map((st) => {
        const studentRecentEvals = allEvals.filter((e) => e.student_id === st.id);
        const todayEval = studentRecentEvals.find((e) => e.eval_date === evalDate);
        const prev = studentRecentEvals.find((e) => e.eval_date < evalDate) || (studentRecentEvals.length > 0 ? studentRecentEvals[0] : null);
        const parsedToday = todayEval ? parseEvaluationRecord(todayEval) : null;
        const parsedPrev = prev ? parseEvaluationRecord(prev) : null;

        const scores = {
          concept: 8,
          calc: 8,
          app: 8,
          attitude: 8,
          homework: 8,
          perseverance: 8,
        };

        const activeKeys = [];
        const targetEvalSource = todayEval || prev;
        if (targetEvalSource) {
          DEFAULT_EVAL_KEYS.forEach((def) => {
            const val = targetEvalSource[def.dbCol];
            if (val !== null && val !== undefined) {
              scores[def.key] = Number(val);
              activeKeys.push(def.key);
            }
          });
        }

        const finalActiveKeys = activeKeys.length > 0
          ? activeKeys
          : ['concept', 'calc', 'app', 'attitude', 'homework', 'perseverance'];

        let customItemsList = [];
        const parsedSource = parsedToday || parsedPrev;
        if (parsedSource?.customItems && parsedSource.customItems.length > 0) {
          customItemsList = parsedSource.customItems.map((c, idx) => ({
            id: `custom_${st.id}_${idx}`,
            name: c.name,
            score: Number(c.score) || 8,
          }));
        }

        // 시험 종류 및 커스텀 시험명 판별
        let effectiveTestType = parsedToday?.testType || '단원평가';
        let customTestTypeValue = '';
        const standardTypes = ['단원평가', '일일테스트', '주간테스트', '모의고사'];
        if (parsedToday?.testType && !standardTypes.includes(parsedToday.testType)) {
          effectiveTestType = '기타';
          customTestTypeValue = parsedToday.testType;
        }

        return {
          student_id: st.id,
          name: st.name,
          email: st.email,
          parent_phone: st.parent_phone,
          included: true,
          attendanceStatus: todayEval?.attendance_status || 'ATTEND',
          latenessMinutes: todayEval?.lateness_minutes || 5,
          activeKeys: finalActiveKeys,
          scores: { ...scores },
          initialScores: { ...scores },
          customItems: customItemsList,
          testType: effectiveTestType,
          customTestType: customTestTypeValue,
          testScore: parsedToday?.testScore || '',
          comment: parsedToday?.comment || '',
          showScoreEditor: false,
          prevEvalSummary: prev ? `${prev.eval_date} 피드백` : '첫 피드백',
          isSaved: !!todayEval,
          alimtalkSentAt: parsedToday?.alimtalkSentAt || null,
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
      const existingEval = todayEvalRecord;

      if (existingEval && existingEval.teacher_id && existingEval.teacher_id !== user.id) {
        alert('⚠️ 이미 다른 강사님이 이 날짜에 기록을 남기셨습니다. 본인이 작성한 기록만 수정할 수 있습니다.');
        return;
      }

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

      if (existingEval) {
        const confirmOverwrite = confirm(
          `⚠️ [${studentName}] 학생의 ${evalDate} 날짜 피드백이 이미 작성되어 있습니다.\n\n새로 작성한 내용으로 수정(덮어쓰기)하시겠습니까?`
        );

        if (!confirmOverwrite) {
          alert('기존 피드백이 유지되었습니다.');
          return;
        }
      }

      const saveRes = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, evalDate, payload }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || '저장 실패');
      const evalId = saveData.id;

      // 📲 학부모 알림톡 자동 발송 (체크된 경우)
      let alimtalkNotice = '';
      if (sendAlimtalk && evalId) {
        try {
          const res = await fetch('/api/solapi/send-eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evalId,
              studentId: selectedStudentId,
              studentName: selectedStudent?.name || studentName,
              evalDate,
              parentPhone: selectedStudent?.parent_phone,
              teacherName: user?.name,
            }),
          });
          const alimData = await res.json();
          if (alimData.success) {
            alimtalkNotice = '\n📲 학부모님께 카카오 알림톡이 성공적으로 발송되었습니다!';
          } else if (alimData.skipped || alimData.disabled) {
            alimtalkNotice = `\n⚠️ (${alimData.message || '알림톡 발송 건너뜀'})`;
          } else {
            alimtalkNotice = `\n❌ 알림톡 발송 실패: ${alimData.error || alimData.message}`;
          }
        } catch (alimErr) {
          console.error('Alimtalk send error:', alimErr);
          alimtalkNotice = `\n❌ 알림톡 통신 오류: ${alimErr.message}`;
        }
      }

      saveRecentBooksToCache(todayHomeworkBooks);
      fetchStudentEvaluationHistory(selectedStudentId, evalDate);
      alert(`🎉 [${studentName}] 학생의 ${evalDate} 일일 피드백 및 과제표 저장이 완료되었습니다!${alimtalkNotice}`);
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
      let alimtalkSentCount = 0;

      setBatchProgressText(`${targets.length}명의 피드백을 저장하는 중...`);

      const batchTargets = targets.map((st) => {
        const effectiveTestType = st.testType === '기타' ? (st.customTestType.trim() || '기타평가') : st.testType;
        const studentActiveKeys = st.activeKeys || ['concept', 'calc', 'app', 'attitude', 'homework', 'perseverance'];

        const combinedComment = formatTeacherCommentWithTestScoreAndItems({
          comment: st.comment,
          testScore: st.testScore,
          testType: effectiveTestType,
          customItems: st.customItems || [],
          lessonProgress: commonLessonProgress,
          homeworkBooks: validBooks,
        });

        return {
          studentId: st.student_id,
          payload: {
            attendance_status: st.attendanceStatus,
            lateness_minutes: st.attendanceStatus === 'LATE' ? parseInt(st.latenessMinutes || 5) : 0,
            concept_score: studentActiveKeys.includes('concept') ? parseInt(st.scores.concept) : null,
            calc_score: studentActiveKeys.includes('calc') ? parseInt(st.scores.calc) : null,
            app_score: studentActiveKeys.includes('app') ? parseInt(st.scores.app) : null,
            attitude_score: studentActiveKeys.includes('attitude') ? parseInt(st.scores.attitude) : null,
            homework_score: studentActiveKeys.includes('homework') ? parseInt(st.scores.homework) : null,
            perseverance_score: studentActiveKeys.includes('perseverance') ? parseInt(st.scores.perseverance) : null,
            teacher_comment: combinedComment,
          },
        };
      });

      const batchRes = await fetch('/api/eval/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalDate, targets: batchTargets }),
      });
      const batchData = await batchRes.json();
      if (!batchRes.ok) throw new Error(batchData.error || '일괄 저장 실패');

      const resultByStudentId = new Map((batchData.results || []).map((r) => [r.studentId, r]));

      for (let i = 0; i < targets.length; i++) {
        const st = targets[i];
        const result = resultByStudentId.get(st.student_id);

        if (!result || !result.ok) {
          errorCount++;
          continue;
        }
        successCount++;
        const savedEvalId = result.id;

        // 📲 알림톡 발송 체크 시 전송
        if (sendAlimtalk && savedEvalId && st.parent_phone) {
          setBatchProgressText(`(${i + 1}/${targets.length}) [${st.name}] 학부모님께 알림톡 발송 중...`);
          try {
            const res = await fetch('/api/solapi/send-eval', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                evalId: savedEvalId,
                studentId: st.student_id,
                studentName: st.name,
                evalDate,
                parentPhone: st.parent_phone,
                teacherName: user?.name,
              }),
            });
            const alimRes = await res.json();
            if (alimRes.success) alimtalkSentCount++;
          } catch (alimErr) {
            console.error('Alimtalk send error for student:', st.name, alimErr);
          }
        }
      }

      saveRecentBooksToCache(commonHomeworkBooks);
      
      // 일괄 저장 완료 후 상태 업데이트
      const sentTime = new Date().toISOString();
      setBatchStudents((prev) =>
        prev.map((s) => {
          if (!s.included) return s;
          return {
            ...s,
            isSaved: true,
            alimtalkSentAt: sendAlimtalk && s.parent_phone ? sentTime : s.alimtalkSentAt,
          };
        })
      );

      const alimNotice = sendAlimtalk ? `\n📲 학부모 알림톡 발송 완료: ${alimtalkSentCount}명` : '';
      alert(`🎉 [${className}] 총 ${successCount}명의 피드백 및 공통 과제표가 일괄 등록되었습니다!${errorCount > 0 ? ` (실패: ${errorCount}건)` : ''}${alimNotice}`);
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

                {/* ⚡ 시험 종류 전체 일괄 적용 툴바 */}
                {batchStudents.length > 0 && (
                  <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                        <span>📝</span>
                        <span>시험 종류 전체 일괄 적용:</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSetAllStudentsTestType('단원평가')}
                        className="text-xs font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 px-2.5 py-1.5 rounded-xl border border-indigo-200 shadow-2xs transition active:scale-95 flex items-center gap-1"
                      >
                        <span>📘</span>
                        <span>단원평가</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllStudentsTestType('일일테스트')}
                        className="text-xs font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 px-2.5 py-1.5 rounded-xl border border-indigo-200 shadow-2xs transition active:scale-95 flex items-center gap-1"
                      >
                        <span>⚡</span>
                        <span>일일테스트</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllStudentsTestType('주간테스트')}
                        className="text-xs font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 px-2.5 py-1.5 rounded-xl border border-indigo-200 shadow-2xs transition active:scale-95 flex items-center gap-1"
                      >
                        <span>📝</span>
                        <span>주간테스트</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllStudentsTestType('모의고사')}
                        className="text-xs font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 px-2.5 py-1.5 rounded-xl border border-indigo-200 shadow-2xs transition active:scale-95 flex items-center gap-1"
                      >
                        <span>🎯</span>
                        <span>모의고사</span>
                      </button>

                      {/* 기타 직접입력 일괄 적용 */}
                      <div className="flex items-center gap-1 bg-white p-0.5 pl-2 rounded-xl border border-indigo-200 shadow-2xs">
                        <span className="text-xs font-bold text-slate-700">✍️ 기타:</span>
                        <input
                          type="text"
                          value={commonCustomTestType}
                          onChange={(e) => setCommonCustomTestType(e.target.value)}
                          placeholder="시험명 입력"
                          className="w-24 sm:w-28 p-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSetAllStudentsTestType('기타', commonCustomTestType);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSetAllStudentsTestType('기타', commonCustomTestType)}
                          className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition shrink-0 shadow-2xs active:scale-95"
                        >
                          적용
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 학생 카드 리스트 */}
                {batchStudents.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                    이 반에 등록된 학생이 없습니다. 반 관리에서 학생을 배정해 주세요.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {batchStudents.map((st) => {
                      const activeKeys = st.activeKeys || ['concept', 'calc', 'app', 'attitude', 'homework', 'perseverance'];
                      const activeScores = activeKeys.map((k) => Number(st.scores[k] || 0));
                      const totalScore = activeScores.reduce((a, b) => a + b, 0);
                      const avgScore = activeKeys.length > 0 ? (totalScore / activeKeys.length).toFixed(1) : '0.0';

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
                          {/* 1행: 이름 + 작성상태 + 출결 버튼 + 점수 슬라이더 토글 + 과제표 검사 버튼 */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={st.included}
                                onChange={() => handleToggleBatchStudentInclude(st.student_id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <div>
                                  <span className="text-sm font-extrabold text-slate-800">{st.name}</span>
                                  <span className="text-[11px] text-slate-400 font-medium ml-1.5">
                                    ({st.prevEvalSummary})
                                  </span>
                                </div>
                                {st.isSaved && st.alimtalkSentAt && (
                                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>✅</span>
                                    <span>작성 & 발송완료</span>
                                  </span>
                                )}
                                {st.isSaved && !st.alimtalkSentAt && (
                                  <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>📝</span>
                                    <span>작성됨 (알림톡 미발송)</span>
                                  </span>
                                )}
                                {!st.isSaved && (
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    ⚪ 미작성
                                  </span>
                                )}
                              </div>
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
                                  const prevActiveScores = activeKeys.map((k) => Number(st.initialScores?.[k] || 0));
                                  const prevTot = prevActiveScores.reduce((a, b) => a + b, 0);
                                  const prevAvg = activeKeys.length > 0 ? (prevTot / activeKeys.length).toFixed(1) : '0.0';
                                  const diff = Number((avgScore - prevAvg).toFixed(1));
                                  if (diff > 0) return <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">▲+{diff}</span>;
                                  if (diff < 0) return <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1 py-0.2 rounded">▼{diff}</span>;
                                  return null;
                                })()}
                                <span className="text-[10px]">{st.showScoreEditor ? '▲ 접기' : '⚙️ 점수조절'}</span>
                              </button>

                              {/* 📑 지난 숙제 검사 팝업 모달 버튼 */}
                              <button
                                type="button"
                                onClick={() => setHomeworkModalStudent(st)}
                                className="text-xs px-2.5 py-1 rounded-xl font-extrabold bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1 shadow-2xs active:scale-95 shrink-0"
                                title="지난 수업 과제 달성 여부 확인 및 검사"
                              >
                                <span>📑</span>
                                <span>과제표 검사</span>
                              </button>
                            </div>
                          </div>

                          {/* 2행: 시험 성적 및 개별 코멘트 입력칸 (넓고 쾌적한 2분할 레이아웃) */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-slate-100 text-xs">
                            <div className="sm:col-span-5 flex items-center gap-1.5">
                              <select
                                value={st.testType}
                                onChange={(e) => handleBatchTestTypeChange(st.student_id, e.target.value)}
                                className="p-1.5 border rounded-lg text-xs bg-slate-50 font-bold text-slate-800 shrink-0"
                              >
                                <option value="단원평가">📘 단원평가</option>
                                <option value="일일테스트">⚡ 일일테스트</option>
                                <option value="주간테스트">📝 주간테스트</option>
                                <option value="모의고사">🎯 모의고사</option>
                                <option value="기타">✍️ 기타 (직접입력)</option>
                              </select>
                              {st.testType === '기타' && (
                                <input
                                  type="text"
                                  value={st.customTestType || ''}
                                  onChange={(e) => handleBatchCustomTestTypeChange(st.student_id, e.target.value)}
                                  placeholder="시험명 직접입력"
                                  className="w-28 p-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold placeholder:text-slate-400 shrink-0"
                                />
                              )}
                              <input
                                type="text"
                                value={st.testScore}
                                onChange={(e) => handleBatchTestScoreChange(st.student_id, e.target.value)}
                                placeholder="시험점수(선택)"
                                className="w-full p-1.5 bg-white border rounded-lg text-xs font-bold placeholder:text-slate-400"
                              />
                            </div>

                            <div className="sm:col-span-7">
                              <input
                                type="text"
                                value={st.comment}
                                onChange={(e) => handleBatchCommentChange(st.student_id, e.target.value)}
                                placeholder="학생별 특이사항이나 칭찬 메모 (비워두면 학부모 화면에 코멘트 영역이 숨겨집니다)"
                                className="w-full p-1.5 bg-white border rounded-lg text-xs font-medium placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* 펼쳐진 역량 점수 슬라이더 에디터 */}
                          {st.showScoreEditor && (
                            <div className="space-y-2.5 animate-fade-in">
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                                {DEFAULT_EVAL_KEYS.filter((def) => activeKeys.includes(def.key)).map((def) => {
                                  const prevVal = st.initialScores?.[def.key];
                                  return (
                                    <div key={def.key} className="bg-white p-2.5 rounded-xl border border-slate-200/90 space-y-1.5 shadow-2xs">
                                      <div className="flex justify-between items-center text-[11px] font-bold">
                                        <span className="text-slate-700">{def.name}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {renderScoreDiffBadge(st.scores[def.key], prevVal)}
                                          <span className="text-blue-600 font-black text-xs">{st.scores[def.key]}점</span>
                                          <button
                                            type="button"
                                            onClick={() => handleBatchRemoveDefaultKey(st.student_id, def.key)}
                                            className="text-slate-400 hover:text-rose-500 font-bold text-xs ml-0.5 p-0.5"
                                            title={`${def.name} 항목 제외`}
                                          >
                                            ✕
                                          </button>
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

                                {(st.customItems || []).map((c) => (
                                  <div key={c.id} className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-200 space-y-1.5">
                                    <div className="flex justify-between items-center text-[11px] font-bold">
                                      <span className="text-indigo-950 flex items-center gap-1 truncate">
                                        <span>✨</span>
                                        <span className="truncate">{c.name}</span>
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-indigo-600 font-black text-xs">{c.score}점</span>
                                        <button
                                          type="button"
                                          onClick={() => handleBatchRemoveCustomItem(st.student_id, c.id)}
                                          className="text-slate-400 hover:text-rose-500 text-xs font-bold"
                                          title="항목 삭제"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      value={c.score}
                                      onChange={(e) => handleBatchCustomScoreChange(st.student_id, c.id, e.target.value)}
                                      className="w-full accent-indigo-600 h-1.5 cursor-pointer"
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* 제외된 기본 항목 복구 칩 목록 */}
                              {DEFAULT_EVAL_KEYS.some((def) => !activeKeys.includes(def.key)) && (
                                <div className="flex items-center gap-1.5 flex-wrap p-2 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs">
                                  <span className="text-[11px] font-bold text-indigo-900 shrink-0">
                                    ➕ 제외된 기본 항목 복구:
                                  </span>
                                  {DEFAULT_EVAL_KEYS.filter((def) => !activeKeys.includes(def.key)).map((def) => (
                                    <button
                                      key={def.key}
                                      type="button"
                                      onClick={() => handleBatchAddDefaultKey(st.student_id, def.key)}
                                      className="text-[11px] font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 active:scale-95"
                                    >
                                      <span>+</span>
                                      <span>{def.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* 학생별 커스텀 평가 항목 추가 */}
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleBatchToggleAddCustomInput(st.student_id)}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
                                >
                                  <span>+</span>
                                  <span>이 학생만 평가 항목 추가</span>
                                </button>
                              </div>

                              {batchShowAddCustomMap[st.student_id] && (
                                <div className="p-2.5 bg-white rounded-xl border border-indigo-200 flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={batchNewCustomNameMap[st.student_id] || ''}
                                    onChange={(e) => handleBatchCustomNameChange(st.student_id, e.target.value)}
                                    placeholder="새 평가 항목명 입력 (예: 질문 적극성)"
                                    className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleBatchAddCustomItem(st.student_id)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs shrink-0"
                                  >
                                    추가
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. 학부모 알림톡 발송 선택 체크박스 & 일괄 등록 버튼 */}
              <div className="space-y-2.5">
                <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-amber-950 select-none">
                    <input
                      type="checkbox"
                      checked={sendAlimtalk}
                      onChange={(e) => setSendAlimtalk(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>📲 등록 완료 시 학부모님께 카카오 알림톡 자동 발송</span>
                  </label>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
                    sendAlimtalk ? 'bg-amber-200 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {sendAlimtalk ? '알림톡 ON (선택된 학생 전원 발송)' : '알림톡 OFF (과금 없음)'}
                  </span>
                </div>

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
              </div>
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

              {/* 🎯 개별 학생의 당일 피드백 작성 & 발송 현황 안내 바 */}
              {selectedStudentId && (
                <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                  todayEvalRecord
                    ? todayParsedRecord?.alimtalkSentAt
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : 'bg-slate-100/70 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-extrabold">
                      📌 [{currentStudentName}] {evalDate} 상태:
                    </span>
                    {todayEvalRecord ? (
                      todayParsedRecord?.alimtalkSentAt ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span>✅</span>
                          <span>작성 및 알림톡 발송 완료 ({new Date(todayParsedRecord.alimtalkSentAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })})</span>
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span>📝</span>
                          <span>피드백 작성됨 (학부모 알림톡 미발송)</span>
                        </span>
                      )
                    ) : (
                      <span className="bg-white text-slate-500 text-xs font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                        ⚪ 아직 미작성 상태
                      </span>
                    )}
                  </div>

                  {todayEvalRecord && !todayParsedRecord?.alimtalkSentAt && currentStudent?.parent_phone && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/solapi/send-eval', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              evalId: todayEvalRecord.id,
                              studentId: selectedStudentId,
                              studentName: currentStudentName,
                              evalDate,
                              parentPhone: currentStudent.parent_phone,
                              teacherName: user?.name,
                            }),
                          });
                          const alimData = await res.json();
                          if (alimData.success) {
                            alert(`✅ [${currentStudentName}] 학부모님께 카카오 알림톡이 성공적으로 발송되었습니다!`);
                            fetchStudentEvaluationHistory(selectedStudentId, evalDate);
                          } else {
                            alert(`발송 실패: ${alimData.error || alimData.message}`);
                          }
                        } catch (e) {
                          alert(`발송 오류: ${e.message}`);
                        }
                      }}
                      className="text-xs font-black bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1 shrink-0 self-start sm:self-auto active:scale-95"
                    >
                      <span>📲</span>
                      <span>알림톡 즉시 발송하기</span>
                    </button>
                  )}
                </div>
              )}

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

              {/* 학부모 알림톡 발송 선택 체크박스 & 저장 버튼 */}
              <div className="space-y-2.5">
                <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-amber-950 select-none">
                    <input
                      type="checkbox"
                      checked={sendAlimtalk}
                      onChange={(e) => setSendAlimtalk(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>📲 저장 완료 시 학부모님께 카카오 알림톡 자동 발송</span>
                  </label>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
                    sendAlimtalk ? 'bg-amber-200 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {sendAlimtalk ? '알림톡 ON (학부모 발송)' : '알림톡 OFF (과금 없음)'}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition text-sm"
                >
                  일일 피드백 및 과제표 저장하기
                </button>
              </div>
            </form>
          )}

          {/* 📊 1:1 모드일 때 학생 누적 과제표 (실시간 수정 및 삭제 지원) */}
          {evalMode === 'INDIVIDUAL' && selectedStudentId && studentEvals.length > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <StudentHomeworkTable
                studentName={currentStudentName}
                evaluations={studentEvals}
                isEditable={true}
                currentUserId={user?.id}
                userRole={user?.role}
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

          {/* 📑 판서수업(반 일괄 모드)용 학생 누적 과제표 검사 팝업 모달 */}
          {homeworkModalStudent && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
              <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📑</span>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800">
                        [{homeworkModalStudent.name}] 학생 누적 과제표 및 숙제 검사
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold">
                        지난 수업의 과제 달성 상태(완료/미완료)를 클릭하여 즉시 변경할 수 있습니다.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHomeworkModalStudent(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
                  <StudentHomeworkTable
                    studentName={homeworkModalStudent.name}
                    evaluations={classAllEvals.filter((e) => e.student_id === homeworkModalStudent.student_id)}
                    isEditable={true}
                    currentUserId={user?.id}
                    userRole={user?.role}
                    onStatusChange={handleModalHomeworkStatusChange}
                    onUpdateEvaluation={handleModalUpdateEvaluation}
                    onDeleteEvaluation={handleModalDeleteEvaluation}
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setHomeworkModalStudent(null)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-2xl text-xs transition cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
