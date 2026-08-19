'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TeacherEvalPage() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 6가지 평가 점수 상태 (기본값 설정)
  const [scoreTardiness, setScoreTardiness] = useState(10);
  const [scoreHomework, setScoreHomework] = useState(8);
  const [scoreFocus, setScoreFocus] = useState(8);
  const [scoreConcept, setScoreConcept] = useState(8);
  const [scoreDifficulty, setScoreDifficulty] = useState(5);
  const [scoreTest, setScoreTest] = useState(8);
  const [comment, setComment] = useState('');

  const [loading, setLoading] = useState(false);
  const [teacher, setTeacher] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const user = JSON.parse(userData);
    setTeacher(user);
    fetchStudents();
  }, []);

  // 학생 목록 가져오기
  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'STUDENT');

      if (error) throw error;
      setStudents(data || []);
      if (data && data.length > 0) {
        setSelectedStudent(data[0].id);
      }
    } catch (err) {
      console.error('학생 목록 로드 실패:', err);
    }
  };

  // 평가 저장 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('학생을 선택해 주세요.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('daily_evaluations').insert([
        {
          student_id: selectedStudent,
          teacher_id: teacher?.id,
          eval_date: evalDate,
          score_tardiness: Number(scoreTardiness),
          score_homework: Number(scoreHomework),
          score_focus: Number(scoreFocus),
          score_concept: Number(scoreConcept),
          score_difficulty: Number(scoreDifficulty),
          score_test: Number(scoreTest),
          comment: comment,
        },
      ]);

      if (error) throw error;

      alert('당일 수업 피드백이 성공적으로 등록되었습니다!');
      setComment('');
    } catch (err) {
      console.error(err);
      alert('평가 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex justify-between items-center">
        <h1 
          onClick={() => router.push('/')}
          className="text-xl font-bold text-blue-600 cursor-pointer"
        >
          품수학 일일 학습 피드백 작성
        </h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:underline"
        >
          ← 뒤로가기
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          
          {/* 학생 및 날짜 선택 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">학생 선택</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-blue-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} 학생
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">수업 일자</label>
              <input
                type="date"
                value={evalDate}
                onChange={(e) => setEvalDate(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-blue-500"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 6개 항목 평가 슬라이더 */}
          <div className="space-y-5">
            <h3 className="font-bold text-gray-800 text-base">📊 수업 성취도 평가 (1~10점)</h3>

            {/* 1. 지각 여부 */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>1. 출석 및 지각</span>
                <span className="text-blue-600 font-bold">{scoreTardiness}점</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={scoreTardiness}
                onChange={(e) => setScoreTardiness(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* 2. 숙제 완성도 */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>2. 숙제 완성도</span>
                <span className="text-blue-600 font-bold">{scoreHomework}점</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={scoreHomework}
                onChange={(e) => setScoreHomework(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* 3. 수업 몰입도 */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>3. 수업 몰입도</span>
                <span className="text-blue-600 font-bold">{scoreFocus}점</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={scoreFocus}
                onChange={(e) => setScoreFocus(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* 4. 개념 이해도 */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>4. 개념 이해도</span>
                <span className="text-blue-600 font-bold">{scoreConcept}점</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={scoreConcept}
                onChange={(e) => setScoreConcept(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* 5. 수업 난이도 */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>5. 체감 수업 난이도</span>
                <span className="text-blue-600 font-bold">{scoreDifficulty}점</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={scoreDifficulty}
                onChange={(e) => setScoreDifficulty(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* 6. 테스트 점수 */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>6. 테스트 점수</span>
                <span className="text-blue-600 font-bold">{scoreTest}점</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={scoreTest}
                onChange={(e) => setScoreTest(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* 선생님 한 줄 총평 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">💬 선생님 한 줄 피드백</label>
            <textarea
              placeholder="오늘 수업에서 잘한 점이나 보완할 점을 적어주세요."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 border rounded-xl text-sm h-24 focus:outline-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-blue-700 transition"
          >
            {loading ? '등록 중...' : '피드백 등록 및 리포트 생성'}
          </button>

        </form>
      </main>
    </div>
  );
}