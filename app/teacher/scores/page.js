'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  EXAM_CATEGORIES,
  INTERNAL_EXAM_PERIODS,
  MOCK_EXAM_PERIODS,
  MATH_SUBJECTS,
  HIGH_SCHOOL_GRADES,
  ERROR_REASON_CATEGORIES,
  calculateZScore,
  zScoreToTopPercent,
  calculateAutoGrade,
  analyzePotentialPerformance,
  analyzeGradePosition,
  compareErrorTrends,
  getExamSortOrder,
  formatExamShortLabel,
  formatExamFullLabel,
} from '@/lib/scoreUtils';
import { getClientCache, setClientCache } from '@/lib/clientCache';

const INITIAL_EXAM_FORM = {
  id: null,
  exam_year: new Date().getFullYear(),
  school_grade: 1,
  exam_category: 'INTERNAL',
  exam_period: '1_MID',
  subject: '공통수학1',
  raw_score: '',
  objective_score: '',
  essay_score: '',
  grade: '',
  rank: '',
  total_students: '',
  school_mean: '',
  school_std_dev: '',
  percentile: '',
  standard_score: '',
  error_breakdown: {
    mistake_calc: '',
    mistake_cond: '',
    mistake_essay: '',
    skill_concept: '',
    skill_approach: '',
    skill_killer: '',
  },
  memo: '',
};

