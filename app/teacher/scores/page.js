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
  findPreviousComparableExam,
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
  manual_grade: '',
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

  // 상단 메인 탭: 'STUDENT_ANALYSIS' | 'BATCH_INPUT' | 'PROFILE_SETUP' | 'SCHOOL_STATS'
  const [mainTab, setMainTab] = useState('STUDENT_ANALYSIS');

  // 좌측 학생 필터 및 선택 상태
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // 학생 학교/학년/목표 프로필 편집 상태
  const [profileSchoolName, setProfileSchoolName] = useState('');
  const [profileSchoolGrade, setProfileSchoolGrade] = useState(1);
  const [profileGradeSystem, setProfileGradeSystem] = useState(9);
  const [profileTargetGrade, setProfileTargetGrade] = useState('');
  const [profileTargetScore, setProfileTargetScore] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // 차트 필터 및 모드 상태
  const [chartCategoryFilter, setChartCategoryFilter] = useState('ALL'); // 'ALL' | 'INTERNAL' | 'MOCK'
  const [chartSubjectFilter, setChartSubjectFilter] = useState('ALL'); // 'ALL' 또는 특정 수학 과목명
  const [chartMetricMode, setChartMetricMode] = useState('SCORE'); // 'SCORE' | 'GRADE' | 'PERCENT'
  const [selectedExamIdForDetail, setSelectedExamIdForDetail] = useState(null);

  // 성적 등록/수정 모달 상태
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [examForm, setExamForm] = useState(INITIAL_EXAM_FORM);

  // 학부모 상담 브리핑 모드 (편집 버튼 숨김 & 깔끔 뷰)
  const [isConsultMode, setIsConsultMode] = useState(false);

  // 탭 2: 시험별 엑셀형 일괄 입력 상태
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

  // 탭 4: 학생별 학교·학년·등급제 일괄 세팅 상태
  const [bulkProfileClassFilter, setBulkProfileClassFilter] = useState('ALL');
  const [bulkProfileSearch, setBulkProfileSearch] = useState('');
  const [bulkProfileRows, setBulkProfileRows] = useState({});
  const [bulkApplySchool, setBulkApplySchool] = useState('');
  const [bulkApplyGrade, setBulkApplyGrade] = useState(1);
  const [bulkApplySystem, setBulkApplySystem] = useState(5);

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

  // 선택된 학생이 바뀔 때 학교/학년/목표 프로필 입력창 동기화
  useEffect(() => {
    if (!currentStudent) return;
    const prof = studentProfiles[currentStudent.id] || {};
    setProfileSchoolName(prof.school_name || currentStudent.school_name || '');
    setProfileSchoolGrade(Number(prof.school_grade || currentStudent.school_grade) || 1);
    setProfileGradeSystem(Number(prof.grade_system || currentStudent.grade_system) || 9);
    setProfileTargetGrade(
      prof.target_grade !== undefined && prof.target_grade !== null
        ? String(prof.target_grade)
        : currentStudent.target_grade
        ? String(currentStudent.target_grade)
        : ''
    );
    setProfileTargetScore(
      prof.target_score !== undefined && prof.target_score !== null
        ? String(prof.target_score)
        : currentStudent.target_score
        ? String(currentStudent.target_score)
        : ''
    );
    setSelectedExamIdForDetail(null);
    setChartSubjectFilter('ALL');
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

  // 현재 학생이 응시한 수학 과목 목록 (고2·고3 복수 선택과목 분리 조회용)
  const studentSubjects = useMemo(() => {
    const set = new Set();
    studentExams.forEach((sc) => {
      if (sc.subject?.trim()) set.add(sc.subject.trim());
    });
    return Array.from(set);
  }, [studentExams]);

  // 차트 필터(내신/모의 + 과목)가 적용된 시험 목록
  const filteredStudentExams = useMemo(() => {
    return studentExams.filter((sc) => {
      if (chartCategoryFilter !== 'ALL' && sc.exam_category !== chartCategoryFilter) {
        return false;
      }
      if (chartSubjectFilter !== 'ALL' && (sc.subject || '').trim() !== chartSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [studentExams, chartCategoryFilter, chartSubjectFilter]);

  // 성적 추이 차트 전용 시험 목록: 중간·기말 지필고사와 모의고사만 연결하고 학기 최종(합산)은 기말고사 뒤 중복 꺾임 방지를 위해 분리
  const timelineChartExams = useMemo(() => {
    const regularOnly = filteredStudentExams.filter(
      (sc) => sc.exam_period !== '1_SEMESTER' && sc.exam_period !== '2_SEMESTER'
    );
    return regularOnly.length > 0 ? regularOnly : filteredStudentExams;
  }, [filteredStudentExams]);

  // 학기 최종(합산) 성적 목록 (차트 상단/하단에 별도 요약 배지로 제공)
  const semesterTotalExams = useMemo(() => {
    return filteredStudentExams.filter(
      (sc) => sc.exam_period === '1_SEMESTER' || sc.exam_period === '2_SEMESTER'
    );
  }, [filteredStudentExams]);

  // 현재 상세 분석에 표시할 대상 시험 (선택된 시험이 없으면 가장 최근 시험)
  const activeDetailExam = useMemo(() => {
    if (filteredStudentExams.length === 0) return null;
    if (selectedExamIdForDetail) {
      const found = filteredStudentExams.find((e) => e.id === selectedExamIdForDetail);
      if (found) return found;
    }
    return filteredStudentExams[filteredStudentExams.length - 1];
  }, [filteredStudentExams, selectedExamIdForDetail]);

  // activeDetailExam 바로 이전 '동종 시험' (내신↔내신, 모의↔모의, 복수과목 시 동일과목 우선 매칭)
  const previousDetailExam = useMemo(() => {
    if (!activeDetailExam) return null;
    return findPreviousComparableExam(studentExams, activeDetailExam);
  }, [studentExams, activeDetailExam]);

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

  // 학생 프로필(학교/학년/등급제/목표) 저장 핸들러
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
          target_grade: profileTargetGrade !== '' ? Number(profileTargetGrade) : null,
          target_score: profileTargetScore !== '' ? Number(profileTargetScore) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로필 저장 실패');

      setStudentProfiles((prev) => ({
        ...prev,
        [currentStudent.id]: data.profile,
      }));
      alert(`${currentStudent.name} 학생의 학교·학년 및 목표 설정이 저장되었습니다.`);
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
      manual_grade: exam.manual_grade ?? '',
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
        Number(sc.school_grade) === Number(examForm.exam_grade || examForm.school_grade) &&
        sc.exam_period === examForm.exam_period &&
        sc.subject === examForm.subject &&
        (sc.school_mean !== null || sc.school_std_dev !== null || sc.total_students !== null)
    );
    return match || null;
  }, [scores, profileSchoolName, examForm.exam_category, examForm.exam_year, examForm.school_grade, examForm.exam_period, examForm.subject]);

  // 모달에서 '1학기 최종(합산)' 또는 '2학기 최종(합산)' 선택 시 해당 학기 중간+기말 성적 자동 합산 매칭
  const matchedSemesterMidFinalForModal = useMemo(() => {
    if (examForm.exam_category !== 'INTERNAL') return null;
    if (examForm.exam_period !== '1_SEMESTER' && examForm.exam_period !== '2_SEMESTER') return null;
    const targetPrefix = examForm.exam_period === '1_SEMESTER' ? '1_' : '2_';
    const midPeriod = `${targetPrefix}MID`;
    const finalPeriod = `${targetPrefix}FINAL`;

    const mid = studentExams.find(
      (sc) =>
        sc.exam_category === 'INTERNAL' &&
        Number(sc.exam_year) === Number(examForm.exam_year) &&
        Number(sc.school_grade) === Number(examForm.school_grade) &&
        sc.exam_period === midPeriod &&
        (sc.subject || '').trim() === (examForm.subject || '').trim()
    );
    const fin = studentExams.find(
      (sc) =>
        sc.exam_category === 'INTERNAL' &&
        Number(sc.exam_year) === Number(examForm.exam_year) &&
        Number(sc.school_grade) === Number(examForm.school_grade) &&
        sc.exam_period === finalPeriod &&
        (sc.subject || '').trim() === (examForm.subject || '').trim()
    );

    if (!mid && !fin) return null;

    const validScores = [mid?.raw_score, fin?.raw_score].filter(
      (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v))
    );
    const avgScore =
      validScores.length > 0
        ? Number(
            (validScores.reduce((a, b) => a + Number(b), 0) / validScores.length).toFixed(1)
          )
        : null;

    const validMeans = [mid?.school_mean, fin?.school_mean].filter(
      (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v))
    );
    const avgMean =
      validMeans.length > 0
        ? Number(
            (validMeans.reduce((a, b) => a + Number(b), 0) / validMeans.length).toFixed(1)
          )
        : null;

    const validStds = [mid?.school_std_dev, fin?.school_std_dev].filter(
      (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v))
    );
    const avgStd =
      validStds.length > 0
        ? Number(
            (validStds.reduce((a, b) => a + Number(b), 0) / validStds.length).toFixed(1)
          )
        : null;

    const totalStudents = fin?.total_students ?? mid?.total_students ?? null;

    const combinedBreakdown = {};
    ERROR_REASON_CATEGORIES.forEach((cat) => {
      const mVal = Number(mid?.error_breakdown?.[cat.key]) || 0;
      const fVal = Number(fin?.error_breakdown?.[cat.key]) || 0;
      const avgVal =
        validScores.length > 0
          ? Number(((mVal + fVal) / validScores.length).toFixed(1))
          : 0;
      combinedBreakdown[cat.key] = avgVal > 0 ? avgVal : '';
    });

    return {
      mid,
      fin,
      avgScore,
      avgMean,
      avgStd,
      totalStudents,
      combinedBreakdown,
    };
  }, [studentExams, examForm.exam_category, examForm.exam_period, examForm.exam_year, examForm.school_grade, examForm.subject]);

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

  // 학부모 상담용 분석 리포트 텍스트 복사
  const handleCopyConsultSummary = async () => {
    if (!currentStudent || !activeDetailExam) return;

    const examTitle = formatExamFullLabel(activeDetailExam);
    const pot = activePotentialAnalysis;
    const pos = activeGradeAnalysis;
    const trend = activeErrorTrendComparison;

    const resolvedGrade = activeDetailExam.grade || pos?.actualGrade;
    const lines = [];
    lines.push(`[품수학 학원] ${currentStudent.name} 학생 고교 수학 성적 분석 리포트`);
    if (profileSchoolName) {
      lines.push(`소속: ${profileSchoolName} ${profileSchoolGrade}학년 (${profileGradeSystem}등급제)`);
    }
    if (profileTargetGrade || profileTargetScore) {
      lines.push(
        `목표 설정: ${profileTargetGrade ? `${profileTargetGrade}등급` : ''}${
          profileTargetGrade && profileTargetScore ? ' / ' : ''
        }${profileTargetScore ? `${profileTargetScore}점` : ''}`
      );
    }
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`기준 시험: ${examTitle}`);
    lines.push(
      `• 원점수: ${activeDetailExam.raw_score ?? '-'}점 ${
        resolvedGrade ? `(${resolvedGrade}등급)` : ''
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
      lines.push(`\n[등급 컷 위치 진단]`);
      lines.push(`• 판정: ${pos.statusBadge}`);
      if (pos.message) lines.push(`• 상세: ${pos.message}`);
    }

    if (pot && pot.totalRecordedLost > 0) {
      lines.push(`\n[오답 원인별 감점 분석 (분류된 감점 -${pot.totalRecordedLost}점)]`);
      ERROR_REASON_CATEGORIES.forEach((cat) => {
        const val = Number(activeDetailExam?.error_breakdown?.[cat.key]) || 0;
        if (val > 0) {
          lines.push(`• ${cat.label}: -${val}점`);
        }
      });
    }

    if (trend?.insights?.length > 0) {
      lines.push(`\n[직전 시험 대비 감점 변화]`);
      trend.insights.forEach((ins) => {
        lines.push(`• ${ins.text}`);
      });
    }

    if (activeDetailExam.memo) {
      lines.push(`\n[담당 선생님 종합 의견]`);
      lines.push(`${activeDetailExam.memo}`);
    }

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('학부모 상담용 성적 분석 브리핑 문구가 클립보드에 복사되었습니다.\n카카오톡이나 문자 상담창에 바로 붙여넣기(Ctrl+V) 하실 수 있습니다.');
    } catch {
      prompt('아래 내용을 복사해 사용하세요:', text);
    }
  };

  // 탭 2 (일괄 입력) 초기화 및 시험 변경 시 기존 데이터 매핑
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
        manual_grade: existing?.manual_grade ?? '',
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
        delete_row: false,
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
          delete_row: false,
          error_breakdown: {
            ...(targetRow.error_breakdown || {}),
            [field]: value,
          },
        };
      } else {
        updatedRow = {
          ...targetRow,
          delete_row: false,
          [field]: value,
        };
      }

      const next = {
        ...prev,
        [studentId]: updatedRow,
      };

      // 내신 시험이고 같은 학교 평균/표준편차/전교생 자동 동기화가 켜져 있는 경우
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
            school_mean:
              next[studentId].school_mean !== ''
                ? next[studentId].school_mean
                : donor.school_mean,
            school_std_dev:
              next[studentId].school_std_dev !== ''
                ? next[studentId].school_std_dev
                : donor.school_std_dev,
            total_students:
              next[studentId].total_students !== ''
                ? next[studentId].total_students
                : donor.total_students,
          };
        }
      }

      return next;
    });
  };

  // 일괄 입력 행 성적 비우기/삭제 표시 핸들러
  const handleClearBatchRow = (studentId) => {
    setBatchRows((prev) => {
      const targetRow = prev[studentId] || { student_id: studentId };
      return {
        ...prev,
        [studentId]: {
          ...targetRow,
          raw_score: '',
          grade: '',
          manual_grade: '',
          rank: '',
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
          delete_row: true,
        },
      };
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
          syncSchoolStats: autoSyncSchoolStatsInBatch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일괄 저장 실패');

      setScores(data.scores || []);
      if (data.studentProfiles) setStudentProfiles(data.studentProfiles);
      const delMsg = data.deletedCount > 0 ? ` (비운 성적 ${data.deletedCount}건 삭제됨)` : '';
      alert(`총 ${data.savedCount}명의 시험 성적 및 학교 프로필이 일괄 저장되었습니다.${delMsg}`);
    } catch (err) {
      alert(`일괄 저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 탭 4 (학생별 학교·학년·등급제·목표 일괄 설정) 초기화
  useEffect(() => {
    if (mainTab !== 'PROFILE_SETUP') return;
    const next = {};
    students.forEach((st) => {
      const prof = studentProfiles[st.id] || {};
      next[st.id] = {
        student_id: st.id,
        school_name: prof.school_name || st.school_name || '',
        school_grade: Number(prof.school_grade || st.school_grade) || 1,
        grade_system: Number(prof.grade_system || st.grade_system) || 9,
        target_grade:
          prof.target_grade !== undefined && prof.target_grade !== null
            ? prof.target_grade
            : st.target_grade ?? '',
        target_score:
          prof.target_score !== undefined && prof.target_score !== null
            ? prof.target_score
            : st.target_score ?? '',
      };
    });
    setBulkProfileRows(next);
  }, [mainTab, students, studentProfiles]);

  // 일괄 프로필 설정 대상 학생 리스트
  const bulkProfileTargetStudents = useMemo(() => {
    return students.filter((st) => {
      if (bulkProfileClassFilter !== 'ALL') {
        const inClass = classStudents.some(
          (cs) => String(cs.class_id) === String(bulkProfileClassFilter) && cs.student_id === st.id
        );
        if (!inClass) return false;
      }
      if (bulkProfileSearch.trim()) {
        const kw = bulkProfileSearch.trim().toLowerCase();
        const rowSchool = (bulkProfileRows[st.id]?.school_name || '').toLowerCase();
        if (!st.name?.toLowerCase().includes(kw) && !rowSchool.includes(kw)) {
          return false;
        }
      }
      return true;
    });
  }, [students, classStudents, bulkProfileClassFilter, bulkProfileSearch, bulkProfileRows]);

  // 현재 표시된 학생 전체에게 학교/학년/등급제 일괄 채우기
  const handleApplyBulkProfileToVisible = (applySchool = false) => {
    setBulkProfileRows((prev) => {
      const next = { ...prev };
      bulkProfileTargetStudents.forEach((st) => {
        const curr = next[st.id] || { student_id: st.id };
        next[st.id] = {
          ...curr,
          school_name:
            applySchool && bulkApplySchool.trim()
              ? bulkApplySchool.trim()
              : curr.school_name || '',
          school_grade: Number(bulkApplyGrade) || 1,
          grade_system: Number(bulkApplySystem) === 5 ? 5 : 9,
        };
      });
      return next;
    });
  };

  // 일괄 프로필 서버 저장 실행
  const handleSaveBulkProfiles = async () => {
    try {
      setSaving(true);
      const payload = Object.values(bulkProfileRows);
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BATCH_SAVE_PROFILES',
          profiles: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일괄 프로필 저장 실패');

      if (data.studentProfiles) setStudentProfiles(data.studentProfiles);
      if (data.scores) setScores(data.scores);
      alert(`총 ${data.updatedCount}명의 소속 고등학교·학년·등급제·목표 설정이 저장되었습니다.`);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 탭 3: 학교별 내신 난이도 및 학원생 성과 집계 (중간·기말 지필고사만 집계하여 학기 최종 합산 중복 방지)
  const schoolExamStatsList = useMemo(() => {
    const groups = {};
    scores
      .filter(
        (sc) =>
          sc.exam_category === 'INTERNAL' &&
          sc.school_name &&
          sc.exam_period !== '1_SEMESTER' &&
          sc.exam_period !== '2_SEMESTER'
      )
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
            difficultyLabel = '고난도 (변별력 높음)';
            difficultyColor = 'rose';
          } else if (m < 65) {
            difficultyLabel = '표준 변별력';
            difficultyColor = 'indigo';
          } else {
            difficultyLabel = '평이 (감점 주의)';
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
    <div className="min-h-screen bg-slate-50 print:bg-white pb-28 print:pb-4 font-sans text-slate-800 antialiased">
      {/* 상단 고정 헤더 (인쇄 시 숨김) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3.5 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/teacher/dashboard')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition shrink-0"
            >
              ← 교무실로
            </button>
            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                고교 수학 성적 추이 및 오답 분석
              </h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                내신·모의고사 성적 추이와 감점 원인을 분석하여 다음 시험 대비 방향을 설계합니다
              </p>
            </div>
          </div>

          {/* 상단 모드 전환 탭 */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto border border-slate-200/60">
            {[
              { id: 'STUDENT_ANALYSIS', label: '학생별 성적 리포트' },
              { id: 'BATCH_INPUT', label: '시험별 일괄 입력' },
              { id: 'PROFILE_SETUP', label: '학교·학년 일괄 설정' },
              { id: 'SCHOOL_STATS', label: '학교별 난이도 관리' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setMainTab(t.id)}
                className={`text-xs font-bold px-3.5 py-2 rounded-lg transition whitespace-nowrap flex-1 sm:flex-initial ${
                  mainTab === t.id
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 mt-6 print:mt-0 print:px-0">
        {/* =====================================================================
            탭 1: 학생별 성적 리포트
           ===================================================================== */}
        {mainTab === 'STUDENT_ANALYSIS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측 사이드바: 학생 필터 및 선택 리스트 (상담 모드 또는 인쇄 시 숨김) */}
            {!isConsultMode && (
              <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs lg:sticky lg:top-20 space-y-3 print:hidden">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    대상 학생 ({filteredStudents.length}명)
                  </h2>
                  <button
                    onClick={() => setMainTab('PROFILE_SETUP')}
                    className="text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 font-bold px-2.5 py-1 rounded-lg transition shrink-0"
                  >
                    학교 일괄설정
                  </button>
                </div>

                {/* 반 필터 & 학교 필터 */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-700 focus:outline-slate-400"
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
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-700 focus:outline-slate-400"
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
                  placeholder="학생 이름 또는 고등학교 검색"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-slate-400"
                />

                {/* 학생 목록 */}
                <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[62vh] pb-1 lg:pb-0">
                  {filteredStudents.map((st) => {
                    const isSelected = currentStudent?.id === st.id;
                    const prof = studentProfiles[st.id] || {};
                    const stSchool = prof.school_name || st.school_name || '';
                    const stGrade = prof.school_grade || st.school_grade || 1;
                    const stSystem = Number(prof.grade_system || st.grade_system) === 5 ? 5 : 9;
                    const stScores = scores
                      .filter((sc) => sc.student_id === st.id)
                      .sort((a, b) => getExamSortOrder(a) - getExamSortOrder(b));
                    const latest = stScores[stScores.length - 1] || null;
                    const latestGrade = latest
                      ? latest.grade || calculateAutoGrade(latest, stSystem).grade
                      : null;

                    return (
                      <button
                        key={st.id}
                        onClick={() => setSelectedStudentId(st.id)}
                        className={`text-left px-3.5 py-2.5 rounded-xl border transition shrink-0 lg:shrink flex flex-col justify-between min-w-[152px] lg:min-w-0 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm truncate">{st.name}</span>
                          {latest ? (
                            <span
                              className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md shrink-0 ${
                                isSelected
                                  ? 'bg-white/15 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {latest.raw_score !== null ? `${latest.raw_score}점` : ''}
                              {latestGrade ? ` · ${latestGrade}등급` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">
                              미등록
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1">
                          <span
                            className={`truncate ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {stSchool ? `${stSchool} 고${stGrade}` : '학교 미지정'}
                          </span>
                          <span
                            className={`text-[10px] tabular-nums ${
                              isSelected ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {stScores.length}회
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* 우측 메인 성적 리포트 영역 */}
            <section
              className={`${
                isConsultMode ? 'lg:col-span-12' : 'lg:col-span-9'
              } print:col-span-12 space-y-5`}
            >
              {!currentStudent ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 font-semibold text-slate-400">
                  좌측 목록에서 학생을 선택해 주세요.
                </div>
              ) : (
                <>
                  {/* 1. 학생 기본 정보 및 리포트 제어 헤더 (깔끔한 화이트 카드) */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
                    {/* 상담 화면 모드 또는 인쇄 시 상단에 표시되는 리포트 타이틀 */}
                    <div
                      className={`${
                        isConsultMode ? 'flex' : 'hidden print:flex'
                      } items-center justify-between pb-3.5 mb-4 border-b border-slate-200 text-xs text-slate-500`}
                    >
                      <span className="font-bold text-slate-800">
                        품수학 고교 수학 성적 추이 및 오답 분석 리포트
                      </span>
                      <span className="tabular-nums">
                        출력일: {new Date().toISOString().slice(0, 10)}
                      </span>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            {currentStudent.name}
                          </h2>
                          <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1 rounded-lg">
                            {profileSchoolName ? `${profileSchoolName} · ` : ''}고{profileSchoolGrade} ({profileGradeSystem}등급제)
                          </span>
                          {(profileTargetGrade || profileTargetScore) && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold px-2.5 py-1 rounded-lg tabular-nums">
                              목표:{' '}
                              {[
                                profileTargetGrade ? `${profileTargetGrade}등급` : null,
                                profileTargetScore ? `${profileTargetScore}점` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                          {(studentClassNamesMap[currentStudent.id] || []).map((cName) => (
                            <span
                              key={cName}
                              className="text-xs bg-slate-50 text-slate-500 border border-slate-200/70 font-semibold px-2.5 py-0.5 rounded-lg"
                            >
                              {cName}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1.5 tabular-nums">
                          누적 시험 기록 총 {studentExams.length}회 (학교 내신{' '}
                          {studentExams.filter((e) => e.exam_category === 'INTERNAL').length}회 · 전국 모의고사{' '}
                          {studentExams.filter((e) => e.exam_category === 'MOCK').length}회)
                        </p>
                      </div>

                      {/* 우측 액션 버튼들 (인쇄 시 숨김) */}
                      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto print:hidden">
                        <button
                          onClick={() => setIsConsultMode(!isConsultMode)}
                          className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition ${
                            isConsultMode
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isConsultMode ? '관리 화면으로 돌아가기' : '학부모 상담 화면으로 보기'}
                        </button>

                        {activeDetailExam && (
                          <>
                            <button
                              onClick={handleCopyConsultSummary}
                              className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold px-3.5 py-2 rounded-xl transition"
                            >
                              상담 요약 복사
                            </button>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold px-3.5 py-2 rounded-xl transition"
                            >
                              리포트 인쇄 / PDF 저장
                            </button>
                          </>
                        )}

                        {!isConsultMode && (
                          <button
                            onClick={handleOpenNewScoreModal}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl shadow-2xs transition"
                          >
                            + 성적 입력
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 학교 · 학년 · 등급제 · 목표 설정 바 (일반 관리 모드에서만 표시, 인쇄 시 숨김) */}
                    {!isConsultMode && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-2 print:hidden">
                        <span className="text-xs font-semibold text-slate-500 mr-1 whitespace-nowrap">
                          학교·목표 설정:
                        </span>
                        <input
                          type="text"
                          list="known-schools-datalist"
                          placeholder="고등학교명 입력"
                          value={profileSchoolName}
                          onChange={(e) => setProfileSchoolName(e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-800 w-36 focus:outline-slate-400"
                        />
                        <datalist id="known-schools-datalist">
                          {schoolList.map((sch) => (
                            <option key={sch} value={sch} />
                          ))}
                        </datalist>

                        <select
                          value={profileSchoolGrade}
                          onChange={(e) => setProfileSchoolGrade(Number(e.target.value))}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
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
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                        >
                          <option value={9}>9등급제 (1등급 4%)</option>
                          <option value={5}>5등급제 (1등급 10%)</option>
                        </select>

                        <select
                          value={profileTargetGrade}
                          onChange={(e) => setProfileTargetGrade(e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                        >
                          <option value="">목표 등급 (선택)</option>
                          {Array.from(
                            { length: profileGradeSystem === 5 ? 5 : 9 },
                            (_, i) => i + 1
                          ).map((g) => (
                            <option key={g} value={g}>
                              목표 {g}등급
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="목표 점수"
                          value={profileTargetScore}
                          onChange={(e) => setProfileTargetScore(e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 w-24 tabular-nums focus:outline-slate-400"
                        />

                        <button
                          onClick={handleSaveProfile}
                          disabled={savingProfile}
                          className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                        >
                          {savingProfile ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 성적이 아직 1건도 없을 때 */}
                  {studentExams.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-2xs">
                      <h3 className="text-base font-bold text-slate-800">
                        아직 등록된 시험 성적이 없습니다
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        내신 지필고사나 모의고사 점수를 입력하면 성적 변화 추이 그래프와 등급 컷 위치, 오답 원인 분석표가 자동으로 생성됩니다.
                      </p>
                      <button
                        onClick={handleOpenNewScoreModal}
                        className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition"
                      >
                        + 첫 시험 성적 입력하기
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 2. 3대 핵심 요약 지표 카드 (잠재 성적 제거 → 원점수·등급 / 등급 컷 위치 / 학교 평균 대비 성과) */}
                      {activeDetailExam && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* 카드 1: 선택 시험 원점수 및 등급 */}
                          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                  선택 시험 성적
                                </span>
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md whitespace-nowrap">
                                  {formatExamShortLabel(activeDetailExam)}
                                </span>
                              </div>
                              <div className="mt-3 flex items-baseline justify-between gap-2">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                                    {activeDetailExam.raw_score !== null
                                      ? activeDetailExam.raw_score
                                      : '-'}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-400">
                                    점
                                  </span>
                                </div>
                                {(activeDetailExam.grade || activeGradeAnalysis?.actualGrade) && (
                                  <span className="text-sm font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg tabular-nums whitespace-nowrap">
                                    {activeDetailExam.grade || activeGradeAnalysis?.actualGrade}등급
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                              {previousDetailExam &&
                              previousDetailExam.raw_score !== null &&
                              activeDetailExam.raw_score !== null ? (
                                (() => {
                                  const diff = Number(
                                    (
                                      activeDetailExam.raw_score -
                                      previousDetailExam.raw_score
                                    ).toFixed(1)
                                  );
                                  return (
                                    <>
                                      <span className="text-slate-500 font-medium truncate">
                                        직전({formatExamShortLabel(previousDetailExam)}) 대비
                                      </span>
                                      <span
                                        className={`font-bold tabular-nums whitespace-nowrap ${
                                          diff > 0
                                            ? 'text-emerald-600'
                                            : diff < 0
                                            ? 'text-rose-600'
                                            : 'text-slate-500'
                                        }`}
                                      >
                                        {diff > 0
                                          ? `+${diff}점 상승`
                                          : diff < 0
                                          ? `${diff}점 하락`
                                          : '동일'}
                                      </span>
                                    </>
                                  );
                                })()
                              ) : (
                                <span className="text-slate-400 font-medium">
                                  과목: {activeDetailExam.subject || '수학'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 카드 2: 등급 컷 위치 및 석차 백분율 진단 */}
                          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                  등급 컷 위치 진단
                                </span>
                                {activeGradeAnalysis?.topPct !== null && (
                                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md tabular-nums whitespace-nowrap">
                                    상위 {activeGradeAnalysis.topPct}%
                                  </span>
                                )}
                              </div>

                              <div className="mt-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-base font-black text-slate-900">
                                    {activeGradeAnalysis?.statusBadge || '석차·편차 미입력'}
                                  </span>
                                  {activeDetailExam.rank && activeDetailExam.total_students && (
                                    <span className="text-xs font-bold text-slate-500 tabular-nums whitespace-nowrap">
                                      {activeDetailExam.rank}등 / {activeDetailExam.total_students}명
                                    </span>
                                  )}
                                </div>
                                {activeGradeAnalysis?.topPct !== null && (
                                  <div className="mt-2.5">
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-indigo-600 rounded-full transition-all"
                                        style={{ width: `${activeGradeAnalysis.progressInBand}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1 tabular-nums">
                                      <span>하위컷 {activeGradeAnalysis.bandMaxPct}%</span>
                                      <span>상위컷 {activeGradeAnalysis.bandMinPct}%</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium leading-snug">
                              {activeGradeAnalysis?.message ||
                                '석차/수강자수 입력 시 등급 내 상세 위치가 표시됩니다'}
                            </div>
                          </div>

                          {/* 카드 3: 학교 평균 및 난이도 (평균만 입력된 경우에도 깔끔하게 표시) */}
                          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                  학교 평균 및 상대 성취도
                                </span>
                                {activeDetailExam.school_mean !== null && (
                                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md tabular-nums whitespace-nowrap">
                                    학교 평균 {activeDetailExam.school_mean}점
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex items-baseline justify-between gap-2">
                                {activeGradeAnalysis?.zScore !== null &&
                                activeGradeAnalysis?.zScore !== undefined ? (
                                  <>
                                    <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                                      Z {activeGradeAnalysis.zScore > 0
                                        ? `+${activeGradeAnalysis.zScore}`
                                        : activeGradeAnalysis.zScore}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 tabular-nums whitespace-nowrap">
                                      정규분포 상위 {zScoreToTopPercent(activeGradeAnalysis.zScore)}%
                                    </span>
                                  </>
                                ) : activeDetailExam.school_mean !== null &&
                                  activeDetailExam.raw_score !== null ? (
                                  (() => {
                                    const diffMean = Number(
                                      (
                                        activeDetailExam.raw_score -
                                        activeDetailExam.school_mean
                                      ).toFixed(1)
                                    );
                                    return (
                                      <div className="flex items-baseline justify-between w-full gap-2">
                                        <span
                                          className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                                            diffMean >= 0
                                              ? 'text-indigo-700'
                                              : 'text-rose-600'
                                          }`}
                                        >
                                          {diffMean >= 0 ? `+${diffMean}점` : `${diffMean}점`}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                          학교 평균 대비 격차
                                        </span>
                                      </div>
                                    );
                                  })()
                                ) : activeDetailExam.exam_category === 'MOCK' &&
                                  activeDetailExam.percentile !== null ? (
                                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                                    백분위 {activeDetailExam.percentile}%
                                  </span>
                                ) : (
                                  <span className="text-sm font-semibold text-slate-400 py-1">
                                    학교 평균 미입력
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium flex items-center justify-between tabular-nums">
                              {activeDetailExam.school_mean !== null &&
                              activeDetailExam.raw_score !== null ? (
                                <>
                                  <span>
                                    {activeDetailExam.school_std_dev
                                      ? `표준편차 ${activeDetailExam.school_std_dev}`
                                      : `학교 과목 평균 ${activeDetailExam.school_mean}점`}
                                  </span>
                                  <strong className="text-slate-800 font-bold">
                                    평균 대비{' '}
                                    {activeDetailExam.raw_score - activeDetailExam.school_mean >= 0
                                      ? `+${(
                                          activeDetailExam.raw_score -
                                          activeDetailExam.school_mean
                                        ).toFixed(1)}점`
                                      : `${(
                                          activeDetailExam.raw_score -
                                          activeDetailExam.school_mean
                                        ).toFixed(1)}점`}
                                  </strong>
                                </>
                              ) : (
                                <span>학교 평균·표준편차 입력 시 상대 난이도가 분석됩니다</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. 시간순 성적 변화 추이 차트 (영어 뱃지 및 잠재점수 제거) */}
                      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                              고교 과정 성적 추이 차트
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              차트의 시험 지점을 클릭하면 하단의 오답 원인 분석 리포트가 해당 시험으로 전환됩니다.
                            </p>
                          </div>

                          {/* 차트 필터 & 지표 전환 버튼 */}
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                              {[
                                { id: 'ALL', label: '전체 (내신+모의)' },
                                { id: 'INTERNAL', label: '내신 지필' },
                                { id: 'MOCK', label: '전국 모의' },
                              ].map((tab) => (
                                <button
                                  key={tab.id}
                                  onClick={() => setChartCategoryFilter(tab.id)}
                                  className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                                    chartCategoryFilter === tab.id
                                      ? 'bg-slate-900 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            {/* 고2·고3 등 2개 이상 수학 과목 응시 시 과목별 분리 필터 표시 */}
                            {studentSubjects.length >= 2 && (
                              <select
                                value={chartSubjectFilter}
                                onChange={(e) => setChartSubjectFilter(e.target.value)}
                                className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 font-extrabold text-slate-800"
                              >
                                <option value="ALL">전체 과목 ({studentSubjects.length}개)</option>
                                {studentSubjects.map((subj) => (
                                  <option key={subj} value={subj}>
                                    {subj} 과목만 보기
                                  </option>
                                ))}
                              </select>
                            )}

                            <div className="flex bg-slate-100 border border-slate-200/70 p-1 rounded-xl">
                              {[
                                { id: 'SCORE', label: '원점수 추이' },
                                { id: 'GRADE', label: '등급 추이 (1등급 상단)' },
                                { id: 'PERCENT', label: '상위 누적 %' },
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setChartMetricMode(m.id)}
                                  className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                                    chartMetricMode === m.id
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 범례 (잠재점수 제거 후 깔끔한 실전 지표만 표시) */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 border border-slate-200/70 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700">
                          <div className="flex flex-wrap items-center gap-4">
                            {chartMetricMode === 'SCORE' && (
                              <>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-indigo-200 inline-block" />
                                  <span>내신 원점수</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200 inline-block" />
                                  <span>모의고사 원점수</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                                  <span>학교 과목 평균선 (점선)</span>
                                </span>
                              </>
                            )}
                            {chartMetricMode === 'GRADE' && (
                              <>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-indigo-200 inline-block" />
                                  <span>내신 산출 등급 (상단 1등급)</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200 inline-block" />
                                  <span>모의고사 등급</span>
                                </span>
                              </>
                            )}
                            {chartMetricMode === 'PERCENT' && (
                              <>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full bg-violet-600 ring-2 ring-violet-200 inline-block" />
                                  <span>내신 상위 누적 % (상단 상위 1%)</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200 inline-block" />
                                  <span>모의고사 상위 누적 %</span>
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400">
                            내신과 모의고사는 시험 성격이 달라 별도의 추이선으로 분리 표시됩니다
                          </span>
                        </div>

                        {/* SVG 타임라인 차트 렌더러 (학기 합산은 꺾은선 왜곡 방지를 위해 하단 요약 바로 분리 표시) */}
                        <ScoreTimelineChart
                          exams={timelineChartExams}
                          metricMode={chartMetricMode}
                          gradeSystem={profileGradeSystem}
                          targetGrade={profileTargetGrade ? Number(profileTargetGrade) : null}
                          targetScore={profileTargetScore ? Number(profileTargetScore) : null}
                          selectedExamId={activeDetailExam?.id}
                          onSelectExam={(id) => setSelectedExamIdForDetail(id)}
                        />

                        {/* 학기 최종(합산) 성적이 있는 경우 추이선과 분리된 별도 요약 바로 표시 */}
                        {semesterTotalExams.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500">
                              학기 최종(중간+기말 합산) 성적 (클릭 시 상세 분석 전환 · 추이선 왜곡 방지를 위해 별도 표시):
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {semesterTotalExams.map((semEx) => {
                                const isSel = activeDetailExam?.id === semEx.id;
                                const semPos = analyzeGradePosition(semEx, profileGradeSystem);
                                const semG = semEx.grade || semPos?.actualGrade;
                                return (
                                  <button
                                    key={semEx.id}
                                    type="button"
                                    onClick={() => setSelectedExamIdForDetail(semEx.id)}
                                    className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition flex items-center gap-2 tabular-nums ${
                                      isSel
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <span>{formatExamShortLabel(semEx)}</span>
                                    <span className="font-black">
                                      {semEx.raw_score !== null ? `${semEx.raw_score}점` : '-'}
                                    </span>
                                    {semG && (
                                      <span
                                        className={`text-[11px] px-1.5 py-0.5 rounded font-extrabold ${
                                          isSel
                                            ? 'bg-indigo-700 text-white'
                                            : 'bg-indigo-50 text-indigo-700'
                                        }`}
                                      >
                                        {semG}등급
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. 오답 감점 원인 정밀 분석 (좌측 컬러 도넛 차트 + 우측 항목별 수평 바 비교) */}
                      {activeDetailExam && (
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                            <div>
                              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                [{formatExamFullLabel(activeDetailExam)}] 오답 원인 및 감점 비중 분석
                              </h3>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                감점 원인을 &lsquo;풀이 습관·실전 운영(계산·조건·시간)&rsquo;과 &lsquo;개념·유형·심화 역량&rsquo;으로 나누어 다음 시험 보완 과제를 점검합니다.
                              </p>
                            </div>
                            {!isConsultMode && (
                              <button
                                onClick={() => handleOpenEditScoreModal(activeDetailExam)}
                                className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold px-3.5 py-2 rounded-xl transition shrink-0 print:hidden"
                              >
                                점수 및 오답 수정
                              </button>
                            )}
                          </div>

                          {/* 직전 동종 시험 대비 핵심 변화 요약 */}
                          {activeErrorTrendComparison?.insights?.length > 0 && (
                            <div className="space-y-2">
                              {activeErrorTrendComparison.insights.map((ins, i) => (
                                <div
                                  key={i}
                                  className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 ${
                                    ins.type === 'POSITIVE'
                                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                      : ins.type === 'WARNING' || ins.type === 'NEGATIVE'
                                      ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <span
                                    className={`text-[11px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                      ins.type === 'POSITIVE'
                                        ? 'bg-emerald-600 text-white'
                                        : ins.type === 'WARNING' || ins.type === 'NEGATIVE'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-slate-700 text-white'
                                    }`}
                                  >
                                    {ins.type === 'POSITIVE'
                                      ? '개선'
                                      : ins.type === 'WARNING' || ins.type === 'NEGATIVE'
                                      ? '주의'
                                      : '분석'}
                                  </span>
                                  <span className="leading-relaxed">{ins.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 2단 데이터 시각화 레이아웃: 좌측 도넛 차트 / 우측 6대 항목 수평 바 비교 */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                            {/* 좌측 (5칸): 감점 구조 SVG 도넛 차트 */}
                            <div className="lg:col-span-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <h4 className="text-xs font-black text-slate-800">
                                    감점 유형별 비중 차트
                                  </h4>
                                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                                    {activePotentialAnalysis?.totalActualLost !== null &&
                                    activePotentialAnalysis?.totalActualLost !== undefined &&
                                    activePotentialAnalysis.totalActualLost !==
                                      activePotentialAnalysis.totalRecordedLost ? (
                                      <>
                                        전체 감점{' '}
                                        <strong className="text-slate-700">
                                          -{activePotentialAnalysis.totalActualLost}점
                                        </strong>{' '}
                                        중{' '}
                                        <strong className="text-slate-900 font-black">
                                          -{activePotentialAnalysis?.totalRecordedLost || 0}점
                                        </strong>{' '}
                                        분류됨
                                      </>
                                    ) : (
                                      <>
                                        분류된 감점{' '}
                                        <strong className="text-slate-900 font-black">
                                          -{activePotentialAnalysis?.totalRecordedLost || 0}점
                                        </strong>
                                      </>
                                    )}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  항목별 감점 점수가 분류된 감점 합계에서 차지하는 비율
                                </p>
                              </div>

                              {(() => {
                                const totalLost = activePotentialAnalysis?.totalRecordedLost || 0;
                                const radius = 58;
                                const circumference = 2 * Math.PI * radius;
                                const colorMap = {
                                  mistake_calc: '#f43f5e',
                                  mistake_cond: '#fb923c',
                                  mistake_essay: '#eab308',
                                  skill_concept: '#4f46e5',
                                  skill_approach: '#0ea5e9',
                                  skill_killer: '#64748b',
                                };

                                let cumulativeFraction = 0;
                                const segments =
                                  totalLost > 0
                                    ? ERROR_REASON_CATEGORIES.map((cat) => {
                                        const val =
                                          Number(
                                            activeDetailExam?.error_breakdown?.[cat.key]
                                          ) || 0;
                                        const frac = val / totalLost;
                                        const seg = {
                                          key: cat.key,
                                          label: cat.shortLabel,
                                          val,
                                          pct: Math.round(frac * 100),
                                          color: colorMap[cat.key] || '#64748b',
                                          dashArray: `${(frac * circumference).toFixed(2)} ${circumference.toFixed(2)}`,
                                          dashOffset: -(
                                            cumulativeFraction * circumference
                                          ).toFixed(2),
                                        };
                                        cumulativeFraction += frac;
                                        return seg;
                                      }).filter((s) => s.val > 0)
                                    : [];

                                return (
                                  <div className="my-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-5">
                                    <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                                      <svg
                                        viewBox="0 0 150 150"
                                        className="w-full h-full -rotate-90"
                                      >
                                        <circle
                                          cx="75"
                                          cy="75"
                                          r={radius}
                                          fill="none"
                                          stroke="#e2e8f0"
                                          strokeWidth="18"
                                        />
                                        {segments.map((seg) => (
                                          <circle
                                            key={seg.key}
                                            cx="75"
                                            cy="75"
                                            r={radius}
                                            fill="none"
                                            stroke={seg.color}
                                            strokeWidth="18"
                                            strokeDasharray={seg.dashArray}
                                            strokeDashoffset={seg.dashOffset}
                                          />
                                        ))}
                                      </svg>
                                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] font-bold text-slate-400">
                                          기록된 감점
                                        </span>
                                        <span className="text-xl font-black text-slate-900 tabular-nums tracking-tight">
                                          {totalLost > 0 ? `-${totalLost}점` : '0점'}
                                        </span>
                                      </div>
                                    </div>

                                    {totalLost > 0 ? (
                                      <div className="w-full space-y-2 text-xs">
                                        {segments.map((seg) => (
                                          <div
                                            key={seg.key}
                                            className="flex items-center justify-between gap-2"
                                          >
                                            <span className="flex items-center gap-2 font-bold text-slate-700 whitespace-nowrap">
                                              <span
                                                className="w-2.5 h-2.5 rounded-xs shrink-0 inline-block"
                                                style={{ backgroundColor: seg.color }}
                                              />
                                              <span>{seg.label}</span>
                                            </span>
                                            <span className="font-black text-slate-900 tabular-nums whitespace-nowrap">
                                              -{seg.val}점{' '}
                                              <span className="text-slate-400 font-bold text-[11px]">
                                                ({seg.pct}%)
                                              </span>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs font-bold text-slate-400 text-center">
                                        분류된 오답 감점이 없습니다.
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* 하단 풀이 습관 감점 vs 개념·심화 감점 2분할 요약 */}
                              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-200/80 text-xs tabular-nums">
                                <div className="bg-white rounded-xl p-3 border border-slate-200/80">
                                  <span className="text-[11px] font-bold text-slate-500 block">
                                    계산·조건·시간 감점
                                  </span>
                                  <span className="text-base font-black text-rose-600 mt-0.5 block">
                                    -{activePotentialAnalysis?.recoverableLost || 0}점
                                  </span>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-slate-200/80">
                                  <span className="text-[11px] font-bold text-slate-500 block">
                                    개념·유형·심화 감점
                                  </span>
                                  <span className="text-base font-black text-indigo-900 mt-0.5 block">
                                    -{activePotentialAnalysis?.skillLost || 0}점
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 우측 (7칸): 6대 감점 항목별 수평 막대 비교 표 (항목명 말줄임 잘림 방지) */}
                            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between">
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <h4 className="text-xs font-black text-slate-800">
                                  6대 오답 원인별 감점 점수 및 직전 시험 대비 변화
                                </h4>
                                {previousDetailExam && (
                                  <span className="text-[11px] font-bold text-slate-400">
                                    비교 기준: {formatExamShortLabel(previousDetailExam)}
                                  </span>
                                )}
                              </div>

                              <div className="divide-y divide-slate-100 my-1">
                                {ERROR_REASON_CATEGORIES.map((cat) => {
                                  const currVal =
                                    Number(activeDetailExam?.error_breakdown?.[cat.key]) || 0;
                                  const prevVal = previousDetailExam
                                    ? Number(previousDetailExam?.error_breakdown?.[cat.key]) || 0
                                    : null;
                                  const diff =
                                    prevVal !== null
                                      ? Number((currVal - prevVal).toFixed(1))
                                      : null;
                                  const maxRef = Math.max(
                                    15,
                                    activePotentialAnalysis?.totalRecordedLost || 15
                                  );
                                  const barPct = Math.min(
                                    100,
                                    Math.round((currVal / maxRef) * 100)
                                  );

                                  const barColorMap = {
                                    mistake_calc: 'bg-rose-500',
                                    mistake_cond: 'bg-orange-400',
                                    mistake_essay: 'bg-amber-500',
                                    skill_concept: 'bg-indigo-600',
                                    skill_approach: 'bg-sky-500',
                                    skill_killer: 'bg-slate-600',
                                  };

                                  return (
                                    <div key={cat.key} className="py-3 first:pt-2 last:pb-1">
                                      <div className="flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap ${
                                              cat.recoverable
                                                ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                                : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                            }`}
                                          >
                                            {cat.recoverable ? '풀이습관' : '개념·심화'}
                                          </span>
                                          <span className="font-black text-slate-900 whitespace-nowrap">
                                            {cat.label}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                          {prevVal !== null && (
                                            <span
                                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                                                diff < 0
                                                  ? 'bg-emerald-50 text-emerald-700'
                                                  : diff > 0
                                                  ? 'bg-rose-50 text-rose-700'
                                                  : 'bg-slate-50 text-slate-400'
                                              }`}
                                            >
                                              직전 -{prevVal}점
                                              {diff < 0
                                                ? ` (${Math.abs(diff)}점 감소)`
                                                : diff > 0
                                                ? ` (+${diff}점 증가)`
                                                : ' (동일)'}
                                            </span>
                                          )}
                                          <span
                                            className={`text-sm font-black w-12 text-right whitespace-nowrap ${
                                              currVal > 0
                                                ? cat.recoverable
                                                  ? 'text-rose-600'
                                                  : 'text-indigo-900'
                                                : 'text-slate-300'
                                            }`}
                                          >
                                            {currVal > 0 ? `-${currVal}점` : '0점'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* 수평 막대 바 */}
                                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            currVal > 0
                                              ? barColorMap[cat.key] || 'bg-indigo-600'
                                              : 'bg-transparent'
                                          }`}
                                          style={{ width: `${barPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* 담당 선생님 시험 총평 및 학습 처방 코멘트 */}
                          {activeDetailExam.memo && (
                            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/90 border-l-4 border-l-indigo-600">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-black text-slate-900">
                                  담당 선생님 종합 의견 및 학습 처방
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                                {activeDetailExam.memo}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. 학생 누적 성적 전체 이력 표 (잠재 점수 열 제거 & 줄바꿈 깨짐 방지 & 자동 산출 등급 표시) */}
                      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                              {currentStudent.name} 학생 누적 시험 성적표 ({filteredStudentExams.length}건)
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              행을 클릭하면 상단 상세 분석 리포트가 해당 시험 기준으로 전환됩니다.
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                          <table className="w-full text-left border-collapse text-xs tabular-nums">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600 font-black bg-slate-50 whitespace-nowrap">
                                <th className="py-3 px-3.5">시험 구분</th>
                                <th className="py-3 px-3">과목명</th>
                                <th className="py-3 px-3 text-right">원점수</th>
                                <th className="py-3 px-3 text-center">산출 등급</th>
                                <th className="py-3 px-3 text-right">석차 / 백분위</th>
                                <th className="py-3 px-3 text-right">학교 평균 (편차)</th>
                                <th className="py-3 px-3 text-center">상위 누적 %</th>
                                <th className="py-3 px-3">오답 감점 내역 및 메모</th>
                                {!isConsultMode && (
                                  <th className="py-3 px-3 text-center print:hidden">관리</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold">
                              {filteredStudentExams.map((exam) => {
                                const isSelectedRow = activeDetailExam?.id === exam.id;
                                const pos = analyzeGradePosition(exam, profileGradeSystem);
                                const resolvedGrade = exam.grade || pos?.actualGrade;
                                const activeErrors = ERROR_REASON_CATEGORIES.filter(
                                  (c) => Number(exam.error_breakdown?.[c.key]) > 0
                                );

                                return (
                                  <tr
                                    key={exam.id}
                                    onClick={() => setSelectedExamIdForDetail(exam.id)}
                                    className={`cursor-pointer transition ${
                                      isSelectedRow
                                        ? 'bg-indigo-50/60'
                                        : 'hover:bg-slate-50/90'
                                    }`}
                                  >
                                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                            exam.exam_category === 'INTERNAL'
                                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                                              : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                                          }`}
                                        >
                                          {exam.exam_category === 'INTERNAL' ? '내신' : '모의'}
                                        </span>
                                        <span className="font-black text-slate-900">
                                          {exam.exam_year}년 {formatExamShortLabel(exam)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-3 text-slate-700 font-bold whitespace-nowrap">
                                      {exam.subject}
                                    </td>
                                    <td className="py-3.5 px-3 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                                      {exam.raw_score !== null ? `${exam.raw_score}점` : '-'}
                                    </td>
                                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                      {resolvedGrade ? (
                                        <span
                                          className={`font-black px-2.5 py-1 rounded-lg text-xs inline-block ${
                                            Number(resolvedGrade) <= 2
                                              ? 'bg-indigo-600 text-white'
                                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                                          }`}
                                        >
                                          {resolvedGrade}등급
                                        </span>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-slate-700 whitespace-nowrap">
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
                                    <td className="py-3.5 px-3 text-right text-slate-600 whitespace-nowrap">
                                      {exam.school_mean !== null
                                        ? `${exam.school_mean}점${
                                            exam.school_std_dev ? ` (±${exam.school_std_dev})` : ''
                                          }`
                                        : '-'}
                                    </td>
                                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                      {pos?.zScore !== null && pos?.zScore !== undefined ? (
                                        <span className="text-indigo-700 font-black">
                                          상위 {pos.topPct}%{' '}
                                          <span className="text-slate-400 font-bold text-[11px]">
                                            (Z {pos.zScore > 0 ? `+${pos.zScore}` : pos.zScore})
                                          </span>
                                        </span>
                                      ) : pos?.topPct !== null ? (
                                        <span className="text-slate-700 font-bold">
                                          상위 {pos.topPct}%
                                        </span>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-3.5 px-3 min-w-[260px] max-w-[360px]">
                                      <div className="flex flex-wrap gap-1.5">
                                        {activeErrors.map((cat) => (
                                          <span
                                            key={cat.key}
                                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                                              cat.recoverable
                                                ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                                : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                            }`}
                                          >
                                            {cat.shortLabel} -{exam.error_breakdown[cat.key]}점
                                          </span>
                                        ))}
                                      </div>
                                      {exam.memo && (
                                        <div className="text-[11px] text-slate-500 truncate mt-1">
                                          {exam.memo}
                                        </div>
                                      )}
                                    </td>
                                    {!isConsultMode && (
                                      <td
                                        className="py-3.5 px-3 text-center whitespace-nowrap print:hidden"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => handleOpenEditScoreModal(exam)}
                                          className="text-indigo-600 hover:text-indigo-800 font-extrabold mr-2.5"
                                        >
                                          수정
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeleteScore(exam.id, formatExamFullLabel(exam))
                                          }
                                          className="text-rose-500 hover:text-rose-700 font-bold"
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
            탭 2: 시험별 엑셀형 일괄 빠른 입력 (스프레드시트 모드)
           ===================================================================== */}
        {mainTab === 'BATCH_INPUT' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  시험별 엑셀형 일괄 입력
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  키보드 <kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-black">Tab</kbd> 키로 칸을 이동하며 여러 학생의 성적과 감점 요인을 한 번에 입력할 수 있습니다.
                </p>
              </div>

              <button
                onClick={handleSaveBatch}
                disabled={saving}
                className="text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl shadow-xs transition shrink-0 whitespace-nowrap"
              >
                {saving ? '일괄 저장 중...' : '입력된 성적 일괄 저장'}
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
                    같은 고등학교 학생끼리는 한 명만 [학교 평균 / 표준편차 / 수강자수]를 입력해도 자동으로 공유됩니다.
                  </span>
                </label>
              </div>
            )}

            {/* 엑셀형 스프레드시트 테이블 */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 whitespace-nowrap">
                    <th className="py-2.5 px-2.5 min-w-[90px]">학생명</th>
                    <th className="py-2.5 px-2 min-w-[115px]">고등학교명</th>
                    <th className="py-2.5 px-2 min-w-[75px] bg-indigo-50/50 text-indigo-900">
                      원점수
                    </th>
                    {batchMeta.exam_category === 'INTERNAL' ? (
                      <>
                        <th className="py-2.5 px-2 min-w-[75px] bg-indigo-50/50 text-indigo-900">
                          전교석차
                        </th>
                        <th className="py-2.5 px-2 min-w-[78px] bg-indigo-50/50 text-indigo-900">
                          수강자수
                        </th>
                        <th className="py-2.5 px-2 min-w-[115px] bg-emerald-50/60 text-emerald-900 text-center">
                          산출 등급
                        </th>
                        <th className="py-2.5 px-2 min-w-[75px]">학교평균</th>
                        <th className="py-2.5 px-2 min-w-[75px]">표준편차</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-2 min-w-[78px] bg-indigo-50/50 text-indigo-900">
                          백분위(%)
                        </th>
                        <th className="py-2.5 px-2 min-w-[75px]">표준점수</th>
                        <th className="py-2.5 px-2 min-w-[115px] bg-emerald-50/60 text-emerald-900 text-center">
                          산출 등급
                        </th>
                      </>
                    )}
                    <th
                      className="py-2.5 px-2 min-w-[68px] text-slate-700"
                      title="계산/부호 실수 감점 점수"
                    >
                      계산실수(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] text-slate-700"
                      title="문제 조건 누락 감점 점수"
                    >
                      조건누락(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] text-slate-700"
                      title="서술형 감점 또는 시간부족 점수"
                    >
                      서술/시간(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] text-slate-700"
                      title="개념/공식 미숙 감점 점수"
                    >
                      개념미숙(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] text-slate-700"
                      title="유형/접근법 막힘 감점 점수"
                    >
                      유형막힘(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[68px] text-slate-700"
                      title="킬러(고난도) 한계 감점 점수"
                    >
                      킬러문항(-)
                    </th>
                    <th
                      className="py-2.5 px-2 min-w-[92px] text-center text-slate-700"
                      title="100점 - 원점수와 6대 오답 감점 합계의 일치 여부"
                    >
                      감점검증
                    </th>
                    <th className="py-2.5 px-2 min-w-[150px]">시험 한줄 코멘트</th>
                    <th className="py-2.5 px-2 min-w-[54px] text-center">비우기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {batchTargetStudents.map((st) => {
                    const row = batchRows[st.id] || { error_breakdown: {} };
                    const maxSysGrade =
                      batchMeta.exam_category === 'INTERNAL' && Number(row.grade_system) === 5
                        ? 5
                        : 9;
                    const autoGradeInfo = calculateAutoGrade(
                      { ...row, exam_category: batchMeta.exam_category },
                      maxSysGrade
                    );
                    const displayGrade =
                      autoGradeInfo.grade ?? (row.grade ? Number(row.grade) : null);
                    const hasAnyValue =
                      row.raw_score !== '' ||
                      row.rank !== '' ||
                      row.percentile !== '' ||
                      row.manual_grade !== '' ||
                      row.id;

                    const hasRawScore =
                      row.raw_score !== '' &&
                      row.raw_score !== null &&
                      row.raw_score !== undefined &&
                      !isNaN(Number(row.raw_score));
                    const expectedLost = hasRawScore
                      ? Math.max(0, Number((100 - Number(row.raw_score)).toFixed(1)))
                      : null;
                    const recordedErrorSum = Number(
                      ERROR_REASON_CATEGORIES.reduce(
                        (acc, cat) => acc + (Number(row.error_breakdown?.[cat.key]) || 0),
                        0
                      ).toFixed(1)
                    );
                    const errorDiff =
                      expectedLost !== null
                        ? Number((expectedLost - recordedErrorSum).toFixed(1))
                        : null;

                    return (
                      <tr
                        key={st.id}
                        className={`hover:bg-slate-50/80 ${
                          row.delete_row ? 'bg-rose-50/40 opacity-60' : ''
                        }`}
                      >
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
                            <td className="py-1.5 px-1.5 bg-emerald-50/30 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {displayGrade ? (
                                  <span
                                    className={`font-black px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap ${
                                      autoGradeInfo.isManualOverride
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-emerald-600 text-white'
                                    }`}
                                  >
                                    {displayGrade}등급
                                    {autoGradeInfo.topPct !== null
                                      ? ` (${autoGradeInfo.topPct}%)`
                                      : ''}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                    등수 입력 시 자동
                                  </span>
                                )}
                                <select
                                  value={row.manual_grade ?? ''}
                                  onChange={(e) =>
                                    handleBatchRowChange(st.id, 'manual_grade', e.target.value)
                                  }
                                  className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-600 w-full"
                                  title="동점자 예외 또는 등수 미발표 시 수동/예상 등급을 지정할 수 있습니다"
                                >
                                  <option value="">자동산출</option>
                                  {Array.from({ length: maxSysGrade }, (_, i) => i + 1).map(
                                    (g) => (
                                      <option key={g} value={g}>
                                        {g}등급 직접지정
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
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
                            <td className="py-1.5 px-1.5 bg-emerald-50/30 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {displayGrade ? (
                                  <span
                                    className={`font-black px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap ${
                                      autoGradeInfo.isManualOverride
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-emerald-600 text-white'
                                    }`}
                                  >
                                    {displayGrade}등급
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                    백분위 입력 시 자동
                                  </span>
                                )}
                                <select
                                  value={row.manual_grade ?? ''}
                                  onChange={(e) =>
                                    handleBatchRowChange(st.id, 'manual_grade', e.target.value)
                                  }
                                  className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-600 w-full"
                                  title="가채점 등급컷 등 백분위 없이 등급을 직접 지정할 때 사용합니다"
                                >
                                  <option value="">자동산출</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                                    <option key={g} value={g}>
                                      {g}등급 직접지정
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </>
                        )}

                        {/* 6대 오답 감점 점수 입력 */}
                        {ERROR_REASON_CATEGORIES.map((cat) => (
                          <td key={cat.key} className="py-1.5 px-1.5">
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

                        {/* 감점 합계 실시간 검증 배지 */}
                        <td className="py-1.5 px-1.5 text-center">
                          {expectedLost === null ? (
                            <span className="text-[10px] text-slate-300 font-semibold">-</span>
                          ) : recordedErrorSum === 0 && expectedLost > 0 ? (
                            <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                              감점 -{expectedLost}
                            </span>
                          ) : errorDiff === 0 ? (
                            <span className="inline-block text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap tabular-nums">
                              일치 (-{recordedErrorSum})
                            </span>
                          ) : errorDiff > 0 ? (
                            <span className="inline-block text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap tabular-nums">
                              미분류 {errorDiff}점
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap tabular-nums">
                              {Math.abs(errorDiff)}점 초과
                            </span>
                          )}
                        </td>

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

                        <td className="py-1.5 px-1.5 text-center">
                          {hasAnyValue && (
                            <button
                              type="button"
                              onClick={() => handleClearBatchRow(st.id)}
                              className="text-[11px] text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg font-extrabold whitespace-nowrap"
                              title="이 행의 입력값을 비우고 일괄 저장 시 기존 성적을 삭제합니다"
                            >
                              비우기
                            </button>
                          )}
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
            탭 4: 학생별 소속 고등학교 · 학년 · 등급제 일괄 설정
           ===================================================================== */}
        {mainTab === 'PROFILE_SETUP' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  학생별 소속 고등학교 · 학년 · 등급제 일괄 설정
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  학생을 한 명씩 클릭할 필요 없이, 반별로 학년과 내신 등급제를 일괄 적용하고 학교명과 목표 등급/점수를 빠르게 정리할 수 있습니다.
                </p>
              </div>

              <button
                onClick={handleSaveBulkProfiles}
                disabled={saving}
                className="text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl shadow-xs transition shrink-0 whitespace-nowrap"
              >
                {saving ? '일괄 저장 중...' : '전체 학생 학교·학년 설정 저장'}
              </button>
            </div>

            {/* 상단 필터 및 1클릭 일괄 채우기 도구 바 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 items-end">
              <div className="lg:col-span-3">
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  대상 반 선택 ({bulkProfileTargetStudents.length}명 표시 중)
                </label>
                <select
                  value={bulkProfileClassFilter}
                  onChange={(e) => setBulkProfileClassFilter(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800"
                >
                  <option value="ALL">전체 학생 ({students.length}명)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-[11px] font-extrabold text-slate-500 mb-1">
                  학생/학교 검색
                </label>
                <input
                  type="text"
                  placeholder="이름 또는 학교..."
                  value={bulkProfileSearch}
                  onChange={(e) => setBulkProfileSearch(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="lg:col-span-7 bg-indigo-50/70 border border-indigo-200/80 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-indigo-950 whitespace-nowrap">
                    현재 목록({bulkProfileTargetStudents.length}명) 일괄 채우기:
                  </span>
                  <input
                    type="text"
                    list="known-schools-datalist"
                    placeholder="학교명 (선택)"
                    value={bulkApplySchool}
                    onChange={(e) => setBulkApplySchool(e.target.value)}
                    className="text-xs bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 font-bold w-32"
                  />
                  <select
                    value={bulkApplyGrade}
                    onChange={(e) => setBulkApplyGrade(Number(e.target.value))}
                    className="text-xs bg-white border border-indigo-200 rounded-lg px-2 py-1.5 font-black text-slate-800"
                  >
                    {HIGH_SCHOOL_GRADES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={bulkApplySystem}
                    onChange={(e) => setBulkApplySystem(Number(e.target.value))}
                    className="text-xs bg-white border border-indigo-200 rounded-lg px-2 py-1.5 font-black text-slate-800"
                  >
                    <option value={5}>5등급제 (2028 개편)</option>
                    <option value={9}>9등급제 (기존)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyBulkProfileToVisible(false)}
                    className="text-xs bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-extrabold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                  >
                    학년·등급제만 일괄 적용
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyBulkProfileToVisible(true)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                  >
                    학교·학년·등급제 모두 적용
                  </button>
                </div>
              </div>
            </div>

            {/* 학생 프로필 일괄 편집 테이블 */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 whitespace-nowrap">
                    <th className="py-2.5 px-3">학생명</th>
                    <th className="py-2.5 px-3">소속 반</th>
                    <th className="py-2.5 px-3 min-w-[170px]">소속 고등학교명</th>
                    <th className="py-2.5 px-3 min-w-[115px]">현재 학년</th>
                    <th className="py-2.5 px-3 min-w-[155px]">내신 등급 산출 체계</th>
                    <th className="py-2.5 px-3 min-w-[110px]">목표 등급</th>
                    <th className="py-2.5 px-3 min-w-[95px]">목표 원점수</th>
                    <th className="py-2.5 px-3 text-center">누적 성적 기록</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 font-semibold">
                  {bulkProfileTargetStudents.map((st) => {
                    const row = bulkProfileRows[st.id] || {
                      school_name: '',
                      school_grade: 1,
                      grade_system: 9,
                      target_grade: '',
                      target_score: '',
                    };
                    const stClasses = (studentClassNamesMap[st.id] || []).join(', ') || '-';
                    const stExamCount = scores.filter((sc) => sc.student_id === st.id).length;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-black text-slate-900 text-sm whitespace-nowrap">
                          {st.name}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{stClasses}</td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            list="known-schools-datalist"
                            placeholder="예: 숙명여고, 단대부고..."
                            value={row.school_name ?? ''}
                            onChange={(e) =>
                              setBulkProfileRows((prev) => ({
                                ...prev,
                                [st.id]: { ...row, school_name: e.target.value },
                              }))
                            }
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-indigo-500"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            value={row.school_grade || 1}
                            onChange={(e) => {
                              const g = Number(e.target.value);
                              setBulkProfileRows((prev) => ({
                                ...prev,
                                [st.id]: {
                                  ...row,
                                  school_grade: g,
                                  // 고1로 바꾸면 기본 5등급제 추천, 고3은 9등급제 추천
                                  grade_system: g === 1 ? 5 : row.grade_system || 9,
                                },
                              }));
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-black text-slate-800"
                          >
                            {HIGH_SCHOOL_GRADES.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            value={row.grade_system || 9}
                            onChange={(e) =>
                              setBulkProfileRows((prev) => ({
                                ...prev,
                                [st.id]: { ...row, grade_system: Number(e.target.value) },
                              }))
                            }
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-black text-slate-800"
                          >
                            <option value={5}>내신 5등급제 (1등급 10%)</option>
                            <option value={9}>내신 9등급제 (1등급 4%)</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            value={row.target_grade ?? ''}
                            onChange={(e) =>
                              setBulkProfileRows((prev) => ({
                                ...prev,
                                [st.id]: { ...row, target_grade: e.target.value },
                              }))
                            }
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                          >
                            <option value="">미지정</option>
                            {Array.from(
                              { length: Number(row.grade_system) === 5 ? 5 : 9 },
                              (_, i) => i + 1
                            ).map((g) => (
                              <option key={g} value={g}>
                                {g}등급 목표
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="예: 90"
                            value={row.target_score ?? ''}
                            onChange={(e) =>
                              setBulkProfileRows((prev) => ({
                                ...prev,
                                [st.id]: { ...row, target_score: e.target.value },
                              }))
                            }
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 text-right tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500 whitespace-nowrap">
                          {stExamCount > 0 ? `${stExamCount}건` : '미입력'}
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
            탭 3: 학교별 내신 난이도 히스토리 DB
           ===================================================================== */}
        {mainTab === 'SCHOOL_STATS' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                학교별 수학 내신 시험 난이도 및 학원 성과 비교
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
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold whitespace-nowrap">
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
                      <tr key={item.key} className="hover:bg-slate-50 whitespace-nowrap">
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
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
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
                  {examForm.id ? '시험 성적 및 오답 원인 수정' : '새 시험 성적 등록'}
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
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

            <form onSubmit={handleSaveSingleScore} className="space-y-5 mt-4">
              {/* 1. 시험 기본 분류 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                    시행 연도
                  </label>
                  <input
                    type="number"
                    value={examForm.exam_year}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, exam_year: Number(e.target.value) || 2026 }))
                    }
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                    시험 당시 학년
                  </label>
                  <select
                    value={examForm.school_grade}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, school_grade: Number(e.target.value) }))
                    }
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  >
                    {HIGH_SCHOOL_GRADES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
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
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  >
                    {EXAM_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                    세부 시기
                  </label>
                  <select
                    value={examForm.exam_period}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, exam_period: e.target.value }))
                    }
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
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
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                    수학 과목명
                  </label>
                  <input
                    type="text"
                    list="math-subjects-list"
                    value={examForm.subject}
                    onChange={(e) => setExamForm((p) => ({ ...p, subject: e.target.value }))}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                    placeholder="예: 공통수학1, 대수, 미적분..."
                  />
                </div>
              </div>

              {/* 같은 학교 기존 평균/표준편차 자동 불러오기 알림 */}
              {matchedSchoolStatsForModal && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-indigo-900">
                    <strong>{profileSchoolName}</strong>의 동일 시험 통계(평균{' '}
                    {matchedSchoolStatsForModal.school_mean ?? '-'} / 편차{' '}
                    {matchedSchoolStatsForModal.school_std_dev ?? '-'})가 등록되어 있습니다.
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
                    className="bg-indigo-600 text-white font-extrabold px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap"
                  >
                    자동 채우기
                  </button>
                </div>
              )}

              {/* 학기 최종(합산) 선택 시 중간·기말 성적 자동 합산 불러오기 배너 */}
              {matchedSemesterMidFinalForModal && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-black text-violet-950">
                      같은 학기 중간·기말고사 기록이 확인되었습니다.
                    </p>
                    <p className="text-[11px] font-bold text-violet-700 mt-0.5">
                      {matchedSemesterMidFinalForModal.mid
                        ? `중간 ${matchedSemesterMidFinalForModal.mid.raw_score ?? '-'}점`
                        : '중간 미입력'}{' '}
                      ·{' '}
                      {matchedSemesterMidFinalForModal.fin
                        ? `기말 ${matchedSemesterMidFinalForModal.fin.raw_score ?? '-'}점`
                        : '기말 미입력'}{' '}
                      → 평균{' '}
                      <strong className="underline">
                        {matchedSemesterMidFinalForModal.avgScore ?? '-'}점
                      </strong>{' '}
                      및 오답 감점 합산 불러오기 가능
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExamForm((p) => ({
                        ...p,
                        raw_score:
                          matchedSemesterMidFinalForModal.avgScore ?? p.raw_score,
                        school_mean:
                          matchedSemesterMidFinalForModal.avgMean ?? p.school_mean,
                        school_std_dev:
                          matchedSemesterMidFinalForModal.avgStd ?? p.school_std_dev,
                        total_students:
                          matchedSemesterMidFinalForModal.totalStudents ?? p.total_students,
                        error_breakdown:
                          matchedSemesterMidFinalForModal.combinedBreakdown ||
                          p.error_breakdown,
                      }))
                    }
                    className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap"
                  >
                    중간+기말 합산 채우기
                  </button>
                </div>
              )}

              {/* 2. 점수 · 석차 · 자동 등급 · 표준편차 */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-900">
                    성적 지표 입력
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    시험 직후에는 <strong>원점수와 오답 원인만 먼저 저장</strong>하고, 성적표 배부 후 석차·편차를 추가 입력할 수 있습니다
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
                    <div className="space-y-3">
                      {examForm.exam_category === 'INTERNAL' ? (
                        <>
                          {/* 1행: 성적 지표 3칸 (원점수만 우선 입력해도 저장 가능) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 whitespace-nowrap">
                                원점수 (100점 만점) <span className="text-indigo-600">*</span>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="예: 86.5"
                                value={examForm.raw_score}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, raw_score: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl px-3.5 py-2.5 font-black text-slate-900 focus:outline-hidden tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 whitespace-nowrap">
                                전교 석차{' '}
                                <span className="text-[10px] font-semibold text-slate-400">
                                  (성적표 배부 후)
                                </span>
                              </label>
                              <input
                                type="number"
                                placeholder="예: 14"
                                value={examForm.rank}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, rank: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl px-3.5 py-2.5 font-black text-slate-900 focus:outline-hidden tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 whitespace-nowrap">
                                수강자 수{' '}
                                <span className="text-[10px] font-semibold text-slate-400">
                                  (성적표 배부 후)
                                </span>
                              </label>
                              <input
                                type="number"
                                placeholder="예: 260"
                                value={examForm.total_students}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, total_students: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl px-3.5 py-2.5 font-black text-slate-900 focus:outline-hidden tabular-nums"
                              />
                            </div>
                          </div>

                          {/* 2행: 학교 평균 및 표준편차 2칸 (동일한 높이·디자인) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                학교 과목 평균 (선택)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="예: 54.2"
                                value={examForm.school_mean}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, school_mean: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 font-bold text-slate-800 focus:outline-hidden tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                학교 표준편차 (선택)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="예: 18.5"
                                value={examForm.school_std_dev}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, school_std_dev: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 font-bold text-slate-800 focus:outline-hidden tabular-nums"
                              />
                            </div>
                          </div>

                          {/* 3행: 산출 등급 전체 너비 가로 바 (글자 세로 깨짐 방지) */}
                          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">
                                산출 등급 ({profileGradeSystem}등급제)
                              </span>
                              {displayModalGrade ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-lg whitespace-nowrap">
                                    {displayModalGrade}등급
                                  </span>
                                  {modalAutoGrade.topPct !== null && (
                                    <span className="text-xs font-extrabold text-slate-600 whitespace-nowrap">
                                      상위 {modalAutoGrade.topPct}%
                                      {modalAutoGrade.source === 'Z_SCORE' ? ' (평균·편차 추정)' : ''}
                                    </span>
                                  )}
                                  {modalAutoGrade.isManualOverride && (
                                    <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                      직접 지정됨
                                      {modalAutoGrade.autoGrade
                                        ? ` (석차 기준 ${modalAutoGrade.autoGrade}등급)`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">
                                  등수와 수강자 수를 입력하면 등급이 자동 산출됩니다
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                                등급 보정:
                              </span>
                              <select
                                value={examForm.manual_grade ?? ''}
                                onChange={(e) =>
                                  setExamForm((p) => ({
                                    ...p,
                                    manual_grade: e.target.value,
                                  }))
                                }
                                title="동점자 중간석차로 실제 성적표 등급이 다르거나 등수 미발표 시 직접 지정"
                                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-extrabold text-slate-700 focus:border-indigo-500 focus:outline-hidden"
                              >
                                <option value="">석차 기준 자동 산출 (기본)</option>
                                {(profileGradeSystem === 5
                                  ? [1, 2, 3, 4, 5]
                                  : [1, 2, 3, 4, 5, 6, 7, 8, 9]
                                ).map((g) => (
                                  <option key={g} value={g}>
                                    {g}등급 직접 지정 (동점자·예외)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 whitespace-nowrap">
                                원점수 (100점 만점) <span className="text-indigo-600">*</span>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="예: 88"
                                value={examForm.raw_score}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, raw_score: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl px-3.5 py-2.5 font-black text-slate-900 focus:outline-hidden tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 whitespace-nowrap">
                                백분위 (%){' '}
                                <span className="text-[10px] font-semibold text-slate-400">
                                  (성적표 배부 후)
                                </span>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="예: 94"
                                value={examForm.percentile}
                                onChange={(e) =>
                                  setExamForm((p) => ({ ...p, percentile: e.target.value }))
                                }
                                className="w-full text-sm bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl px-3.5 py-2.5 font-black text-slate-900 focus:outline-hidden tabular-nums"
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
                                className="w-full text-sm bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-hidden tabular-nums"
                              />
                            </div>
                          </div>

                          {/* 모의고사 산출 등급 전체 너비 가로 바 */}
                          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">
                                모의고사 산출 등급 (9등급제)
                              </span>
                              {displayModalGrade ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-lg whitespace-nowrap">
                                    {displayModalGrade}등급
                                  </span>
                                  {modalAutoGrade.topPct !== null && (
                                    <span className="text-xs font-extrabold text-slate-600 whitespace-nowrap">
                                      상위 {modalAutoGrade.topPct}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">
                                  백분위(%)를 입력하면 등급이 자동 산출됩니다
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                                등급 보정:
                              </span>
                              <select
                                value={examForm.manual_grade ?? ''}
                                onChange={(e) =>
                                  setExamForm((p) => ({
                                    ...p,
                                    manual_grade: e.target.value,
                                  }))
                                }
                                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-extrabold text-slate-700 focus:border-indigo-500 focus:outline-hidden"
                              >
                                <option value="">백분위 기준 자동 산출 (기본)</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                                  <option key={g} value={g}>
                                    {g}등급 직접 지정 (성적표·가채점 기준)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 3. 6대 오답 원인(감점 요인) 상세 점수 입력 + 총 감점 대비 자동 검증 바 */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-900">
                    오답 원인별 감점 점수 (선택 입력)
                  </h4>
                  {(() => {
                    const rawVal = Number(examForm.raw_score);
                    if (
                      examForm.raw_score === '' ||
                      examForm.raw_score === null ||
                      isNaN(rawVal)
                    ) {
                      return null;
                    }
                    const totalLost = Math.max(0, Number((100 - rawVal).toFixed(1)));
                    const recordedSum = Number(
                      ERROR_REASON_CATEGORIES.reduce(
                        (acc, cat) =>
                          acc + (Number(examForm.error_breakdown?.[cat.key]) || 0),
                        0
                      ).toFixed(1)
                    );
                    const diff = Number((totalLost - recordedSum).toFixed(1));

                    return (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-extrabold border ${
                            diff === 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : diff > 0
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          총 감점 <strong>-{totalLost}점</strong> 중 현재{' '}
                          <strong>-{recordedSum}점</strong> 분류됨{' '}
                          {diff === 0
                            ? '(일치)'
                            : diff > 0
                            ? `(미분류 ${diff}점)`
                            : `(${Math.abs(diff)}점 초과)`}
                        </span>
                        {diff > 0 && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExamForm((p) => ({
                                  ...p,
                                  error_breakdown: {
                                    ...(p.error_breakdown || {}),
                                    skill_approach: Number(
                                      (
                                        (Number(p.error_breakdown?.skill_approach) || 0) +
                                        diff
                                      ).toFixed(1)
                                    ),
                                  },
                                }))
                              }
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap"
                            >
                              +남은 {diff}점 → 유형막힘
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExamForm((p) => ({
                                  ...p,
                                  error_breakdown: {
                                    ...(p.error_breakdown || {}),
                                    skill_killer: Number(
                                      (
                                        (Number(p.error_breakdown?.skill_killer) ||
                                          0) + diff
                                      ).toFixed(1)
                                    ),
                                  },
                                }))
                              }
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap"
                            >
                              +남은 {diff}점 → 킬러문항
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExamForm((p) => ({
                                  ...p,
                                  error_breakdown: {
                                    ...(p.error_breakdown || {}),
                                    skill_concept: Number(
                                      (
                                        (Number(p.error_breakdown?.skill_concept) || 0) +
                                        diff
                                      ).toFixed(1)
                                    ),
                                  },
                                }))
                              }
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap"
                            >
                              +남은 {diff}점 → 개념미숙
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ERROR_REASON_CATEGORIES.map((cat) => (
                    <div
                      key={cat.key}
                      className="p-3 rounded-xl border bg-slate-50/80 border-slate-200/90"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <label className="text-[11px] font-extrabold text-slate-800 whitespace-nowrap">
                          {cat.label}
                        </label>
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                          {cat.recoverable ? '풀이습관' : '개념·심화'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400">-</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="0"
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
                          className="w-full text-xs bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 font-black text-right text-slate-900 focus:outline-hidden tabular-nums"
                        />
                        <span className="text-xs font-bold text-slate-500 shrink-0">점</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. 시험 총평 코멘트 */}
              <div>
                <label className="block text-xs font-black text-slate-900 mb-1.5">
                  시험 총평 및 학습 처방 메모 (선택)
                </label>
                <textarea
                  rows={2}
                  placeholder="예: 개념 이해도는 높으나 서술형 마지막 문항에서 부호 실수로 5점 감점됨. 기말 대비 검산 루틴 훈련 예정."
                  value={examForm.memo}
                  onChange={(e) => setExamForm((p) => ({ ...p, memo: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 font-semibold text-slate-800 focus:outline-hidden"
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
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl shadow-xs"
                >
                  {saving ? '저장 중...' : '성적 및 분석 저장'}
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
 * 시간순 성적 추이 SVG 차트 컴포넌트
 * - 원점수 + 학교평균
 * - 등급 추이 (1등급이 상단에 오도록 반전 Y축)
 * - 상위 누적 백분율(%) 추이
 * - 학생별 개인화 목표 점수(targetScore) / 목표 등급(targetGrade) 기준선 지원
 */
function ScoreTimelineChart({
  exams = [],
  metricMode = 'SCORE',
  gradeSystem = 9,
  targetGrade = null,
  targetScore = null,
  selectedExamId,
  onSelectExam,
}) {
  if (!exams || exams.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-400">
        선택한 필터 조건에 해당하는 시험 기록이 없습니다.
      </div>
    );
  }

  const width = 860;
  const height = 284;
  const padLeft = 64;
  const padRight = 56;
  const padTop = 36;
  const padBottom = 58;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const bottomY = padTop + plotH;

  // 첫 번째·마지막 포인트가 좌우 Y축 눈금 글씨와 겹치지 않도록 안쪽 여백 확보
  const innerInsetX = 48;
  const usableW = Math.max(100, plotW - innerInsetX * 2);

  const getX = (idx) => {
    if (exams.length === 1) return padLeft + plotW / 2;
    return padLeft + innerInsetX + (idx / (exams.length - 1)) * usableW;
  };

  const getYForScore = (val) => {
    const clamped = Math.max(0, Math.min(100, Number(val) || 0));
    return padTop + plotH - (clamped / 100) * plotH;
  };

  const getYForGrade = (gradeVal) => {
    const maxG = Number(gradeSystem) === 5 ? 5 : 9;
    const g = Math.max(1, Math.min(maxG, Number(gradeVal) || 3));
    return padTop + ((g - 1) / (maxG - 1)) * plotH;
  };

  const getYForTopPercent = (pctVal) => {
    const p = Math.max(0.1, Math.min(100, Number(pctVal) || 50));
    return padTop + (p / 100) * plotH;
  };

  // 데이터 포인트 생성 (잠재점수 제거, 실제 성취 지표만 표시)
  const points = exams.map((exam, idx) => {
    const x = getX(idx);
    const pos = analyzeGradePosition(exam, gradeSystem);

    let primaryY = null;
    let primaryLabel = '';
    let meanY = null;

    if (metricMode === 'SCORE') {
      if (exam.raw_score !== null && !isNaN(Number(exam.raw_score))) {
        primaryY = getYForScore(exam.raw_score);
        primaryLabel = `${exam.raw_score}점`;
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
      meanY,
    };
  });

  // 부드러운 곡선(Cubic Bezier) 경로 생성기
  const buildSmoothPath = (pts, key) => {
    const valid = pts.filter((p) => p[key] !== null && p[key] !== undefined);
    if (valid.length < 2) return '';
    return valid.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x.toFixed(1)} ${pt[key].toFixed(1)}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) * 0.38;
      const cy1 = prev[key];
      const cx2 = pt.x - (pt.x - prev.x) * 0.38;
      const cy2 = pt[key];
      return `${acc} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${pt.x.toFixed(1)} ${pt[key].toFixed(1)}`;
    }, '');
  };

  // 그라데이션 영역 채우기(Area Fill) 경로 생성기
  const buildAreaPath = (pts, key) => {
    const valid = pts.filter((p) => p[key] !== null && p[key] !== undefined);
    if (valid.length < 2) return '';
    const lineD = buildSmoothPath(pts, key);
    const first = valid[0];
    const last = valid[valid.length - 1];
    return `${lineD} L ${last.x.toFixed(1)} ${bottomY.toFixed(1)} L ${first.x.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  };

  const internalPoints = points.filter((p) => p.exam.exam_category === 'INTERNAL');
  const mockPoints = points.filter((p) => p.exam.exam_category === 'MOCK');

  const internalPath = buildSmoothPath(internalPoints, 'primaryY');
  const internalAreaPath = buildAreaPath(internalPoints, 'primaryY');
  const mockPath = buildSmoothPath(mockPoints, 'primaryY');
  const mockAreaPath = buildAreaPath(mockPoints, 'primaryY');
  const meanPath = buildSmoothPath(internalPoints, 'meanY');

  // 배경 가로 가이드라인
  const gridLines =
    metricMode === 'SCORE'
      ? [100, 90, 80, 60, 40].map((v) => ({ y: getYForScore(v), label: `${v}점` }))
      : metricMode === 'GRADE'
      ? (Number(gradeSystem) === 5 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 7, 9]).map((g) => ({
          y: getYForGrade(g),
          label: `${g}등급`,
        }))
      : [4, 11, 23, 40, 60, 85].map((pct) => ({
          y: getYForTopPercent(pct),
          label: `상위 ${pct}%`,
        }));

  // 학생 개인 맞춤 목표선 또는 기본 목표 구간(Target Zone) 계산
  const effectiveTargetScore =
    targetScore && !isNaN(Number(targetScore)) ? Number(targetScore) : 88;
  const effectiveTargetGrade =
    targetGrade && !isNaN(Number(targetGrade)) ? Number(targetGrade) : 2;
  const hasCustomTarget =
    (metricMode === 'SCORE' && targetScore && !isNaN(Number(targetScore))) ||
    (metricMode === 'GRADE' && targetGrade && !isNaN(Number(targetGrade)));

  const targetZoneBottomY =
    metricMode === 'SCORE'
      ? getYForScore(effectiveTargetScore)
      : metricMode === 'GRADE'
      ? getYForGrade(effectiveTargetGrade)
      : getYForTopPercent(gradeSystem === 5 ? 10 : 11);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[580px] h-auto select-none bg-gradient-to-b from-slate-50/70 to-white rounded-2xl border border-slate-200/90"
      >
        <defs>
          <linearGradient id="internalAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.16" />
            <stop offset="85%" stopColor="#4f46e5" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="mockAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.14" />
            <stop offset="85%" stopColor="#d97706" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="topZoneGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#eef2ff" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        {/* 목표 구간 배경 존 */}
        <rect
          x={padLeft}
          y={padTop}
          width={plotW}
          height={Math.max(0, targetZoneBottomY - padTop)}
          fill="url(#topZoneGrad)"
          rx="6"
        />
        {hasCustomTarget && (
          <line
            x1={padLeft}
            y1={targetZoneBottomY}
            x2={width - padRight}
            y2={targetZoneBottomY}
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )}
        <text
          x={width - padRight - 10}
          y={padTop + 14}
          textAnchor="end"
          className="fill-indigo-600/85 text-[10px] font-bold"
        >
          {metricMode === 'SCORE'
            ? targetScore
              ? `학생 목표 기준선 (${effectiveTargetScore}점 이상)`
              : '최상위권 목표 구간 (88점 이상)'
            : metricMode === 'GRADE'
            ? targetGrade
              ? `학생 목표 등급 (${effectiveTargetGrade}등급 이내)`
              : '1~2등급 목표 구간'
            : `상위 ${gradeSystem === 5 ? '10%' : '11%'} 이내 목표 구간`}
        </text>

        {/* 가로 가이드선 */}
        {gridLines.map((gl, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={gl.y}
              x2={width - padRight}
              y2={gl.y}
              stroke="#e2e8f0"
              strokeDasharray={idx === 0 ? '0' : '4 4'}
              strokeWidth="1"
            />
            <text
              x={padLeft - 12}
              y={gl.y + 3.5}
              textAnchor="end"
              className="fill-slate-400 text-[10px] font-extrabold tabular-nums"
            >
              {gl.label}
            </text>
          </g>
        ))}

        {/* 내신 그라데이션 영역 채우기 */}
        {internalAreaPath && (
          <path d={internalAreaPath} fill="url(#internalAreaGrad)" />
        )}

        {/* 모의고사 그라데이션 영역 채우기 */}
        {mockAreaPath && <path d={mockAreaPath} fill="url(#mockAreaGrad)" />}

        {/* 학교 평균선 (원점수 모드 · 내신 시험끼리 연결) */}
        {metricMode === 'SCORE' && meanPath && (
          <path
            d={meanPath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}

        {/* 내신(INTERNAL) 실선 */}
        {internalPath && (
          <path
            d={internalPath}
            fill="none"
            stroke={metricMode === 'PERCENT' ? '#7c3aed' : '#4f46e5'}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* 모의고사(MOCK) 실선 (내신과 분리된 별도 라인) */}
        {mockPath && (
          <path
            d={mockPath}
            fill="none"
            stroke="#d97706"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* 각 시험 포인트 및 데이터 라벨 */}
        {points.map((pt) => {
          const isSelected = pt.exam.id === selectedExamId;
          const isMock = pt.exam.exam_category === 'MOCK';
          const pointColor = isMock
            ? '#d97706'
            : metricMode === 'PERCENT'
            ? '#7c3aed'
            : '#4f46e5';

          return (
            <g
              key={pt.exam.id}
              onClick={() => onSelectExam && onSelectExam(pt.exam.id)}
              className="cursor-pointer"
            >
              {/* 선택된 시험 세로 가이드 하이라이트 */}
              {isSelected && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={bottomY}
                  stroke={isMock ? '#d97706' : '#4f46e5'}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* 학교 평균 점 */}
              {metricMode === 'SCORE' && pt.meanY !== null && (
                <circle
                  cx={pt.x}
                  cy={pt.meanY}
                  r="3.5"
                  fill="#94a3b8"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
              )}

              {/* 메인 데이터 포인트 + 알약형 배경 라벨 */}
              {pt.primaryY !== null && (
                <g>
                  {isSelected && (
                    <circle
                      cx={pt.x}
                      cy={pt.primaryY}
                      r="11"
                      fill={pointColor}
                      fillOpacity="0.15"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.primaryY}
                    r={isSelected ? '6' : '4.8'}
                    fill={pointColor}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <rect
                    x={pt.x - 24}
                    y={pt.primaryY - 26}
                    width="48"
                    height="17"
                    rx="5"
                    fill="#ffffff"
                    fillOpacity="0.92"
                    stroke={isSelected ? pointColor : '#e2e8f0'}
                    strokeWidth="1"
                  />
                  <text
                    x={pt.x}
                    y={pt.primaryY - 14}
                    textAnchor="middle"
                    className={`text-[10px] font-black tabular-nums ${
                      isSelected
                        ? isMock
                          ? 'fill-amber-800'
                          : 'fill-indigo-900'
                        : 'fill-slate-800'
                    }`}
                  >
                    {pt.primaryLabel}
                  </text>
                </g>
              )}

              {/* X축 시험 라벨 */}
              <text
                x={pt.x}
                y={bottomY + 20}
                textAnchor="middle"
                className={`text-[10px] ${
                  isSelected
                    ? isMock
                      ? 'fill-amber-700 font-black'
                      : 'fill-indigo-700 font-black'
                    : 'fill-slate-700 font-bold'
                }`}
              >
                {formatExamShortLabel(pt.exam)}
              </text>
              <text
                x={pt.x}
                y={bottomY + 35}
                textAnchor="middle"
                className="fill-slate-400 text-[9px] font-bold"
              >
                {pt.exam.subject?.slice(0, 7)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
