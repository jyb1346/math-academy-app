'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function QnaPage() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'PENDING' | 'ANSWERED'

  // 학생: 질문 작성 폼 상태
  const [title, setTitle] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [filePreviews, setFilePreviews] = useState([]); // string[] (object URLs)
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // 선생님: 답변 작성/수정 상태 (qnaId -> { text, files, filePreviews, isEditing, submitting })
  const [answerState, setAnswerState] = useState({});

  // 🔍 사진 확대 뷰어 모달
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchQuestions(parsedUser);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const fetchQuestions = async (currentUser) => {
    try {
      setLoading(true);
      let query = supabase.from('qna').select('*, users!qna_student_id_fkey(name), teacher:users!qna_teacher_id_fkey(name)');

      if (currentUser.role === 'STUDENT') {
        query = query.eq('student_id', currentUser.id);
      } else {
        query = query.eq('teacher_id', currentUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('QnA join fetch failed, trying fallback select:', error);
        let fbQuery = supabase.from('qna').select('*');
        if (currentUser.role === 'STUDENT') {
          fbQuery = fbQuery.eq('student_id', currentUser.id);
        } else {
          fbQuery = fbQuery.eq('teacher_id', currentUser.id);
        }
        const { data: fbData } = await fbQuery.order('created_at', { ascending: false });
        setQuestions(fbData || []);
      } else {
        setQuestions(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 학생: 파일 선택 시 미리보기 생성
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // 파일들 업로드 헬퍼 함수
  const uploadFilesToStorage = async (files) => {
    const uploadedUrls = [];
    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `qna_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `qna_files/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
        }
      } catch (err) {
        console.warn('Storage upload error:', err);
      }
    }
    return uploadedUrls;
  };

  // 🎯 학생: 1:1 질문 등록 (담당 선생님 자동 매칭)
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('질문 제목을 입력해 주세요.');
    if (!questionText.trim()) return alert('질문 내용을 입력해 주세요.');

    setSubmittingQuestion(true);

    try {
      // 1. 학생의 담당 선생님(teacher_id) 자동 조회
      const { data: studentInfo } = await supabase
        .from('users')
        .select('teacher_id')
        .eq('id', user.id)
        .maybeSingle();

      const assignedTeacherId = studentInfo?.teacher_id || null;

      // 2. 다중 사진 업로드
      const imageUrls = await uploadFilesToStorage(selectedFiles);

      // 3. QnA 레코드 삽입
      const payload = {
        student_id: user.id,
        teacher_id: assignedTeacherId,
        title: title.trim(),
        question: questionText.trim(),
        question_image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        status: 'PENDING',
      };

      const { error } = await supabase.from('qna').insert([payload]);
      if (error) throw error;

      // 🔔 담당 선생님께 1:1 질문 푸시 알림
      if (assignedTeacherId) {
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [assignedTeacherId],
              title: `[1:1 질문] ${user.name} 학생의 새 질문`,
              message: title.trim(),
              url: '/qna',
            }),
          }).catch((e) => console.warn('QnA push warning:', e));
        } catch (e) {
          console.warn('Push error:', e);
        }
      }

      alert('질문이 담당 선생님께 성공적으로 전달되었습니다!');
      setTitle('');
      setQuestionText('');
      setSelectedFiles([]);
      setFilePreviews([]);
      fetchQuestions(user);
    } catch (err) {
      console.error(err);
      alert('질문 등록 실패: ' + err.message);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // 학생: 질문 삭제 (대기 중인 경우에만)
  const handleDeleteQuestion = async (id, qTitle) => {
    if (!confirm(`[${qTitle}] 질문을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('qna').delete().eq('id', id);
      if (error) throw error;
      fetchQuestions(user);
      alert('삭제되었습니다.');
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  // 🎯 선생님: 답변 등록 / 수정
  const handleSubmitAnswer = async (qnaItem) => {
    const state = answerState[qnaItem.id] || {};
    const text = state.text !== undefined ? state.text : (qnaItem.answer || '');

    if (!text.trim()) return alert('답변 내용을 입력해 주세요.');

    setAnswerState((prev) => ({
      ...prev,
      [qnaItem.id]: { ...(prev[qnaItem.id] || {}), submitting: true },
    }));

    try {
      // 신규 추가된 파일들 업로드
      const newFiles = state.files || [];
      const newUrls = await uploadFilesToStorage(newFiles);

      // 기존 이미지 URL 파싱
      let existingUrls = [];
      if (qnaItem.answer_image_url) {
        try {
          existingUrls = JSON.parse(qnaItem.answer_image_url);
        } catch {
          existingUrls = [qnaItem.answer_image_url];
        }
      }
      const combinedUrls = [...existingUrls, ...newUrls];

      const payload = {
        answer: text.trim(),
        answer_image_url: combinedUrls.length > 0 ? JSON.stringify(combinedUrls) : null,
        status: 'ANSWERED',
        answered_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('qna').update(payload).eq('id', qnaItem.id);
      if (error) throw error;

      // 🔔 학생에게 답변 완료 푸시 알림
      if (qnaItem.student_id) {
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [qnaItem.student_id],
              title: `[1:1 답변 등록] ${user.name} 선생님의 풀이`,
              message: `'${qnaItem.title}' 질문에 대한 답변이 등록되었습니다.`,
              url: '/qna',
            }),
          }).catch((e) => console.warn('Answer push warning:', e));
        } catch (e) {
          console.warn('Push error:', e);
        }
      }

      alert('답변이 등록되었습니다!');
      setAnswerState((prev) => ({
        ...prev,
        [qnaItem.id]: { text: '', files: [], filePreviews: [], isEditing: false, submitting: false },
      }));
      fetchQuestions(user);
    } catch (err) {
      console.error(err);
      alert('답변 저장 실패: ' + err.message);
      setAnswerState((prev) => ({
        ...prev,
        [qnaItem.id]: { ...(prev[qnaItem.id] || {}), submitting: false },
      }));
    }
  };

  // 이미지 파싱 유틸 (JSON 배열 또는 단일 URL 문자열 지원)
  const parseImages = (imgStr) => {
    if (!imgStr) return [];
    try {
      const parsed = JSON.parse(imgStr);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [imgStr];
    }
  };

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'HEAD_TEACHER';

  // 필터링 적용 목록
  const filteredQuestions = questions.filter((q) => {
    if (filterStatus === 'PENDING') return q.status === 'PENDING';
    if (filterStatus === 'ANSWERED') return q.status === 'ANSWERED';
    return true;
  });

  const pendingCount = questions.filter((q) => q.status === 'PENDING').length;
  const answeredCount = questions.filter((q) => q.status === 'ANSWERED').length;

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">1:1 질의응답 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      
      {/* 상단 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div
            onClick={() => router.push(isTeacher ? '/teacher/dashboard' : '/student/dashboard')}
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20 cursor-pointer"
          >
            품
          </div>
          <div>
            <h1
              onClick={() => router.push(isTeacher ? '/teacher/dashboard' : '/student/dashboard')}
              className="text-base font-black text-slate-800 cursor-pointer hover:text-amber-600 transition"
            >
              1:1 수학 질의응답 (Q&A)
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {isTeacher
                ? `담당 학생들의 질문을 확인하고 1:1로 풀이 답변을 남겨주세요.`
                : '담당 선생님과 나만 볼 수 있는 1:1 비공개 질문 공간입니다.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200"
        >
          ← 이전 화면으로
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        {/* 학생 전용: 새 질문 등록 폼 */}
        {!isTeacher && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span className="text-base">✍️</span>
              <span>선생님께 1:1 질문 작성하기</span>
            </h2>

            <form onSubmit={handleSubmitQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">질문 제목</label>
                <input
                  type="text"
                  placeholder="예: 개념쎈 p.45 3번 문제 풀이가 이해가 안 가요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">궁금한 점 (자세한 내용)</label>
                <textarea
                  placeholder="어느 부분까지 풀었고 어디서 막혔는지 적어주시면 선생님이 더 정확하게 답변할 수 있어요."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-800 h-28 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* 📷 다중 사진 첨부 영역 */}
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/70 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>📸 문제/풀이 사진 첨부 (여러 장 가능)</span>
                    </label>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      교재 사진이나 직접 푼 연습장 사진을 찍어서 올려주세요.
                    </p>
                  </div>

                  <label className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs transition inline-block text-center">
                    + 사진 추가하기
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 첨부된 사진 미리보기 썸네일 */}
                {filePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-200/60">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-amber-300 group shadow-xs">
                        <img src={preview} alt="미리보기" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedFile(index)}
                          className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingQuestion}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md shadow-amber-600/20 transition disabled:bg-slate-400"
                >
                  {submittingQuestion ? '질문 전송 중...' : '담당 선생님께 질문 보내기 🚀'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 탭 필터 (전체 / 미답변 / 답변 완료) */}
        <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                filterStatus === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체 ({questions.length}건)
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                filterStatus === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span>🚨 미답변</span>
              <span>({pendingCount}건)</span>
            </button>
            <button
              onClick={() => setFilterStatus('ANSWERED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                filterStatus === 'ANSWERED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span>✅ 답변 완료</span>
              <span>({answeredCount}건)</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">
            🔒 학생 본인과 담당 선생님만 확인 가능합니다.
          </span>
        </div>

        {/* 질문 목록 */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80 space-y-2">
              <span className="text-3xl">💡</span>
              <p className="text-sm font-bold text-slate-700">해당 조건의 1:1 질문이 없습니다.</p>
              <p className="text-xs text-slate-400">궁금한 문제가 있다면 언제든 편하게 질문을 남겨보세요.</p>
            </div>
          ) : (
            filteredQuestions.map((item) => {
              const questionImages = parseImages(item.question_image_url);
              const answerImages = parseImages(item.answer_image_url);
              const studentName = item.users?.name || '학생';
              const teacherName = item.teacher?.name || '담당 선생님';

              const qState = answerState[item.id] || {};
              const isAnswerFormOpen = isTeacher && (item.status === 'PENDING' || qState.isEditing);

              return (
                <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  
                  {/* 상단 뱃지 & 날짜 */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            item.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.status === 'PENDING' ? '⏳ 답변 대기 중' : '✅ 답변 완료'}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          👤 {studentName} 학생의 질문
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          • {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 pt-1">{item.title}</h3>
                    </div>

                    {!isTeacher && item.status === 'PENDING' && (
                      <button
                        onClick={() => handleDeleteQuestion(item.id, item.title)}
                        className="text-xs text-rose-500 hover:underline font-bold px-2 py-1"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {/* 질문 본문 */}
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {item.question}
                  </div>

                  {/* 질문 다중 사진 갤러리 */}
                  {questionImages.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500">📷 첨부된 문제 사진 ({questionImages.length}장):</span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {questionImages.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewImageUrl(imgUrl)}
                            className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer group shadow-xs hover:border-amber-400 transition"
                          >
                            <img src={imgUrl} alt="문제 사진" className="w-full h-full object-cover group-hover:scale-105 transition" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                              확대보기 🔍
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ────────────────── 선생님 답변 영역 ────────────────── */}
                  {item.answer && !qState.isEditing ? (
                    <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 p-5 rounded-2xl border border-indigo-100 space-y-3 mt-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                            쌤
                          </span>
                          <span className="text-xs font-black text-indigo-950">
                            {teacherName} 선생님의 풀이 답변
                          </span>
                          <span className="text-[10px] text-indigo-500 font-medium">
                            {item.answered_at ? new Date(item.answered_at).toLocaleString() : ''}
                          </span>
                        </div>

                        {isTeacher && (
                          <button
                            onClick={() => {
                              setAnswerState((prev) => ({
                                ...prev,
                                [item.id]: { text: item.answer, files: [], filePreviews: [], isEditing: true },
                              }));
                            }}
                            className="text-xs text-indigo-600 hover:underline font-bold px-2 py-1"
                          >
                            답변 수정
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-white/80 p-4 rounded-xl border border-indigo-100">
                        {item.answer}
                      </p>

                      {/* 선생님 답변 사진 갤러리 */}
                      {answerImages.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-bold text-indigo-900">📸 풀이 사진 ({answerImages.length}장):</span>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {answerImages.map((imgUrl, idx) => (
                              <div
                                key={idx}
                                onClick={() => setPreviewImageUrl(imgUrl)}
                                className="relative w-24 h-24 rounded-2xl overflow-hidden border border-indigo-200 cursor-pointer group shadow-xs hover:border-indigo-500 transition"
                              >
                                <img src={imgUrl} alt="풀이 사진" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                                  확대보기 🔍
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isAnswerFormOpen ? (
                    /* 선생님 전용: 답변 작성/수정 폼 */
                    <div className="bg-indigo-50/60 p-5 rounded-2xl border border-indigo-200/80 space-y-3 mt-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                          <span>✍️</span>
                          <span>{item.answer ? '풀이 답변 수정하기' : '풀이 답변 작성하기'}</span>
                        </h4>
                        {qState.isEditing && (
                          <button
                            onClick={() => {
                              setAnswerState((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || {}), isEditing: false },
                              }));
                            }}
                            className="text-xs text-slate-500 font-bold"
                          >
                            수정 취소
                          </button>
                        )}
                      </div>

                      <textarea
                        placeholder="학생에게 이해하기 쉽게 풀이 과정이나 개념 힌트를 설명해 주세요."
                        value={qState.text !== undefined ? qState.text : (item.answer || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnswerState((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), text: val },
                          }));
                        }}
                        className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 h-28 focus:outline-none focus:border-indigo-600"
                      />

                      {/* 답변 사진 추가 */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-1">
                        <label className="text-xs font-bold text-indigo-900">
                          📸 풀이 해설 사진 첨부 (연습장/해설지 사진)
                        </label>
                        <label className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-300 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer transition text-center shadow-xs">
                          + 사진 선택
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length === 0) return;
                              const previews = files.map((f) => URL.createObjectURL(f));
                              setAnswerState((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...(prev[item.id] || {}),
                                  files: [...(prev[item.id]?.files || []), ...files],
                                  filePreviews: [...(prev[item.id]?.filePreviews || []), ...previews],
                                },
                              }));
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* 추가된 답변 사진 미리보기 */}
                      {(qState.filePreviews || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {(qState.filePreviews || []).map((prev, pIdx) => (
                            <div key={pIdx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-indigo-300">
                              <img src={prev} alt="답변 사진 미리보기" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleSubmitAnswer(item)}
                          disabled={qState.submitting}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition disabled:bg-slate-400"
                        >
                          {qState.submitting ? '답변 저장 중...' : (item.answer ? '수정 완료' : '답변 등록하기')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                </div>
              );
            })
          )}
        </div>

      </main>

      {/* 🔍 사진 확대 뷰어 모달 */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-transparent" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImageUrl}
              alt="확대 이미지"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="flex justify-between items-center mt-3 px-1">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/20 hover:bg-white/30 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition"
              >
                원본 다운로드 ↗
              </a>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="bg-white text-slate-800 font-black text-xs px-4 py-1.5 rounded-xl shadow transition"
              >
                닫기 ✕
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