export default function TeacherScoresPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 데이터 상태
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [scores, setScores] = useState([]);
  const [studentProfiles, setStudentProfiles] = useState({});

  // 상단 메인 탭: 'STUDENT_ANALYSIS' (학생별 심층 추이) | 'BATCH_INPUT' (엑셀형 일괄 입력) | 'SCHOOL_STATS' (학교별 난이도 DB)
  const [mainTab, setMainTab] = useState('STUDENT_ANALYSIS');

  // 좌측 학생 필터 및 선택 상태
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // 학생 학교/학년 프로필 편집 상태
  const [profileSchoolName, setProfileSchoolName] = useState('');
  const [profileSchoolGrade, setProfileSchoolGrade] = useState(1);
  const [profileGradeSystem, setProfileGradeSystem] = useState(9);
  const [savingProfile, setSavingProfile] = useState(false);

  // 차트 필터 및 모드 상태
  const [chartCategoryFilter, setChartCategoryFilter] = useState('ALL'); // 'ALL' | 'INTERNAL' | 'MOCK'
  const [chartMetricMode, setChartMetricMode] = useState('SCORE'); // 'SCORE' (원점수+잠재점수) | 'GRADE' (등급 반전축) | 'PERCENT' (상위% 추이)
  const [selectedExamIdForDetail, setSelectedExamIdForDetail] = useState(null);

  // 성적 등록/수정 모달 상태
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [examForm, setExamForm] = useState(INITIAL_EXAM_FORM);

  // 학부모 상담 브리핑 모드 (편집 버튼 숨김 & 깔끔 뷰)
  const [isConsultMode, setIsConsultMode] = useState(false);

  // ⚡ 탭 2: 시험별 엑셀형 일괄 입력 상태
  const [batchMeta, setBatchMeta] = useState({
    exam_year: new Date().getFullYear(),
    school_grade: 1,
    exam_category: 'INTERNAL',
    exam_period: '1_MID',
    subject: '공통수학1',
  });
  const [batchClassFilter, setBatchClassFilter] = useState('ALL');
  const [batchRows, setBatchRows] = useState({});
  const [autoSyncSchoolStatsInBatch, setAutoSyncSchoolStatsInBatch] = useState(true);

  // 초기 세션 및 성적 데이터 로드
  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const meData = await meRes.json();
        if (!meData.user || (meData.user.role !== 'TEACHER' && meData.user.role !== 'HEAD_TEACHER' && meData.user.role !== 'ADMIN')) {
          router.push('/login');
          return;
        }
        setUser(meData.user);

        const cached = getClientCache('high_school_scores_data');
        if (cached) {
          applyLoadedData(cached);
          setLoading(false);
          fetchScoreData(false);
        } else {
          await fetchScoreData(true);
        }
      } catch (err) {
        console.error('init error:', err);
        setLoading(false);
      }
    }
    init();
  }, []);

  const applyLoadedData = (data) => {
    const stList = data.students || [];
    setStudents(stList);
    setClasses(data.classes || []);
    setClassStudents(data.classStudents || []);
    setScores(data.scores || []);
    setStudentProfiles(data.studentProfiles || {});

    if (stList.length > 0 && !selectedStudentId) {
      setSelectedStudentId(stList[0].id);
    }
  };

  const fetchScoreData = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await fetch('/api/scores');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '성적 데이터 로드 실패');
      setClientCache('high_school_scores_data', data);
      applyLoadedData(data);
    } catch (err) {
      console.error('fetchScoreData error:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // 현재 선택된 학생 객체
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  // 선택된 학생이 바뀔 때 학교/학년 프로필 입력창 동기화
  useEffect(() => {
    if (!currentStudent) return;
    const prof = studentProfiles[currentStudent.id] || {};
    setProfileSchoolName(prof.school_name || currentStudent.school_name || '');
    setProfileSchoolGrade(Number(prof.school_grade || currentStudent.school_grade) || 1);
    setProfileGradeSystem(Number(prof.grade_system || currentStudent.grade_system) || 9);
    setSelectedExamIdForDetail(null);
  }, [currentStudent?.id, studentProfiles]);

  // 등록된 학교명 목록 (필터 및 자동완성용)
  const schoolList = useMemo(() => {
    const set = new Set();
    Object.values(studentProfiles).forEach((p) => {
      if (p?.school_name?.trim()) set.add(p.school_name.trim());
    });
    scores.forEach((sc) => {
      if (sc?.school_name?.trim()) set.add(sc.school_name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [studentProfiles, scores]);

  // 학생별 소속 반 이름 맵
  const studentClassNamesMap = useMemo(() => {
    const classMap = {};
    classes.forEach((c) => {
      classMap[c.id] = c.name;
    });
    const map = {};
    classStudents.forEach((cs) => {
      const cName = classMap[cs.class_id];
      if (!cName) return;
      if (!map[cs.student_id]) map[cs.student_id] = [];
      if (!map[cs.student_id].includes(cName)) {
        map[cs.student_id].push(cName);
      }
    });
    return map;
  }, [classes, classStudents]);

  // 좌측 학생 목록 필터링
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (selectedClassId !== 'ALL') {
        const inClass = classStudents.some(
          (cs) => String(cs.class_id) === String(selectedClassId) && cs.student_id === st.id
        );
        if (!inClass) return false;
      }
      const prof = studentProfiles[st.id] || {};
      const stSchool = prof.school_name || st.school_name || '';
      if (selectedSchoolFilter !== 'ALL' && stSchool !== selectedSchoolFilter) {
        return false;
      }
      if (studentSearch.trim()) {
        const kw = studentSearch.trim().toLowerCase();
        const matchName = st.name?.toLowerCase().includes(kw);
        const matchSchool = stSchool.toLowerCase().includes(kw);
        if (!matchName && !matchSchool) return false;
      }
      return true;
    });
  }, [students, classStudents, studentProfiles, selectedClassId, selectedSchoolFilter, studentSearch]);

  // 현재 선택된 학생의 전체 시험 성적 (시간순 정렬)
  const studentExams = useMemo(() => {
    if (!currentStudent) return [];
    const list = scores.filter((sc) => sc.student_id === currentStudent.id);
    return [...list].sort((a, b) => getExamSortOrder(a) - getExamSortOrder(b));
  }, [scores, currentStudent]);

  // 차트 필터가 적용된 시험 목록
  const filteredStudentExams = useMemo(() => {
    if (chartCategoryFilter === 'ALL') return studentExams;
    return studentExams.filter((sc) => sc.exam_category === chartCategoryFilter);
  }, [studentExams, chartCategoryFilter]);

  // 현재 상세 분석에 표시할 대상 시험 (선택된 시험이 없으면 가장 최근 시험)
  const activeDetailExam = useMemo(() => {
    if (filteredStudentExams.length === 0) return null;
    if (selectedExamIdForDetail) {
      const found = filteredStudentExams.find((e) => e.id === selectedExamIdForDetail);
      if (found) return found;
    }
    return filteredStudentExams[filteredStudentExams.length - 1];
  }, [filteredStudentExams, selectedExamIdForDetail]);

  // activeDetailExam 바로 이전 시험 (전회차 비교용)
  const previousDetailExam = useMemo(() => {
    if (!activeDetailExam || filteredStudentExams.length < 2) return null;
    const idx = filteredStudentExams.findIndex((e) => e.id === activeDetailExam.id);
    if (idx > 0) return filteredStudentExams[idx - 1];
    return null;
  }, [filteredStudentExams, activeDetailExam]);

  // 현재 선택 시험의 정밀 분석 데이터
  const activeGradeAnalysis = useMemo(() => {
    if (!activeDetailExam) return null;
    return analyzeGradePosition(activeDetailExam, profileGradeSystem);
  }, [activeDetailExam, profileGradeSystem]);

  const activePotentialAnalysis = useMemo(() => {
    if (!activeDetailExam) return null;
    return analyzePotentialPerformance(activeDetailExam, profileGradeSystem);
  }, [activeDetailExam, profileGradeSystem]);

  const activeErrorTrendComparison = useMemo(() => {
    if (!activeDetailExam) return null;
    return compareErrorTrends(previousDetailExam, activeDetailExam);
  }, [previousDetailExam, activeDetailExam]);

  // 학생 프로필(학교/학년/등급제) 저장 핸들러
  const handleSaveProfile = async () => {
    if (!currentStudent) return;
    try {
      setSavingProfile(true);
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_PROFILE',
          student_id: currentStudent.id,
          school_name: profileSchoolName,
          school_grade: Number(profileSchoolGrade),
          grade_system: Number(profileGradeSystem),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로필 저장 실패');

      setStudentProfiles((prev) => ({
        ...prev,
        [currentStudent.id]: data.profile,
      }));
      alert(`✅ ${currentStudent.name} 학생의 학교/학년 설정이 저장되었습니다.`);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // 새 성적 입력 모달 열기
  const handleOpenNewScoreModal = () => {
    if (!currentStudent) return;
    const prof = studentProfiles[currentStudent.id] || {};
    const schoolGrade = Number(prof.school_grade || profileSchoolGrade) || 1;
    const defaultSubj =
      schoolGrade === 1 ? '공통수학1' : schoolGrade === 2 ? '대수 (수학Ⅰ)' : '미적분 (미적분Ⅱ)';

    setExamForm({
      ...INITIAL_EXAM_FORM,
      exam_year: new Date().getFullYear(),
      school_grade: schoolGrade,
      exam_category: 'INTERNAL',
      exam_period: '1_MID',
      subject: defaultSubj,
    });
    setShowScoreModal(true);
  };

  // 기존 성적 수정 모달 열기
  const handleOpenEditScoreModal = (exam) => {
    const eb = exam.error_breakdown || {};
    setExamForm({
      id: exam.id,
      exam_year: exam.exam_year || new Date().getFullYear(),
      school_grade: exam.school_grade || 1,
      exam_category: exam.exam_category || 'INTERNAL',
      exam_period: exam.exam_period || '1_MID',
      subject: exam.subject || '공통수학1',
      raw_score: exam.raw_score ?? '',
      objective_score: exam.objective_score ?? '',
      essay_score: exam.essay_score ?? '',
      grade: exam.grade ?? '',
      rank: exam.rank ?? '',
      total_students: exam.total_students ?? '',
      school_mean: exam.school_mean ?? '',
      school_std_dev: exam.school_std_dev ?? '',
      percentile: exam.percentile ?? '',
      standard_score: exam.standard_score ?? '',
      error_breakdown: {
        mistake_calc: eb.mistake_calc || '',
        mistake_cond: eb.mistake_cond || '',
        mistake_essay: eb.mistake_essay || '',
        skill_concept: eb.skill_concept || '',
        skill_approach: eb.skill_approach || '',
        skill_killer: eb.skill_killer || '',
      },
      memo: exam.memo || '',
    });
    setShowScoreModal(true);
  };

  // 모달에서 같은 학교·같은 시험의 기존 평균/표준편차/전교생 자동 매칭 검색
  const matchedSchoolStatsForModal = useMemo(() => {
    if (examForm.exam_category !== 'INTERNAL') return null;
    const schoolName = (profileSchoolName || '').trim();
    if (!schoolName) return null;

    const match = scores.find(
      (sc) =>
        sc.exam_category === 'INTERNAL' &&
        sc.school_name === schoolName &&
        Number(sc.exam_year) === Number(examForm.exam_year) &&
        Number(sc.school_grade) === Number(examForm.school_grade) &&
        sc.exam_period === examForm.exam_period &&
        sc.subject === examForm.subject &&
        (sc.school_mean !== null || sc.school_std_dev !== null || sc.total_students !== null)
    );
    return match || null;
  }, [scores, profileSchoolName, examForm.exam_category, examForm.exam_year, examForm.school_grade, examForm.exam_period, examForm.subject]);

  // 단건 성적 저장 핸들러
  const handleSaveSingleScore = async (e) => {
    e.preventDefault();
    if (!currentStudent) return;
    const autoGradeResult = calculateAutoGrade(
      examForm,
      examForm.exam_category === 'INTERNAL' ? profileGradeSystem : 9
    );
    const resolvedGrade = autoGradeResult.grade ?? examForm.grade;

    if (examForm.raw_score === '' && examForm.rank === '' && !resolvedGrade) {
      return alert('원점수 또는 석차(등수) 중 최소 한 가지는 입력해 주세요.');
    }

    try {
      setSaving(true);
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_SCORE',
          syncSchoolStats: true,
          score: {
            ...examForm,
            grade: resolvedGrade ?? '',
            student_id: currentStudent.id,
            school_name: profileSchoolName,
            grade_system: profileGradeSystem,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '성적 저장 실패');

      setScores(data.scores || []);
      if (data.studentProfiles) setStudentProfiles(data.studentProfiles);
      if (data.score?.id) setSelectedExamIdForDetail(data.score.id);
      setShowScoreModal(false);
    } catch (err) {
      alert(`성적 저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 성적 삭제 핸들러
  const handleDeleteScore = async (examId, label) => {
    if (!confirm(`정말 [${label}] 성적 기록을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/scores?id=${encodeURIComponent(examId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');
      setScores(data.scores || []);
      if (selectedExamIdForDetail === examId) {
        setSelectedExamIdForDetail(null);
      }
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 👨‍👩‍👧 학부모 상담용 분석 리포트 텍스트 복사
  const handleCopyConsultSummary = async () => {
    if (!currentStudent || !activeDetailExam) return;

    const examTitle = formatExamFullLabel(activeDetailExam);
    const pot = activePotentialAnalysis;
    const pos = activeGradeAnalysis;
    const trend = activeErrorTrendComparison;

    const lines = [];
    lines.push(`📊 [품수학 학원] ${currentStudent.name} 학생 고교 수학 성적 심층 분석 리포트`);
    if (profileSchoolName) {
      lines.push(`🏫 소속: ${profileSchoolName} ${profileSchoolGrade}학년`);
    }
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📌 기준 시험: ${examTitle}`);
    lines.push(
      `• 원점수: ${activeDetailExam.raw_score ?? '-'}점 ${
        activeDetailExam.grade ? `(${activeDetailExam.grade}등급)` : ''
      }`
    );

    if (activeDetailExam.exam_category === 'INTERNAL') {
      if (activeDetailExam.rank && activeDetailExam.total_students) {
        lines.push(
          `• 전교 석차: ${activeDetailExam.rank}등 / ${activeDetailExam.total_students}명 (상위 ${pos?.topPct}%)`
        );
      }
      if (activeDetailExam.school_mean !== null) {
        lines.push(
          `• 학교 평균 / 표준편차: 평균 ${activeDetailExam.school_mean}점 ${
            activeDetailExam.school_std_dev ? `(표준편차 ${activeDetailExam.school_std_dev})` : ''
          }`
        );
      }
      if (pos?.zScore !== null && pos?.zScore !== undefined) {
        lines.push(
          `• 난이도 보정 학업성취도(Z점수): ${pos.zScore > 0 ? `+${pos.zScore}` : pos.zScore} (정규분포 상위 ${zScoreToTopPercent(pos.zScore)}% 수준)`
        );
      }
    } else {
      if (activeDetailExam.percentile !== null) {
        lines.push(`• 전국 백분위: ${activeDetailExam.percentile}%`);
      }
    }

    if (pos?.statusBadge) {
      lines.push(`\n🎯 [등급 내 정밀 위치 진단]`);
      lines.push(`• 판정: ${pos.statusBadge}`);
      if (pos.message) lines.push(`• 상세: ${pos.message}`);
    }

    if (pot && pot.recoverableLost > 0) {
      lines.push(`\n🌟 [실수 보정 잠재 실력 분석]`);
      lines.push(
        `• 현재 점수 ${pot.rawScore}점 ➔ 아까운 실수(${pot.recoverableLost}점) 보정 시 잠재 실력 【${pot.potentialScore}점${
          pot.potentialGrade ? ` (${pot.potentialGrade}등급권)` : ''
        }】`
      );
    }

    if (trend?.insights?.length > 0) {
      lines.push(`\n🔍 [전회차 대비 오답 체질 변화]`);
      trend.insights.forEach((ins) => {
        lines.push(`• ${ins.text}`);
      });
    }

    if (activeDetailExam.memo) {
      lines.push(`\n👨‍🏫 [담당 선생님 분석 코멘트]`);
      lines.push(`${activeDetailExam.memo}`);
    }

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('📋 학부모 상담용 성적 분석 브리핑 문구가 복사되었습니다!\n카카오톡이나 문자 상담창에 바로 붙여넣기(Ctrl+V) 하실 수 있습니다.');
    } catch {
      prompt('아래 내용을 복사해 사용하세요:', text);
    }
  };

  // ⚡ 탭 2 (일괄 입력) 초기화 및 시험 변경 시 기존 데이터 매핑
  useEffect(() => {
    if (mainTab !== 'BATCH_INPUT') return;
    const nextRows = {};

    students.forEach((st) => {
      const prof = studentProfiles[st.id] || {};
      const existing = scores.find(
        (sc) =>
          sc.student_id === st.id &&
          Number(sc.exam_year) === Number(batchMeta.exam_year) &&
          Number(sc.school_grade) === Number(batchMeta.school_grade) &&
          sc.exam_category === batchMeta.exam_category &&
          sc.exam_period === batchMeta.exam_period &&
          sc.subject === batchMeta.subject
      );

      const eb = existing?.error_breakdown || {};
      nextRows[st.id] = {
        id: existing?.id || null,
        student_id: st.id,
        school_name: existing?.school_name || prof.school_name || '',
        grade_system: prof.grade_system || 9,
        raw_score: existing?.raw_score ?? '',
        grade: existing?.grade ?? '',
        rank: existing?.rank ?? '',
        total_students: existing?.total_students ?? '',
        school_mean: existing?.school_mean ?? '',
        school_std_dev: existing?.school_std_dev ?? '',
        percentile: existing?.percentile ?? '',
        standard_score: existing?.standard_score ?? '',
        error_breakdown: {
          mistake_calc: eb.mistake_calc || '',
          mistake_cond: eb.mistake_cond || '',
          mistake_essay: eb.mistake_essay || '',
          skill_concept: eb.skill_concept || '',
          skill_approach: eb.skill_approach || '',
          skill_killer: eb.skill_killer || '',
        },
        memo: existing?.memo || '',
      };
    });

    setBatchRows(nextRows);
  }, [
    mainTab,
    students,
    scores,
    studentProfiles,
    batchMeta.exam_year,
    batchMeta.school_grade,
    batchMeta.exam_category,
    batchMeta.exam_period,
    batchMeta.subject,
  ]);

  // 일괄 입력 행 변경 핸들러 (동일 학교 평균·표준편차·전교생 자동 동기화 지원)
  const handleBatchRowChange = (studentId, field, value, isBreakdownField = false) => {
    setBatchRows((prev) => {
      const targetRow = prev[studentId] || { student_id: studentId, error_breakdown: {} };
      let updatedRow;

      if (isBreakdownField) {
        updatedRow = {
          ...targetRow,
          error_breakdown: {
            ...(targetRow.error_breakdown || {}),
            [field]: value,
          },
        };
      } else {
        updatedRow = {
          ...targetRow,
          [field]: value,
        };
      }

      const next = {
        ...prev,
        [studentId]: updatedRow,
      };

      // 🌟 내신 시험이고 같은 학교 평균/표준편차/전교생 자동 동기화가 켜져 있는 경우
      const schoolName = (updatedRow.school_name || '').trim();
      if (
        autoSyncSchoolStatsInBatch &&
        batchMeta.exam_category === 'INTERNAL' &&
        schoolName &&
        (field === 'school_mean' || field === 'school_std_dev' || field === 'total_students')
      ) {
        Object.keys(next).forEach((sid) => {
          if (sid !== studentId && (next[sid]?.school_name || '').trim() === schoolName) {
            next[sid] = {
              ...next[sid],
              [field]: value,
            };
          }
        });
      }

      // 학교명을 새로 입력했을 때 이미 같은 학교의 평균/표준편차가 다른 행에 있으면 자동 채움
      if (
        autoSyncSchoolStatsInBatch &&
        batchMeta.exam_category === 'INTERNAL' &&
        field === 'school_name' &&
        value.trim()
      ) {
        const cleanSchool = value.trim();
        const donor = Object.values(next).find(
          (r) =>
            r.student_id !== studentId &&
            (r.school_name || '').trim() === cleanSchool &&
            (r.school_mean !== '' || r.school_std_dev !== '' || r.total_students !== '')
        );
        if (donor) {
          next[studentId] = {
            ...next[studentId],
            school_mean: next[studentId].school_mean !== '' ? next[studentId].school_mean : donor.school_mean,
            school_std_dev: next[studentId].school_std_dev !== '' ? next[studentId].school_std_dev : donor.school_std_dev,
            total_students: next[studentId].total_students !== '' ? next[studentId].total_students : donor.total_students,
          };
        }
      }

      return next;
    });
  };

  // 일괄 입력 대상 학생 리스트
  const batchTargetStudents = useMemo(() => {
    return students.filter((st) => {
      if (batchClassFilter !== 'ALL') {
        return classStudents.some(
          (cs) => String(cs.class_id) === String(batchClassFilter) && cs.student_id === st.id
        );
      }
      return true;
    });
  }, [students, classStudents, batchClassFilter]);

  // 일괄 저장 실행
  const handleSaveBatch = async () => {
    try {
      setSaving(true);
      const rowsPayload = batchTargetStudents.map((st) => batchRows[st.id]).filter(Boolean);
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BATCH_SAVE',
          examMeta: batchMeta,
          rows: rowsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일괄 저장 실패');

      setScores(data.scores || []);
      if (data.studentProfiles) setStudentProfiles(data.studentProfiles);
      alert(`🎉 총 ${data.savedCount}명의 시험 성적 및 학교 프로필이 일괄 저장되었습니다!`);
    } catch (err) {
      alert(`일괄 저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 🏫 탭 3: 학교별 내신 난이도 및 학원생 성과 집계
  const schoolExamStatsList = useMemo(() => {
    const groups = {};
    scores
      .filter((sc) => sc.exam_category === 'INTERNAL' && sc.school_name)
      .forEach((sc) => {
        const key = `${sc.exam_year}_${sc.school_name}_${sc.school_grade}_${sc.exam_period}_${sc.subject}`;
        if (!groups[key]) {
          groups[key] = {
            key,
            exam_year: sc.exam_year,
            school_name: sc.school_name,
            school_grade: sc.school_grade,
            exam_period: sc.exam_period,
            subject: sc.subject,
            school_mean: sc.school_mean,
            school_std_dev: sc.school_std_dev,
            total_students: sc.total_students,
            studentScores: [],
          };
        }
        if (sc.school_mean !== null && groups[key].school_mean === null) {
          groups[key].school_mean = sc.school_mean;
        }
        if (sc.school_std_dev !== null && groups[key].school_std_dev === null) {
          groups[key].school_std_dev = sc.school_std_dev;
        }
        if (sc.raw_score !== null && !isNaN(Number(sc.raw_score))) {
          groups[key].studentScores.push(Number(sc.raw_score));
        }
      });

    return Object.values(groups)
      .map((g) => {
        const count = g.studentScores.length;
        const academyAvg =
          count > 0
            ? Number((g.studentScores.reduce((a, b) => a + b, 0) / count).toFixed(1))
            : null;
        const academyMax = count > 0 ? Math.max(...g.studentScores) : null;

        let difficultyLabel = '정보 부족';
        let difficultyColor = 'slate';
        if (g.school_mean !== null) {
          const m = Number(g.school_mean);
          if (m < 52) {
            difficultyLabel = '🔥 고난도 (불시험)';
            difficultyColor = 'rose';
          } else if (m < 65) {
            difficultyLabel = '⚖️ 표준 변별력';
            difficultyColor = 'indigo';
          } else {
            difficultyLabel = '💧 평이 (실수 주의)';
            difficultyColor = 'emerald';
          }
        }

        return {
          ...g,
          count,
          academyAvg,
          academyMax,
          difficultyLabel,
          difficultyColor,
        };
      })
      .sort((a, b) => b.exam_year - a.exam_year || a.school_name.localeCompare(b.school_name, 'ko'));
  }, [scores]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
        고교 성적 추이 분석 시스템 로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/80 pb-28 font-sans text-slate-800">
      {/* 상단 고정 헤더 */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/teacher/dashboard')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-3 py-2 rounded-xl transition shrink-0"
            >
              ← 교무실로
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900">
                  📈 고교 수학 성적 추이 & 패인 분석 센터
                </h1>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full">
                  내신 + 모의고사 통합
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">
                원점수 · 등급 · 석차 · 표준편차(Z점수) 및 오답 패인 기반 잠재 실력 정밀 진단
              </p>
            </div>
          </div>

          {/* 상단 모드 전환 탭 */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setMainTab('STUDENT_ANALYSIS')}
              className={`text-xs font-extrabold px-3.5 py-2 rounded-xl transition whitespace-nowrap flex-1 sm:flex-initial ${
                mainTab === 'STUDENT_ANALYSIS'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 학생별 성적 추이 & 분석
            </button>
            <button
              onClick={() => setMainTab('BATCH_INPUT')}
              className={`text-xs font-extrabold px-3.5 py-2 rounded-xl transition whitespace-nowrap flex-1 sm:flex-initial ${
                mainTab === 'BATCH_INPUT'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ 시험별 엑셀 일괄 입력
            </button>
            <button
              onClick={() => setMainTab('SCHOOL_STATS')}
              className={`text-xs font-extrabold px-3.5 py-2 rounded-xl transition whitespace-nowrap flex-1 sm:flex-initial ${
                mainTab === 'SCHOOL_STATS'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏫 학교별 내신 난이도 DB
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 mt-5">
        {/* =====================================================================
            탭 1: 📊 학생별 심층 성적 추이 & 패인 분석
           ===================================================================== */}
        {mainTab === 'STUDENT_ANALYSIS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* 좌측 사이드바: 학생 필터 및 선택 리스트 (상담 모드일 때는 축소/숨김 가능) */}
            {!isConsultMode && (
              <aside className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs lg:sticky lg:top-20 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">
                    🎯 분석 대상 학생 ({filteredStudents.length}명)
                  </h2>
                </div>

                {/* 반 필터 & 학교 필터 */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-700 focus:outline-indigo-500"
                  >
                    <option value="ALL">전체 반</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedSchoolFilter}
                    onChange={(e) => setSelectedSchoolFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-700 focus:outline-indigo-500"
                  >
                    <option value="ALL">전체 고등학교</option>
                    {schoolList.map((sch) => (
                      <option key={sch} value={sch}>
                        {sch}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 학생 이름/학교 검색 */}
                <input
                  type="text"
                  placeholder="학생 이름 또는 학교 검색..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-indigo-500"
                />

                {/* 학생 목록 (모바일에서는 가로 스크롤 칩, 데스크탑에서는 세로 리스트) */}
                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[62vh] pb-1 lg:pb-0">
                  {filteredStudents.map((st) => {
                    const isSelected = currentStudent?.id === st.id;
                    const prof = studentProfiles[st.id] || {};
                    const stSchool = prof.school_name || st.school_name || '';
                    const stGrade = prof.school_grade || st.school_grade || 1;
                    const stScores = scores
                      .filter((sc) => sc.student_id === st.id)
                      .sort((a, b) => getExamSortOrder(a) - getExamSortOrder(b));
                    const latest = stScores[stScores.length - 1] || null;

                    return (
                      <button
                        key={st.id}
                        onClick={() => setSelectedStudentId(st.id)}
                        className={`text-left px-3.5 py-2.5 rounded-2xl border transition shrink-0 lg:shrink flex flex-col justify-between min-w-[150px] lg:min-w-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/15'
                            : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-sm truncate">{st.name}</span>
                          {latest ? (
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {latest.raw_score !== null ? `${latest.raw_score}점` : ''}
                              {latest.grade ? ` · ${latest.grade}등급` : ''}
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                isSelected ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              미입력
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1 opacity-85">
                          <span className="truncate">
                            {stSchool ? `${stSchool} 고${stGrade}` : '학교 미지정'}
                          </span>
                          <span className="text-[10px] font-bold">
                            기록 {stScores.length}건
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* 우측 메인 분석 대시보드 */}
            <section className={`${isConsultMode ? 'lg:col-span-12' : 'lg:col-span-9'} space-y-5`}>
              {!currentStudent ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 font-bold text-slate-400">
                  좌측 목록에서 학생을 선택해 주세요.
                </div>
              ) : (
                <>
                  {/* 1. 학생 헤더 & 학교/학년 빠른 설정 바 */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                            {currentStudent.name} 학생
                          </h2>
                          {profileSchoolName && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold px-3 py-1 rounded-full">
                              🏫 {profileSchoolName} · 고{profileSchoolGrade} ({profileGradeSystem}등급제)
                            </span>
                          )}
                          {(studentClassNamesMap[currentStudent.id] || []).map((cName) => (
                            <span
                              key={cName}
                              className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-lg"
                            >
                              {cName}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          총 {studentExams.length}회의 고교 시험 기록 (내신{' '}
                          {studentExams.filter((e) => e.exam_category === 'INTERNAL').length}회 · 모의고사{' '}
                          {studentExams.filter((e) => e.exam_category === 'MOCK').length}회)
                        </p>
                      </div>

                      {/* 우측 액션 버튼들 */}
                      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                        <button
                          onClick={() => setIsConsultMode(!isConsultMode)}
                          className={`text-xs font-extrabold px-3.5 py-2 rounded-xl border transition ${
                            isConsultMode
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isConsultMode ? '🔓 일반 관리 모드로 복귀' : '👨‍👩‍👧 학부모 상담 화면 모드'}
                        </button>

                        {activeDetailExam && (
                          <button
                            onClick={handleCopyConsultSummary}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl shadow-xs transition"
                          >
                            📋 카톡 상담용 분석 요약 복사
                          </button>
                        )}

                        {!isConsultMode && (
                          <button
                            onClick={handleOpenNewScoreModal}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl shadow-sm transition"
                          >
                            + 새 시험 성적 입력
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 학교 · 학년 · 등급제 설정 바 (일반 관리 모드에서만 표시) */}
                    {!isConsultMode && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-600 mr-1">
                          🏫 소속 고등학교 설정:
                        </span>
                        <input
                          type="text"
                          list="known-schools-datalist"
                          placeholder="예: 숙명여고, 단대부고..."
                          value={profileSchoolName}
                          onChange={(e) => setProfileSchoolName(e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 w-40 focus:outline-indigo-500"
                        />
                        <datalist id="known-schools-datalist">
                          {schoolList.map((sch) => (
                            <option key={sch} value={sch} />
                          ))}
                        </datalist>

                        <select
                          value={profileSchoolGrade}
                          onChange={(e) => setProfileSchoolGrade(Number(e.target.value))}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                        >
                          {HIGH_SCHOOL_GRADES.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={profileGradeSystem}
                          onChange={(e) => setProfileGradeSystem(Number(e.target.value))}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                          title="고교 내신 등급 산출 체계 선택 (5등급제 또는 9등급제)"
                        >
                          <option value={9}>내신 9등급제 (1등급 4%)</option>
                          <option value={5}>내신 5등급제 (1등급 10%)</option>
                        </select>

                        <button
                          onClick={handleSaveProfile}
                          disabled={savingProfile}
                          className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-xl transition"
                        >
                          {savingProfile ? '저장 중...' : '학교/학년 저장'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 성적이 아직 1건도 없을 때 */}
                  {studentExams.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                      <div className="text-4xl">📝</div>
                      <h3 className="text-base font-black text-slate-800">
                        아직 등록된 고등학교 시험 성적이 없습니다.
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        내신(중간·기말고사) 또는 전국 모의고사 점수를 입력하면 원점수 추이, 등급 컷 정밀 진단, 표준편차 Z점수, 실수 보정 잠재 점수가 자동으로 분석됩니다.
                      </p>
                      <button
                        onClick={handleOpenNewScoreModal}
                        className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-2xl shadow-md transition"
                      >
                        + 첫 시험 성적 등록하기
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 2. 4대 핵심 진단 KPI 카드 (선택된 시험 또는 최근 시험 기준) */}
                      {activeDetailExam && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                          {/* 카드 1: 원점수 & 직전 시험 대비 변화 */}
                          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-400">
                                  📌 선택 시험 성적
                                </span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md">
                                  {formatExamShortLabel(activeDetailExam)}
                                </span>
                              </div>
                              <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                                  {activeDetailExam.raw_score !== null ? `${activeDetailExam.raw_score}점` : '-'}
                                </span>
                                {activeDetailExam.grade && (
                                  <span className="text-base font-black text-indigo-600">
                                    ({activeDetailExam.grade}등급)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs font-bold">
                              {previousDetailExam &&
                              previousDetailExam.raw_score !== null &&
                              activeDetailExam.raw_score !== null ? (
                                (() => {
                                  const diff = Number(
                                    (activeDetailExam.raw_score - previousDetailExam.raw_score).toFixed(1)
                                  );
                                  return (
                                    <span
                                      className={
                                        diff > 0
                                          ? 'text-emerald-600'
                                          : diff < 0
                                          ? 'text-rose-600'
                                          : 'text-slate-500'
                                      }
                                    >
                                      직전({formatExamShortLabel(previousDetailExam)}) 대비{' '}
                                      {diff > 0 ? `+${diff}점 상승 ▲` : diff < 0 ? `${diff}점 하락 ▼` : '동일 -'}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-slate-400">
                                  과목: {activeDetailExam.subject || '수학'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 카드 2: 🌟 잠재 실력 점수 (실수 보정 점수) */}
                          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 rounded-3xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-emerald-800">
                                  🌟 실수 보정 잠재 점수
                                </span>
                                {activePotentialAnalysis?.recoverableLost > 0 && (
                                  <span className="text-[10px] bg-rose-100 text-rose-700 font-black px-2 py-0.5 rounded-full">
                                    아까운 실수 -{activePotentialAnalysis.recoverableLost}점
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                                  {activePotentialAnalysis
                                    ? `${activePotentialAnalysis.potentialScore}점`
                                    : '-'}
                                </span>
                                {activePotentialAnalysis?.potentialGrade && (
                                  <span className="text-sm font-black text-emerald-600">
                                    (잠재 {activePotentialAnalysis.potentialGrade}등급권)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-emerald-100 text-[11px] text-slate-600 font-semibold leading-snug">
                              {activePotentialAnalysis?.recoverableLost > 0
                                ? `계산·조건·서술형 실수(${activePotentialAnalysis.recoverableLost}점)만 잡으면 도달 가능한 실질 개념 실력입니다.`
                                : '기록된 실수 감점이 없거나 실수 없이 실력을 발휘한 시험입니다.'}
                            </div>
                          </div>

                          {/* 카드 3: 🎯 꽉 찬 등급 vs 턱걸이 등급 정밀 위치 */}
                          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-400">
                                  🎯 등급 내 위치 진단
                                </span>
                                {activeGradeAnalysis?.topPct !== null && (
                                  <span className="text-[10px] bg-purple-50 text-purple-700 font-extrabold px-2 py-0.5 rounded-md">
                                    상위 {activeGradeAnalysis.topPct}%
                                  </span>
                                )}
                              </div>

                              <div className="mt-2">
                                <div className="text-sm sm:text-base font-black text-slate-900">
                                  {activeGradeAnalysis?.statusBadge || '석차/편차 미입력'}
                                </div>
                                {/* 등급 구간 내 위치 프로그레스 바 */}
                                {activeGradeAnalysis?.topPct !== null && (
                                  <div className="mt-2">
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          activeGradeAnalysis.statusType === 'FULL'
                                            ? 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                                            : activeGradeAnalysis.statusType === 'EDGE'
                                            ? 'bg-amber-500'
                                            : 'bg-indigo-600'
                                        }`}
                                        style={{ width: `${activeGradeAnalysis.progressInBand}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                                      <span>하위컷({activeGradeAnalysis.bandMaxPct}%)</span>
                                      <span>상위컷({activeGradeAnalysis.bandMinPct}%)</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-semibold leading-snug">
                              {activeGradeAnalysis?.message ||
                                '석차/전교생 또는 평균/표준편차를 입력하면 정밀 진단됩니다.'}
                            </div>
                          </div>

                          {/* 카드 4: 📐 표준편차 기반 Z-점수 & 학교 난이도 보정 */}
                          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-400">
                                  📐 학교 통계 & Z-점수
                                </span>
                                {activeDetailExam.school_mean !== null && (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md">
                                    평균 {activeDetailExam.school_mean}점
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex items-baseline gap-2">
                                {activeGradeAnalysis?.zScore !== null &&
                                activeGradeAnalysis?.zScore !== undefined ? (
                                  <>
                                    <span className="text-2xl sm:text-3xl font-black text-indigo-700">
                                      Z {activeGradeAnalysis.zScore > 0 ? `+${activeGradeAnalysis.zScore}` : activeGradeAnalysis.zScore}
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-500">
                                      (정규분포 상위 {zScoreToTopPercent(activeGradeAnalysis.zScore)}%)
                                    </span>
                                  </>
                                ) : activeDetailExam.exam_category === 'MOCK' &&
                                  activeDetailExam.percentile !== null ? (
                                  <>
                                    <span className="text-2xl sm:text-3xl font-black text-indigo-700">
                                      백분위 {activeDetailExam.percentile}%
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-base font-bold text-slate-400">
                                    평균·표준편차 미입력
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 font-semibold">
                              {activeDetailExam.school_mean !== null &&
                              activeDetailExam.raw_score !== null ? (
                                <span>
                                  학교 평균 대비{' '}
                                  <strong className="text-indigo-700">
                                    {activeDetailExam.raw_score - activeDetailExam.school_mean >= 0
                                      ? `+${(activeDetailExam.raw_score - activeDetailExam.school_mean).toFixed(1)}점`
                                      : `${(activeDetailExam.raw_score - activeDetailExam.school_mean).toFixed(1)}점`}
                                  </strong>{' '}
                                  {activeDetailExam.school_std_dev
                                    ? `· 표준편차 ${activeDetailExam.school_std_dev}`
                                    : ''}
                                </span>
                              ) : (
                                <span>시험 난이도에 흔들리지 않는 상대적 실력 지표입니다.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. 📈 시간순 성적 변화 추이 인터랙티브 차트 */}
                      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h3 className="text-base font-black text-slate-900">
                              📈 고교 과정 성적 변화 타임라인 그래프
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold">
                              그래프의 각 시험 포인트를 클릭하면 아래의 상세 패인 분석이 해당 시험으로 전환됩니다.
                            </p>
                          </div>

                          {/* 차트 필터 & 지표 전환 버튼 */}
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                              {[
                                { id: 'ALL', label: '전체' },
                                { id: 'INTERNAL', label: '내신만' },
                                { id: 'MOCK', label: '모의고사만' },
                              ].map((tab) => (
                                <button
                                  key={tab.id}
                                  onClick={() => setChartCategoryFilter(tab.id)}
                                  className={`text-xs font-extrabold px-2.5 py-1 rounded-lg transition ${
                                    chartCategoryFilter === tab.id
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex bg-indigo-50 p-1 rounded-xl">
                              {[
                                { id: 'SCORE', label: '원점수 + 잠재점수' },
                                { id: 'GRADE', label: '등급 추이 (1등급 상단)' },
                                { id: 'PERCENT', label: '상위 % (난이도 보정)' },
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setChartMetricMode(m.id)}
                                  className={`text-xs font-extrabold px-2.5 py-1 rounded-lg transition ${
                                    chartMetricMode === m.id
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'text-indigo-700 hover:bg-indigo-100'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 범례 */}
                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 px-1">
                          {chartMetricMode === 'SCORE' && (
                            <>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
                                실제 원점수
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                                실수 보정 잠재점수 (점선)
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
                                학교 평균 (내신)
                              </span>
                            </>
                          )}
                          {chartMetricMode === 'GRADE' && (
                            <>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
                                실제 등급 (위로 갈수록 1등급)
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                                실수 보정 잠재 등급
                              </span>
                            </>
                          )}
                          {chartMetricMode === 'PERCENT' && (
                            <>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span>
                                상위 누적 백분율 (위로 갈수록 상위 1%)
                              </span>
                            </>
                          )}
                        </div>

                        {/* SVG 타임라인 차트 렌더러 */}
                        <ScoreTimelineChart
                          exams={filteredStudentExams}
                          metricMode={chartMetricMode}
                          gradeSystem={profileGradeSystem}
                          selectedExamId={activeDetailExam?.id}
                          onSelectExam={(id) => setSelectedExamIdForDetail(id)}
                        />
                      </div>

                      {/* 4. 🔍 오답 패인(감점 요인) 정밀 진단 & 전회차 체질 비교 */}
                      {activeDetailExam && (
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <h3 className="text-base font-black text-slate-900">
                                🔍 [{formatExamFullLabel(activeDetailExam)}] 패인 분석 & 체질 변화
                              </h3>
                              <p className="text-xs text-slate-500 font-semibold">
                                단순 점수가 아닌 &lsquo;왜 감점되었는가&rsquo;를 지난 시험과 비교하여 다음 시험의 처방을 도출합니다.
                              </p>
                            </div>
                            {!isConsultMode && (
                              <button
                                onClick={() => handleOpenEditScoreModal(activeDetailExam)}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-3 py-1.5 rounded-xl transition"
                              >
                                ✏️ 이 시험 성적/패인 수정
                              </button>
                            )}
                          </div>

                          {/* 전회차 대비 자동 인사이트 배너 */}
                          {activeErrorTrendComparison?.insights?.length > 0 && (
                            <div className="space-y-2">
                              {activeErrorTrendComparison.insights.map((ins, i) => (
                                <div
                                  key={i}
                                  className={`p-3.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2.5 ${
                                    ins.type === 'POSITIVE'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                      : ins.type === 'WARNING' || ins.type === 'NEGATIVE'
                                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                                  }`}
                                >
                                  <span className="text-base">
                                    {ins.type === 'POSITIVE'
                                      ? '🎉'
                                      : ins.type === 'WARNING' || ins.type === 'NEGATIVE'
                                      ? '⚠️'
                                      : '💡'}
                                  </span>
                                  <span>{ins.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 6대 감점 요인 카드 & 직전 시험 비교 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {ERROR_REASON_CATEGORIES.map((cat) => {
                              const currVal =
                                Number(activeDetailExam?.error_breakdown?.[cat.key]) || 0;
                              const prevVal = previousDetailExam
                                ? Number(previousDetailExam?.error_breakdown?.[cat.key]) || 0
                                : null;
                              const diff = prevVal !== null ? Number((currVal - prevVal).toFixed(1)) : null;

                              return (
                                <div
                                  key={cat.key}
                                  className={`p-3.5 rounded-2xl border transition ${
                                    currVal > 0
                                      ? cat.recoverable
                                        ? 'bg-rose-50/40 border-rose-200'
                                        : 'bg-indigo-50/40 border-indigo-200'
                                      : 'bg-slate-50/60 border-slate-200/70'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-800">
                                      {cat.label}
                                    </span>
                                    <span
                                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                        cat.recoverable
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-indigo-100 text-indigo-800'
                                      }`}
                                    >
                                      {cat.recoverable ? '실수 보정 대상' : '실력 보완 영역'}
                                    </span>
                                  </div>

                                  <div className="mt-2 flex items-baseline justify-between">
                                    <span
                                      className={`text-xl font-black ${
                                        currVal > 0 ? 'text-rose-600' : 'text-slate-400'
                                      }`}
                                    >
                                      {currVal > 0 ? `-${currVal}점` : '감점 없음 (0점)'}
                                    </span>

                                    {prevVal !== null && (
                                      <span
                                        className={`text-[11px] font-extrabold ${
                                          diff < 0
                                            ? 'text-emerald-600'
                                            : diff > 0
                                            ? 'text-rose-600'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        직전 -{prevVal}점{' '}
                                        {diff < 0
                                          ? `(${Math.abs(diff)}점 개선 ✨)`
                                          : diff > 0
                                          ? `(+${diff}점 증가)`
                                          : '(동일)'}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                    {cat.description}
                                  </p>
                                </div>
                              );
                            })}
                          </div>

                          {/* 담당 선생님 시험 총평 메모 */}
                          {activeDetailExam.memo && (
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                              <div className="text-xs font-black text-slate-700 mb-1">
                                👨‍🏫 담당 선생님 시험 분석 코멘트
                              </div>
                              <p className="text-xs sm:text-sm text-slate-800 font-semibold whitespace-pre-wrap leading-relaxed">
                                {activeDetailExam.memo}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. 📋 학생 누적 성적 전체 이력 표 */}
                      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-black text-slate-900">
                            📋 {currentStudent.name} 학생 누적 시험 성적표 ({filteredStudentExams.length}건)
                          </h3>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 font-extrabold bg-slate-50/80">
                                <th className="py-2.5 px-3 rounded-tl-xl">시험 구분</th>
                                <th className="py-2.5 px-3">과목</th>
                                <th className="py-2.5 px-3 text-right">원점수</th>
                                <th className="py-2.5 px-3 text-right text-emerald-700">잠재점수</th>
                                <th className="py-2.5 px-3 text-center">등급</th>
                                <th className="py-2.5 px-3 text-right">석차 / 백분위</th>
                                <th className="py-2.5 px-3 text-right">학교평균 (편차)</th>
                                <th className="py-2.5 px-3 text-center">Z점수 (상위%)</th>
                                <th className="py-2.5 px-3">주요 감점 요인 / 메모</th>
                                {!isConsultMode && (
                                  <th className="py-2.5 px-3 text-center rounded-tr-xl">관리</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold">
                              {filteredStudentExams.map((exam) => {
                                const isSelectedRow = activeDetailExam?.id === exam.id;
                                const pot = analyzePotentialPerformance(exam, profileGradeSystem);
                                const pos = analyzeGradePosition(exam, profileGradeSystem);
                                const activeErrors = ERROR_REASON_CATEGORIES.filter(
                                  (c) => Number(exam.error_breakdown?.[c.key]) > 0
                                );

                                return (
                                  <tr
                                    key={exam.id}
                                    onClick={() => setSelectedExamIdForDetail(exam.id)}
                                    className={`cursor-pointer transition ${
                                      isSelectedRow
                                        ? 'bg-indigo-50/70'
                                        : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                            exam.exam_category === 'INTERNAL'
                                              ? 'bg-indigo-100 text-indigo-800'
                                              : 'bg-amber-100 text-amber-900'
                                          }`}
                                        >
                                          {exam.exam_category === 'INTERNAL' ? '내신' : '모의'}
                                        </span>
                                        <span className="font-black text-slate-900">
                                          {exam.exam_year}년 {formatExamShortLabel(exam)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-slate-700">{exam.subject}</td>
                                    <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                                      {exam.raw_score !== null ? `${exam.raw_score}점` : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right font-black text-emerald-700">
                                      {pot && pot.recoverableLost > 0
                                        ? `${pot.potentialScore}점 (+${pot.recoverableLost})`
                                        : exam.raw_score !== null
                                        ? `${exam.raw_score}점`
                                        : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      {exam.grade ? (
                                        <span className="bg-slate-900 text-white font-black px-2 py-0.5 rounded-lg text-xs">
                                          {exam.grade}등급
                                        </span>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-3 px-3 text-right text-slate-700">
                                      {exam.exam_category === 'INTERNAL'
                                        ? exam.rank && exam.total_students
                                          ? `${exam.rank}등 / ${exam.total_students}명`
                                          : exam.rank
                                          ? `${exam.rank}등`
                                          : '-'
                                        : exam.percentile !== null
                                        ? `백분위 ${exam.percentile}%`
                                        : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right text-slate-600">
                                      {exam.school_mean !== null
                                        ? `${exam.school_mean}점${
                                            exam.school_std_dev ? ` (${exam.school_std_dev})` : ''
                                          }`
                                        : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      {pos?.zScore !== null && pos?.zScore !== undefined ? (
                                        <span className="text-indigo-700 font-extrabold">
                                          {pos.zScore > 0 ? `+${pos.zScore}` : pos.zScore} (상위{' '}
                                          {pos.topPct}%)
                                        </span>
                                      ) : pos?.topPct !== null ? (
                                        <span className="text-slate-600 font-bold">
                                          상위 {pos.topPct}%
                                        </span>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-3 px-3 max-w-[220px]">
                                      <div className="flex flex-wrap gap-1">
                                        {activeErrors.map((cat) => (
                                          <span
                                            key={cat.key}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                              cat.recoverable
                                                ? 'bg-rose-100 text-rose-800'
                                                : 'bg-slate-200 text-slate-700'
                                            }`}
                                          >
                                            {cat.shortLabel} -{exam.error_breakdown[cat.key]}
                                          </span>
                                        ))}
                                      </div>
                                      {exam.memo && (
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                          {exam.memo}
                                        </div>
                                      )}
                                    </td>
                                    {!isConsultMode && (
                                      <td
                                        className="py-3 px-3 text-center whitespace-nowrap"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => handleOpenEditScoreModal(exam)}
                                          className="text-indigo-600 hover:underline font-extrabold mr-2"
                                        >
                                          수정
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeleteScore(exam.id, formatExamFullLabel(exam))
                                          }
                                          className="text-rose-500 hover:underline font-bold"
                                        >
                                          삭제
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {/* =====================================================================
            탭 2: ⚡ 시험별 엑셀형 일괄 빠른 입력 (스프레드시트 모드)
           ===================================================================== */}
        {mainTab === 'BATCH_INPUT' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  ⚡ 시험별 엑셀형 일괄 빠른 입력
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  키보드 <kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-black">Tab</kbd> 키로 칸을 이동하며 여러 학생의 성적과 감점 요인을 한 번에 입력할 수 있습니다.
                </p>
              </div>

              <button
                onClick={handleSaveBatch}
                disabled={saving}
                className="text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-2xl shadow-md transition shrink-0"
              >
                {saving ? '일괄 저장 중...' : '💾 입력된 성적 일괄 저장하기'}
              </button>
            </div>

            {/* 일괄 입력 대상 시험 선택 바 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  시행 연도
                </label>
                <input
                  type="number"
                  value={batchMeta.exam_year}
                  onChange={(e) =>
                    setBatchMeta((p) => ({ ...p, exam_year: Number(e.target.value) || 2026 }))
                  }
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  대상 학년
                </label>
                <select
                  value={batchMeta.school_grade}
                  onChange={(e) =>
                    setBatchMeta((p) => ({ ...p, school_grade: Number(e.target.value) }))
                  }
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                >
                  {HIGH_SCHOOL_GRADES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  시험 종류
                </label>
                <select
                  value={batchMeta.exam_category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setBatchMeta((p) => ({
                      ...p,
                      exam_category: cat,
                      exam_period: cat === 'INTERNAL' ? '1_MID' : 'MOCK_03',
                      subject: cat === 'INTERNAL' ? '공통수학1' : '모의고사 (공통)',
                    }));
                  }}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                >
                  {EXAM_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  세부 시험 시기
                </label>
                <select
                  value={batchMeta.exam_period}
                  onChange={(e) =>
                    setBatchMeta((p) => ({ ...p, exam_period: e.target.value }))
                  }
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                >
                  {(batchMeta.exam_category === 'INTERNAL'
                    ? INTERNAL_EXAM_PERIODS
                    : MOCK_EXAM_PERIODS
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  수학 과목명
                </label>
                <input
                  type="text"
                  list="math-subjects-list"
                  value={batchMeta.subject}
                  onChange={(e) => setBatchMeta((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                />
                <datalist id="math-subjects-list">
                  {MATH_SUBJECTS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  반 필터 ({batchTargetStudents.length}명)
                </label>
                <select
                  value={batchClassFilter}
                  onChange={(e) => setBatchClassFilter(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                >
                  <option value="ALL">담당 전체 학생</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {batchMeta.exam_category === 'INTERNAL' && (
              <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200/80 px-4 py-2.5 rounded-2xl text-xs">
                <label className="flex items-center gap-2 font-extrabold text-indigo-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncSchoolStatsInBatch}
                    onChange={(e) => setAutoSyncSchoolStatsInBatch(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    🏫 스마트 자동 연동: 같은 고등학교 학생끼리는 한 명만 [학교 평균 / 표준편차 / 수강자수]를 입력해도 즉시 자동 공유됩니다.
                  </span>
                </label>
              </div>
            )}

            {/* 엑셀형 스프레드시트 테이블 */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-2.5 px-2.5 min-w-[90px]">학생명</th>
                    <th className="py-2.5 px-2 min-w-[115px]">고등학교명</th>
                    <th className="py-2.5 px-2 min-w-[75px] bg-indigo-50/60 text-indigo-900">
                      원점수
                    </th>
                    {batchMeta.exam_category === 'INTERNAL' ? (
                      <>
                        <th className="py-2.5 px-2 min-w-[72px] bg-indigo-50/60 text-indigo-900">
                          전교석차(등수)
                        </th>
                        <th className="py-2.5 px-2 min-w-[78px] bg-indigo-50/60 text-indigo-900">
                          수강자수(전교생)
                        </th>
                        <th className="py-2.5 px-2 min-w-[92px] bg-emerald-50 text-emerald-900 text-center">
                          ⚡ 자동 등급
                        </th>
                        <th className="py-2.5 px-2 min-w-[75px]">학교평균</th>
                        <th className="py-2.5 px-2 min-w-[75px]">표준편차</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-2 min-w-[78px] bg-indigo-50/60 text-indigo-900">
                          백분위(%)
                        </th>
                        <th className="py-2.5 px-2 min-w-[75px]">표준점수</th>
                        <th className="py-2.5 px-2 min-w-[92px] bg-emerald-50 text-emerald-900 text-center">
                          ⚡ 자동 등급
                        </th>
                      </>
                    )}
                    <th
                      className="py-2.5 px-2 min-w-[68px] bg-rose-50 text-rose-900"
                      title="아까운 계산/부호 실수 감점 점수"
                    >
                      계산실수(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] bg-rose-50 text-rose-900"
                      title="문제 조건 누락 감점 점수"
                    >
                      조건누락(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] bg-rose-50 text-rose-900"
                      title="서술형 감점 또는 시간부족 실수 점수"
                    >
                      서술/시간(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] bg-slate-50 text-slate-700"
                      title="개념/공식 미숙 감점 점수"
                    >
                      개념미숙(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] bg-slate-50 text-slate-700"
                      title="유형/접근법 막힘 감점 점수"
                    >
                      유형막힘(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] bg-slate-50 text-slate-700"
                      title="킬러(고난도) 한계 감점 점수"
                    >
                      킬러문항(-)
                    </th>
                    <th className="py-2.5 px-2 min-w-[160px]">시험 한줄 코멘트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {batchTargetStudents.map((st) => {
                    const row = batchRows[st.id] || { error_breakdown: {} };
                    const autoGradeInfo = calculateAutoGrade(
                      { ...row, exam_category: batchMeta.exam_category },
                      batchMeta.exam_category === 'INTERNAL' ? Number(row.grade_system) || 9 : 9
                    );
                    const displayGrade = autoGradeInfo.grade ?? (row.grade ? Number(row.grade) : null);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2.5 font-black text-slate-900 whitespace-nowrap">
                          {st.name}
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="text"
                            list="known-schools-datalist"
                            placeholder="학교명"
                            value={row.school_name ?? ''}
                            onChange={(e) =>
                              handleBatchRowChange(st.id, 'school_name', e.target.value)
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:outline-indigo-500"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 bg-indigo-50/20">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="점수"
                            value={row.raw_score ?? ''}
                            onChange={(e) =>
                              handleBatchRowChange(st.id, 'raw_score', e.target.value)
                            }
                            className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 font-black text-indigo-950 text-right focus:outline-indigo-600"
                          />
                        </td>

                        {batchMeta.exam_category === 'INTERNAL' ? (
                          <>
                            <td className="py-1.5 px-1.5 bg-indigo-50/20">
                              <input
                                type="number"
                                placeholder="등수"
                                value={row.rank ?? ''}
                                onChange={(e) =>
                                  handleBatchRowChange(st.id, 'rank', e.target.value)
                                }
                                className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 font-black text-indigo-950 text-right focus:outline-indigo-600"
                              />
                            </td>
                            <td className="py-1.5 px-1.5 bg-indigo-50/20">
                              <input
                                type="number"
                                placeholder="전교생"
                                value={row.total_students ?? ''}
                                onChange={(e) =>
                                  handleBatchRowChange(st.id, 'total_students', e.target.value)
                                }
                                className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 font-semibold text-right focus:outline-indigo-600"
                              />
                            </td>
                            <td className="py-1.5 px-1.5 bg-emerald-50/40 text-center">
                              {displayGrade ? (
                                <div className="flex flex-col items-center leading-tight">
                                  <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded-md text-xs">
                                    {displayGrade}등급
                                  </span>
                                  {autoGradeInfo.topPct !== null && (
                                    <span className="text-[10px] font-bold text-emerald-800 mt-0.5">
                                      상위 {autoGradeInfo.topPct}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400">
                                  등수 입력 시 자동
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="평균"
                                value={row.school_mean ?? ''}
                                onChange={(e) =>
                                  handleBatchRowChange(st.id, 'school_mean', e.target.value)
                                }
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-right"
                              />
                            </td>
                            <td className="py-1.5 px-1.5">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="편차"
                                value={row.school_std_dev ?? ''}
                                onChange={(e) =>
                                  handleBatchRowChange(st.id, 'school_std_dev', e.target.value)
                                }
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-right"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-1.5 px-1.5 bg-indigo-50/20">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="백분위"
                                value={row.percentile ?? ''}
                                onChange={(e) =>
                                  handleBatchRowChange(st.id, 'percentile', e.target.value)
                                }
                                className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 font-black text-indigo-950 text-right focus:outline-indigo-600"
                              />
                            </td>
                            <td className="py-1.5 px-1.5">
                              <input
                                type="number"
                                placeholder="표준점수"
                                value={row.standard_score ?? ''}
                                onChange={(e) =>
                                  handleBatchRowChange(st.id, 'standard_score', e.target.value)
                                }
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-right"
                              />
                            </td>
                            <td className="py-1.5 px-1.5 bg-emerald-50/40 text-center">
                              {displayGrade ? (
                                <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded-md text-xs">
                                  {displayGrade}등급
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400">
                                  백분위 입력 시 자동
                                </span>
                              )}
                            </td>
                          </>
                        )}

                        {/* 6대 오답 감점 점수 입력 */}
                        {ERROR_REASON_CATEGORIES.map((cat) => (
                          <td
                            key={cat.key}
                            className={`py-1.5 px-1.5 ${
                              cat.recoverable ? 'bg-rose-50/20' : ''
                            }`}
                          >
                            <input
                              type="number"
                              step="0.5"
                              placeholder="0"
                              value={row.error_breakdown?.[cat.key] ?? ''}
                              onChange={(e) =>
                                handleBatchRowChange(st.id, cat.key, e.target.value, true)
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 font-bold text-right text-slate-700"
                            />
                          </td>
                        ))}

                        <td className="py-1.5 px-1.5">
                          <input
                            type="text"
                            placeholder="특이사항 / 패인 메모"
                            value={row.memo ?? ''}
                            onChange={(e) =>
                              handleBatchRowChange(st.id, 'memo', e.target.value)
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            탭 3: 🏫 학교별 내신 난이도 히스토리 DB
           ===================================================================== */}
        {mainTab === 'SCHOOL_STATS' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                🏫 학교별 수학 내신 시험 난이도 & 학원 성과 DB
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                학생들의 성적 입력 시 기록된 학교별 과목 평균과 표준편차를 기반으로 인근 고등학교의 출제 난이도와 본원 재원생 평균을 자동 비교합니다.
              </p>
            </div>

            {schoolExamStatsList.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-bold text-sm border border-dashed border-slate-200 rounded-2xl">
                학교명이 포함된 내신 성적 데이터가 입력되면 자동으로 학교별 난이도 비교표가 생성됩니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold">
                      <th className="py-3 px-3">고등학교</th>
                      <th className="py-3 px-3">연도 · 학년 · 시험</th>
                      <th className="py-3 px-3">과목</th>
                      <th className="py-3 px-3 text-right">학교 전체 평균</th>
                      <th className="py-3 px-3 text-right">표준편차</th>
                      <th className="py-3 px-3 text-center">시험 난이도 판정</th>
                      <th className="py-3 px-3 text-right text-indigo-700">우리 학원생 평균</th>
                      <th className="py-3 px-3 text-right text-emerald-700">학원생 최고점</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {schoolExamStatsList.map((item) => (
                      <tr key={item.key} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-black text-slate-900 text-sm">
                          {item.school_name}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {item.exam_year}년 {formatExamShortLabel(item)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{item.subject}</td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-800">
                          {item.school_mean !== null ? `${item.school_mean}점` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {item.school_std_dev !== null ? item.school_std_dev : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              item.difficultyColor === 'rose'
                                ? 'bg-rose-100 text-rose-800'
                                : item.difficultyColor === 'indigo'
                                ? 'bg-indigo-100 text-indigo-800'
                                : item.difficultyColor === 'emerald'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.difficultyLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-indigo-700">
                          {item.academyAvg !== null
                            ? `${item.academyAvg}점 (${item.count}명)`
                            : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-700">
                          {item.academyMax !== null ? `${item.academyMax}점` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          모달: 개별 학생 시험 성적 & 6대 패인 등록/수정
         ===================================================================== */}
      {showScoreModal && currentStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {examForm.id ? '✏️ 시험 성적 및 오답 패인 수정' : '➕ 새 고교 시험 성적 등록'}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  대상: {currentStudent.name} 학생{' '}
                  {profileSchoolName ? `(${profileSchoolName} 고${profileSchoolGrade})` : ''}
                </p>
              </div>
              <button
                onClick={() => setShowScoreModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-black px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleScore} className="space-y-4 mt-4">
              {/* 1. 시험 기본 분류 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                    시행 연도
                  </label>
                  <input
                    type="number"
                    value={examForm.exam_year}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, exam_year: Number(e.target.value) || 2026 }))
                    }
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                    시험 당시 학년
                  </label>
                  <select
                    value={examForm.school_grade}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, school_grade: Number(e.target.value) }))
                    }
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-black"
                  >
                    {HIGH_SCHOOL_GRADES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                    내신 / 모의고사
                  </label>
                  <select
                    value={examForm.exam_category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setExamForm((p) => ({
                        ...p,
                        exam_category: cat,
                        exam_period: cat === 'INTERNAL' ? '1_MID' : 'MOCK_03',
                        subject: cat === 'INTERNAL' ? '공통수학1' : '모의고사 (공통)',
                      }));
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-black"
                  >
                    {EXAM_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                    세부 시기
                  </label>
                  <select
                    value={examForm.exam_period}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, exam_period: e.target.value }))
                    }
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-black"
                  >
                    {(examForm.exam_category === 'INTERNAL'
                      ? INTERNAL_EXAM_PERIODS
                      : MOCK_EXAM_PERIODS
                    ).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-4">
                  <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                    수학 과목명
                  </label>
                  <input
                    type="text"
                    list="math-subjects-list"
                    value={examForm.subject}
                    onChange={(e) => setExamForm((p) => ({ ...p, subject: e.target.value }))}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black"
                    placeholder="예: 공통수학1, 대수, 미적분..."
                  />
                </div>
              </div>

              {/* 같은 학교 기존 평균/표준편차 자동 불러오기 알림 */}
              {matchedSchoolStatsForModal && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-indigo-900">
                    💡 <strong>{profileSchoolName}</strong>의 동일 시험 통계(평균{' '}
                    {matchedSchoolStatsForModal.school_mean ?? '-'} / 편차{' '}
                    {matchedSchoolStatsForModal.school_std_dev ?? '-'})가 이미 등록되어 있습니다.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExamForm((p) => ({
                        ...p,
                        school_mean:
                          matchedSchoolStatsForModal.school_mean ?? p.school_mean,
                        school_std_dev:
                          matchedSchoolStatsForModal.school_std_dev ?? p.school_std_dev,
                        total_students:
                          matchedSchoolStatsForModal.total_students ?? p.total_students,
                      }))
                    }
                    className="bg-indigo-600 text-white font-extrabold px-3 py-1.5 rounded-xl shrink-0"
                  >
                    자동 채우기
                  </button>
                </div>
              )}

              {/* 2. 점수 · 석차 · 자동 등급 · 표준편차 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800">
                    📊 성적 지표 입력
                  </h4>
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    ⚡ 등수·전교생 수(또는 백분위) 입력 시 등급 자동 산출
                  </span>
                </div>

                {(() => {
                  const modalAutoGrade = calculateAutoGrade(
                    examForm,
                    examForm.exam_category === 'INTERNAL' ? profileGradeSystem : 9
                  );
                  const displayModalGrade =
                    modalAutoGrade.grade ?? (examForm.grade ? Number(examForm.grade) : null);

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          원점수 (100점 만점) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="예: 86.5"
                          value={examForm.raw_score}
                          onChange={(e) =>
                            setExamForm((p) => ({ ...p, raw_score: e.target.value }))
                          }
                          className="w-full text-sm bg-indigo-50/40 border border-indigo-300 rounded-xl px-3 py-2 font-black text-indigo-950"
                        />
                      </div>

                      {examForm.exam_category === 'INTERNAL' ? (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              전교 석차 (등수) *
                            </label>
                            <input
                              type="number"
                              placeholder="예: 14"
                              value={examForm.rank}
                              onChange={(e) =>
                                setExamForm((p) => ({ ...p, rank: e.target.value }))
                              }
                              className="w-full text-sm bg-indigo-50/40 border border-indigo-300 rounded-xl px-3 py-2 font-black text-indigo-950"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              수강자 수 (전교생 수) *
                            </label>
                            <input
                              type="number"
                              placeholder="예: 260"
                              value={examForm.total_students}
                              onChange={(e) =>
                                setExamForm((p) => ({ ...p, total_students: e.target.value }))
                              }
                              className="w-full text-sm bg-indigo-50/40 border border-indigo-300 rounded-xl px-3 py-2 font-black text-indigo-950"
                            />
                          </div>

                          {/* ⚡ 자동 산출 등급 표시 카드 */}
                          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-2 flex flex-col justify-center">
                            <span className="text-[10px] font-extrabold text-emerald-800">
                              ⚡ 자동 산출 등급 ({profileGradeSystem}등급제)
                            </span>
                            {displayModalGrade ? (
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-base font-black text-emerald-950">
                                  {displayModalGrade}등급
                                </span>
                                {modalAutoGrade.topPct !== null && (
                                  <span className="text-[11px] font-extrabold text-emerald-700">
                                    (상위 {modalAutoGrade.topPct}%
                                    {modalAutoGrade.source === 'Z_SCORE' ? ' 추정' : ''})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400 mt-0.5">
                                등수·전교생 입력 시 자동 표시
                              </span>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              학교 과목 평균
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="예: 54.2"
                              value={examForm.school_mean}
                              onChange={(e) =>
                                setExamForm((p) => ({ ...p, school_mean: e.target.value }))
                              }
                              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              학교 표준편차 🌟
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="예: 18.5"
                              value={examForm.school_std_dev}
                              onChange={(e) =>
                                setExamForm((p) => ({ ...p, school_std_dev: e.target.value }))
                              }
                              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              백분위 (%) *
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="예: 94"
                              value={examForm.percentile}
                              onChange={(e) =>
                                setExamForm((p) => ({ ...p, percentile: e.target.value }))
                              }
                              className="w-full text-sm bg-indigo-50/40 border border-indigo-300 rounded-xl px-3 py-2 font-black text-indigo-950"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              표준점수 (선택)
                            </label>
                            <input
                              type="number"
                              placeholder="예: 135"
                              value={examForm.standard_score}
                              onChange={(e) =>
                                setExamForm((p) => ({ ...p, standard_score: e.target.value }))
                              }
                              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold"
                            />
                          </div>

                          {/* ⚡ 모의고사 자동 산출 등급 표시 카드 */}
                          <div className="col-span-2 sm:col-span-3 bg-emerald-50/80 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                            <span className="text-xs font-extrabold text-emerald-900">
                              ⚡ 백분위 기준 자동 산출 등급
                            </span>
                            {displayModalGrade ? (
                              <span className="text-sm font-black text-emerald-950 bg-white px-3 py-1 rounded-lg border border-emerald-300">
                                {displayModalGrade}등급{' '}
                                {modalAutoGrade.topPct !== null
                                  ? `(상위 ${modalAutoGrade.topPct}%)`
                                  : ''}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-slate-400">
                                백분위(%) 입력 시 자동 산출됩니다
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 3. 🔍 6대 오답 패인(감점 요인) 상세 점수 입력 */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800">
                    🔍 오답 패인별 감점 점수 (선택 입력 · 잠재 실력 점수 자동 산출)
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ERROR_REASON_CATEGORIES.map((cat) => (
                    <div
                      key={cat.key}
                      className={`p-2.5 rounded-xl border ${
                        cat.recoverable
                          ? 'bg-rose-50/40 border-rose-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <label className="block text-[11px] font-extrabold text-slate-800 mb-1">
                        {cat.label} {cat.recoverable ? '🌟' : ''}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400">-</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="감점 점수 (예: 4.5)"
                          value={examForm.error_breakdown?.[cat.key] ?? ''}
                          onChange={(e) =>
                            setExamForm((p) => ({
                              ...p,
                              error_breakdown: {
                                ...(p.error_breakdown || {}),
                                [cat.key]: e.target.value,
                              },
                            }))
                          }
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-black text-right"
                        />
                        <span className="text-xs font-bold text-slate-500">점</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. 시험 총평 코멘트 */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  👨‍🏫 시험 총평 및 향후 처방 메모 (선택)
                </label>
                <textarea
                  rows={2}
                  placeholder="예: 개념 이해도는 높으나 서술형 마지막 문항에서 부호 실수로 5점 감점됨. 기말 대비 검산 루틴 훈련 예정."
                  value={examForm.memo}
                  onChange={(e) => setExamForm((p) => ({ ...p, memo: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScoreModal(false)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl shadow-md"
                >
                  {saving ? '저장 중...' : '💾 성적 및 분석 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 📈 시간순 성적 추이 SVG 차트 컴포넌트
 * - 원점수 + 잠재점수(실수보정) + 학교평균
 * - 등급 추이 (1등급이 상단에 오도록 반전 Y축)
 * - 상위 누적 백분율(%) 추이
 */
function ScoreTimelineChart({
  exams = [],
  metricMode = 'SCORE',
  gradeSystem = 9,
  selectedExamId,
  onSelectExam,
}) {
  if (!exams || exams.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200/70 text-xs font-bold text-slate-400">
        선택한 필터에 해당하는 시험 기록이 없습니다.
      </div>
    );
  }

  const width = 820;
  const height = 270;
  const padLeft = 52;
  const padRight = 36;
  const padTop = 32;
  const padBottom = 54;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (idx) => {
    if (exams.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (exams.length - 1)) * plotW;
  };

  // 모드별 Y좌표 계산 함수
  const maxGrade = gradeSystem === 5 ? 5 : 9;

  const getYForScore = (val) => {
    const clamped = Math.max(0, Math.min(100, Number(val) || 0));
    return padTop + plotH - (clamped / 100) * plotH;
  };

  const getYForGrade = (gradeVal) => {
    const g = Math.max(1, Math.min(9, Number(gradeVal) || 5));
    // 1등급이 맨 위(padTop), 9등급이 맨 아래(padTop + plotH)
    return padTop + ((g - 1) / 8) * plotH;
  };

  const getYForTopPercent = (pctVal) => {
    const p = Math.max(0.1, Math.min(100, Number(pctVal) || 50));
    // 상위 0.1%가 맨 위(padTop), 100%가 맨 아래
    return padTop + (p / 100) * plotH;
  };

  // 데이터 포인트 생성
  const points = exams.map((exam, idx) => {
    const x = getX(idx);
    const pot = analyzePotentialPerformance(exam, gradeSystem);
    const pos = analyzeGradePosition(exam, gradeSystem);

    let primaryY = null;
    let primaryLabel = '';
    let secondaryY = null;
    let secondaryLabel = '';
    let meanY = null;

    if (metricMode === 'SCORE') {
      if (exam.raw_score !== null && !isNaN(Number(exam.raw_score))) {
        primaryY = getYForScore(exam.raw_score);
        primaryLabel = `${exam.raw_score}점`;
      }
      if (pot && pot.potentialScore !== null) {
        secondaryY = getYForScore(pot.potentialScore);
        secondaryLabel = `잠재 ${pot.potentialScore}점`;
      }
      if (exam.school_mean !== null && !isNaN(Number(exam.school_mean))) {
        meanY = getYForScore(exam.school_mean);
      }
    } else if (metricMode === 'GRADE') {
      const actualG = exam.grade || pos?.actualGrade;
      if (actualG) {
        primaryY = getYForGrade(actualG);
        primaryLabel = `${actualG}등급`;
      }
      if (pot?.potentialGrade) {
        secondaryY = getYForGrade(pot.potentialGrade);
        secondaryLabel = `잠재 ${pot.potentialGrade}등급`;
      }
    } else if (metricMode === 'PERCENT') {
      if (pos?.topPct !== null && pos?.topPct !== undefined) {
        primaryY = getYForTopPercent(pos.topPct);
        primaryLabel = `상위 ${pos.topPct}%`;
      }
    }

    return {
      exam,
      x,
      primaryY,
      primaryLabel,
      secondaryY,
      secondaryLabel,
      meanY,
    };
  });

  const buildPath = (pts, key) => {
    const valid = pts.filter((p) => p[key] !== null && p[key] !== undefined);
    if (valid.length < 2) return '';
    return valid
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p[key].toFixed(1)}`)
      .join(' ');
  };

  const primaryPath = buildPath(points, 'primaryY');
  const secondaryPath = buildPath(points, 'secondaryY');
  const meanPath = buildPath(points, 'meanY');

  // 배경 가로 가이드라인
  const gridLines =
    metricMode === 'SCORE'
      ? [100, 80, 60, 40, 20].map((v) => ({ y: getYForScore(v), label: `${v}점` }))
      : metricMode === 'GRADE'
      ? [1, 2, 3, 4, 5, 7, 9].map((g) => ({ y: getYForGrade(g), label: `${g}등급` }))
      : [4, 11, 23, 40, 60, 80].map((pct) => ({
          y: getYForTopPercent(pct),
          label: `상위 ${pct}%`,
        }));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[540px] h-auto select-none bg-slate-50/60 rounded-2xl border border-slate-200/70"
      >
        {/* 가로 가이드선 */}
        {gridLines.map((gl, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={gl.y}
              x2={width - padRight}
              y2={gl.y}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={gl.y + 4}
              textAnchor="end"
              className="fill-slate-400 text-[10px] font-bold"
            >
              {gl.label}
            </text>
          </g>
        ))}

        {/* 학교 평균선 (원점수 모드) */}
        {metricMode === 'SCORE' && meanPath && (
          <path
            d={meanPath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
        )}

        {/* 잠재 점수 / 잠재 등급 점선 */}
        {(metricMode === 'SCORE' || metricMode === 'GRADE') && secondaryPath && (
          <path
            d={secondaryPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
        )}

        {/* 메인 실선 (실제 원점수 / 실제 등급 / 상위 %) */}
        {primaryPath && (
          <path
            d={primaryPath}
            fill="none"
            stroke={metricMode === 'PERCENT' ? '#7c3aed' : '#4f46e5'}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* 각 시험 포인트 및 라벨 */}
        {points.map((pt) => {
          const isSelected = pt.exam.id === selectedExamId;
          return (
            <g
              key={pt.exam.id}
              onClick={() => onSelectExam && onSelectExam(pt.exam.id)}
              className="cursor-pointer"
            >
              {/* 선택된 시험 세로 하이라이트 */}
              {isSelected && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={height - padBottom}
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* 학교 평균 점 */}
              {metricMode === 'SCORE' && pt.meanY !== null && (
                <circle cx={pt.x} cy={pt.meanY} r="4" fill="#94a3b8" />
              )}

              {/* 잠재 점수 점 */}
              {(metricMode === 'SCORE' || metricMode === 'GRADE') &&
                pt.secondaryY !== null &&
                pt.secondaryY !== pt.primaryY && (
                  <g>
                    <circle
                      cx={pt.x}
                      cy={pt.secondaryY}
                      r="5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.secondaryY - 9}
                      textAnchor="middle"
                      className="fill-emerald-700 text-[10px] font-extrabold"
                    >
                      {pt.secondaryLabel}
                    </text>
                  </g>
                )}

              {/* 메인 데이터 포인트 */}
              {pt.primaryY !== null && (
                <g>
                  <circle
                    cx={pt.x}
                    cy={pt.primaryY}
                    r={isSelected ? '7' : '5.5'}
                    fill={metricMode === 'PERCENT' ? '#7c3aed' : '#4f46e5'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={pt.x}
                    y={pt.primaryY + (pt.secondaryY !== null && pt.secondaryY < pt.primaryY ? 16 : -11)}
                    textAnchor="middle"
                    className="fill-slate-900 text-[11px] font-black"
                  >
                    {pt.primaryLabel}
                  </text>
                </g>
              )}

              {/* X축 시험 라벨 */}
              <text
                x={pt.x}
                y={height - padBottom + 18}
                textAnchor="middle"
                className={`text-[10px] ${
                  isSelected ? 'fill-indigo-700 font-black' : 'fill-slate-600 font-bold'
                }`}
              >
                {formatExamShortLabel(pt.exam)}
              </text>
              <text
                x={pt.x}
                y={height - padBottom + 32}
                textAnchor="middle"
                className="fill-slate-400 text-[9px] font-semibold"
              >
                {pt.exam.subject?.slice(0, 6)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

