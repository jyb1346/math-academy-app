'use client';
import { compressImage } from '@/lib/imageCompressor';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function QnaPage() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'PENDING' | 'ANSWERED'

  // 학생: 최초 질문 작성 폼 상태
  const [title, setTitle] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [filePreviews, setFilePreviews] = useState([]); // string[] (object URLs)
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // 선생님: 답변 작성/수정 상태 (qnaId -> { text, files, filePreviews, isEditing, submitting })
  const [answerState, setAnswerState] = useState({});

  // 💬 대화형 추가 질문 / 추가 답변 상태 (qnaId -> { text, files, filePreviews, isOpen, submitting })
  const [followUpState, setFollowUpState] = useState({});

  // 🔍 사진 확대 뷰어 모달
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  // 💡 완전히 이해했어요 (완료 처리 중 상태)
  const [resolvingId, setResolvingId] = useState(null);

  // ✍️ 학생: 최초 질문 수정 상태 (qnaId -> { title, question, isOpen, submitting })
  const [editQuestionState, setEditQuestionState] = useState({});

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

  // 🎯 학생 및 선생님 정보 매핑을 위한 맵
  const [usersMap, setUsersMap] = useState({});

  const fetchQuestions = async (currentUser) => {
    try {
      setLoading(true);

      // 전체 사용자(학생 및 선생님) 이름/이메일 사전 로드
      const { data: uData } = await supabase.from('users').select('id, name, email, role');
      const uMap = {};
      (uData || []).forEach((u) => {
        uMap[u.id] = u;
      });
      setUsersMap(uMap);

      // QnA 데이터 조회
      let query = supabase.from('qna').select('*');
      if (currentUser.role === 'STUDENT') {
        query = query.eq('student_id', currentUser.id);
      } else {
        query = query.eq('teacher_id', currentUser.id);
      }

      const { data: qData, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setQuestions(qData || []);
    } catch (err) {
      console.error('QnA fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 학생: 최초 질문 파일 선택 시 미리보기 생성
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
    for (const rawFile of files) {
      const file = await compressImage(rawFile);
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

  // 🎯 학생: 1:1 최초 질문 등록
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('질문 제목을 입력해 주세요.');
    if (!questionText.trim()) return alert('질문 내용을 입력해 주세요.');

    setSubmittingQuestion(true);

    try {
      const { data: studentInfo } = await supabase
        .from('users')
        .select('teacher_id')
        .eq('id', user.id)
        .maybeSingle();

      const assignedTeacherId = studentInfo?.teacher_id || null;

      const imageUrls = await uploadFilesToStorage(selectedFiles);

      const payload = {
        student_id: user.id,
        teacher_id: assignedTeacherId,
        title: title.trim(),
        question: questionText.trim(),
        question_image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        status: 'PENDING',
        replies: [],
      };

      const { error } = await supabase.from('qna').insert([payload]);
      if (error) throw error;

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

  // 학생: 질문 삭제 (답변 등록 전에만)
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

  // 학생: 질문 수정 시작/취소/저장 핸들러
  const handleStartEditQuestion = (item) => {
    setEditQuestionState((prev) => ({
      ...prev,
      [item.id]: {
        title: item.title || '',
        question: item.question || '',
        isOpen: true,
        submitting: false,
      },
    }));
  };

  const handleCancelEditQuestion = (id) => {
    setEditQuestionState((prev) => ({
      ...prev,
      [id]: { isOpen: false, submitting: false },
    }));
  };

  const handleSaveEditQuestion = async (id) => {
    const st = editQuestionState[id];
    if (!st?.title?.trim()) return alert('질문 제목을 입력해 주세요.');
    if (!st?.question?.trim()) return alert('질문 내용을 입력해 주세요.');

    setEditQuestionState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), submitting: true },
    }));

    try {
      const { error } = await supabase
        .from('qna')
        .update({
          title: st.title.trim(),
          question: st.question.trim(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('질문이 성공적으로 수정되었습니다.');
      handleCancelEditQuestion(id);
      fetchQuestions(user);
    } catch (err) {
      console.error('Edit question error:', err);
      alert('질문 수정 실패: ' + err.message);
      setEditQuestionState((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), submitting: false },
      }));
    }
  };

  // 🎯 선생님: 1차 답변 등록 / 수정
  const handleSubmitAnswer = async (qnaItem) => {
    const state = answerState[qnaItem.id] || {};
    const text = state.text !== undefined ? state.text : (qnaItem.answer || '');

    if (!text.trim()) return alert('답변 내용을 입력해 주세요.');

    setAnswerState((prev) => ({
      ...prev,
      [qnaItem.id]: { ...(prev[qnaItem.id] || {}), submitting: true },
    }));

    try {
      const newFiles = state.files || [];
      const newUrls = await uploadFilesToStorage(newFiles);

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

      if (qnaItem.student_id) {
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [qnaItem.student_id],
              title: `[1:1 답변 등록] ${user.name} 선생님의 풀이`,
              message: `'${qnaItem.title}' 질문에 대한 풀이 답변이 등록되었습니다.`,
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

  // 💬 대화형 추가 질문 / 추가 답변 등록 핸들러
  const handleSubmitFollowUp = async (qnaItem) => {
    const state = followUpState[qnaItem.id] || {};
    const text = (state.text || '').trim();
    const files = state.files || [];

    if (!text && files.length === 0) {
      return alert('추가 질문이나 답변 내용을 입력해 주세요.');
    }

    setFollowUpState((prev) => ({
      ...prev,
      [qnaItem.id]: { ...(prev[qnaItem.id] || {}), submitting: true },
    }));

    try {
      const uploadedUrls = await uploadFilesToStorage(files);
      const isStudent = user.role === 'STUDENT';

      const newReply = {
        id: `reply_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sender_id: user.id,
        sender_name: user.name || (isStudent ? '학생' : '선생님'),
        sender_role: user.role,
        content: text,
        images: uploadedUrls,
        created_at: new Date().toISOString(),
      };

      let existingReplies = [];
      if (Array.isArray(qnaItem.replies)) {
        existingReplies = qnaItem.replies;
      } else if (typeof qnaItem.replies === 'string') {
        try {
          existingReplies = JSON.parse(qnaItem.replies) || [];
        } catch {
          existingReplies = [];
        }
      }

      const updatedReplies = [...existingReplies, newReply];
      const nextStatus = isStudent ? 'PENDING' : 'ANSWERED';

      const updatePayload = {
        replies: updatedReplies,
        status: nextStatus,
        answered_at: isStudent ? qnaItem.answered_at : new Date().toISOString(),
      };

      const { error } = await supabase
        .from('qna')
        .update(updatePayload)
        .eq('id', qnaItem.id);

      if (error) throw error;

      // 푸시 알림 발송
      const targetUserId = isStudent ? qnaItem.teacher_id : qnaItem.student_id;
      if (targetUserId) {
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [targetUserId],
              title: isStudent
                ? `[1:1 추가 질문] ${user.name} 학생의 재질문`
                : `[1:1 추가 답변] ${user.name} 선생님의 추가 풀이`,
              message: text ? (text.length > 40 ? text.substring(0, 40) + '...' : text) : '사진이 첨부되었습니다.',
              url: '/qna',
            }),
          }).catch((e) => console.warn('Follow-up push warning:', e));
        } catch (e) {
          console.warn('Push error:', e);
        }
      }

      alert(isStudent ? '추가 질문이 선생님께 성공적으로 전달되었습니다!' : '추가 풀이가 학생에게 전달되었습니다!');

      setFollowUpState((prev) => ({
        ...prev,
        [qnaItem.id]: { text: '', files: [], filePreviews: [], submitting: false, isOpen: false },
      }));

      fetchQuestions(user);
    } catch (err) {
      console.error('Follow-up error:', err);
      alert('전송 실패: ' + err.message);
      setFollowUpState((prev) => ({
        ...prev,
        [qnaItem.id]: { ...(prev[qnaItem.id] || {}), submitting: false },
      }));
    }
  };

  // 💡 학생: "완전히 이해했어요! (질문 완료)" 처리
  const handleResolveQuestion = async (qnaItem) => {
    if (!confirm(`'${qnaItem.title}' 문제 풀이를 완전히 이해하셨나요?\n질문을 '이해 완료' 상태로 변경하고 선생님께 알림을 보냅니다.`)) {
      return;
    }

    setResolvingId(qnaItem.id);
    try {
      const existingReplies = parseReplies(qnaItem.replies);
      const resolveEvent = {
        id: `resolve_${Date.now()}`,
        type: 'RESOLVED',
        sender_id: user.id,
        sender_name: user.name || '학생',
        sender_role: 'STUDENT',
        content: '💡 학생이 풀이를 완전히 이해하여 해결 완료되었습니다.',
        created_at: new Date().toISOString(),
      };

      const updatedReplies = [...existingReplies, resolveEvent];

      // DB 테이블의 qna_status_check(PENDING/ANSWERED) 제약조건을 준수하며 replies에 해결 이벤트를 기록
      const { error } = await supabase
        .from('qna')
        .update({
          status: 'ANSWERED',
          replies: updatedReplies,
        })
        .eq('id', qnaItem.id);

      if (error) throw error;

      // 담당 선생님께 푸시 알림 발송
      if (qnaItem.teacher_id) {
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [qnaItem.teacher_id],
              title: `[질문 해결] ${user.name || '학생'} 학생이 풀이를 완전히 이해했습니다! 💡`,
              message: `'${qnaItem.title}' 질문이 해결 완료되었습니다.`,
              url: '/qna',
            }),
          }).catch((e) => console.warn('Resolve push warning:', e));
        } catch (e) {
          console.warn('Push error:', e);
        }
      }

      alert('🎉 질문이 해결 완료되었습니다! 수고했어요! 💡');
      fetchQuestions(user);
    } catch (err) {
      console.error('Resolve error:', err);
      alert('완료 처리 실패: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  // 이미지 파싱 유틸 (배열, JSON 문자열, 단일 URL 등 모든 형식 완벽 지원)
  const parseImages = (imgInput) => {
    if (!imgInput) return [];
    if (Array.isArray(imgInput)) {
      return imgInput.filter((url) => typeof url === 'string' && url.trim().length > 0);
    }
    if (typeof imgInput === 'string') {
      const trimmed = imgInput.trim();
      if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((url) => typeof url === 'string' && url.trim().length > 0);
        }
        if (typeof parsed === 'string' && parsed.trim().length > 0) {
          return [parsed.trim()];
        }
      } catch {
        if (trimmed.startsWith('http')) {
          return [trimmed];
        }
      }
    }
    return [];
  };

  // 스레드 댓글 목록 파싱 유틸
  const parseReplies = (repliesData) => {
    if (!repliesData) return [];
    if (Array.isArray(repliesData)) return repliesData;
    try {
      const parsed = JSON.parse(repliesData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // 3단계 라이프사이클 계산 (PENDING: 답변 대기 / ANSWERED: 학생 확인 중 / RESOLVED: 이해 완료)
  const getLifecycleStatus = (item) => {
    if (item.status === 'PENDING') return 'PENDING';
    const replies = parseReplies(item.replies);
    if (replies.length > 0) {
      const lastReply = replies[replies.length - 1];
      if (lastReply?.type === 'RESOLVED') {
        return 'RESOLVED';
      }
    }
    return 'ANSWERED';
  };

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'HEAD_TEACHER';

  const questionsWithStatus = questions.map((q) => ({
    ...q,
    computedStatus: getLifecycleStatus(q),
  }));

  const pendingCount = questionsWithStatus.filter((q) => q.computedStatus === 'PENDING').length;
  const answeredCount = questionsWithStatus.filter((q) => q.computedStatus === 'ANSWERED').length;
  const resolvedCount = questionsWithStatus.filter((q) => q.computedStatus === 'RESOLVED').length;

  const filteredQuestions = questionsWithStatus.filter((q) => {
    if (filterStatus === 'PENDING') return q.computedStatus === 'PENDING';
    if (filterStatus === 'ANSWERED') return q.computedStatus === 'ANSWERED';
    if (filterStatus === 'RESOLVED') return q.computedStatus === 'RESOLVED';
    return true;
  });

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">1:1 질의응답 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-100/70 pb-32 font-sans text-slate-800">
      
      {/* 상단 헤더 */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div
            onClick={() => router.push(isTeacher ? '/teacher/dashboard' : '/student/dashboard')}
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
          >
            품
          </div>
          <div>
            <h1
              onClick={() => router.push(isTeacher ? '/teacher/dashboard' : '/student/dashboard')}
              className="text-base sm:text-lg font-black text-slate-800 cursor-pointer hover:text-amber-600 transition leading-tight"
            >
              1:1 수학 질의응답 (Q&A)
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {isTeacher
                ? '담당 학생 1:1 질문 확인 및 풀이 답변'
                : '선생님과 나만의 1:1 비공개 질문 공간'}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200 whitespace-nowrap shrink-0"
        >
          ← 뒤로가기
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

        {/* 탭 필터 (전체 / 답변 대기 / 학생 확인 중 / 이해 완료) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                filterStatus === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📋 전체 ({questions.length})
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                filterStatus === 'PENDING'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <span>🚨 답변 대기</span>
              <span>({pendingCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus('ANSWERED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                filterStatus === 'ANSWERED'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <span>💬 학생 확인 중</span>
              <span>({answeredCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus('RESOLVED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                filterStatus === 'RESOLVED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span>💡 이해 완료</span>
              <span>({resolvedCount})</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-semibold hidden lg:inline">
            🔒 학생 본인과 담당 선생님만 확인 가능합니다.
          </span>
        </div>

        {/* 질문 목록 */}
        <div className="space-y-6">
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
              const repliesList = parseReplies(item.replies);
              const normalReplies = repliesList.filter((r) => r.type !== 'RESOLVED');
              const studentInfo = usersMap[item.student_id];
              const studentName = studentInfo?.name ? `${studentInfo.name} 학생` : '학생';
              const teacherInfo = usersMap[item.teacher_id];
              const teacherName = teacherInfo?.name ? `${teacherInfo.name} 선생님` : '담당 선생님';

              const qState = answerState[item.id] || {};
              const isAnswerFormOpen = isTeacher && (!item.answer || qState.isEditing);
              const currentFollowUp = followUpState[item.id] || {};

              const isQuestionEditing = !isTeacher && editQuestionState[item.id]?.isOpen;
              const curEditState = editQuestionState[item.id] || {};

              return (
                <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                  
                  {/* 상단 뱃지 & 날짜 & 수정/삭제 버튼 */}
                  <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shrink-0 ${
                            item.computedStatus === 'PENDING'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : item.computedStatus === 'ANSWERED'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.computedStatus === 'PENDING'
                            ? (normalReplies.length > 0 ? '🚨 추가 질문 대기 중' : '🚨 답변 대기 중')
                            : item.computedStatus === 'ANSWERED'
                            ? '💬 학생 확인 중'
                            : '💡 이해 완료'}
                        </span>
                        <span className="text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full shrink-0">
                          👤 {studentName} {studentInfo?.email ? `(${studentInfo.email.split('@')[0]})` : ''}의 1:1 질문
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                          • {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      {!isQuestionEditing && (
                        <h3 className="text-base font-extrabold text-slate-800 pt-0.5 break-words">{item.title}</h3>
                      )}
                    </div>

                    {/* 학생 전용: 질문 수정/삭제 버튼 (선생님 답변 등록 전에만 가능) */}
                    {!isTeacher && !item.answer && (
                      <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap pt-0.5 ml-2">
                        {!isQuestionEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEditQuestion(item)}
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-xl transition border border-slate-200 shadow-2xs whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              <span>✏️</span>
                              <span>수정</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(item.id, item.title)}
                              className="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-xl transition border border-rose-200 shadow-2xs whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              <span>🗑️</span>
                              <span>삭제</span>
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* ────────────────── 1. 최초 질문 영역 (또는 수정 폼) ────────────────── */}
                  {isQuestionEditing ? (
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in">
                      <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <span>✏️</span>
                        <span>질문 내용 수정하기</span>
                      </h4>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">질문 제목</label>
                        <input
                          type="text"
                          value={curEditState.title || ''}
                          onChange={(e) => setEditQuestionState((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), title: e.target.value },
                          }))}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">질문 내용</label>
                        <textarea
                          value={curEditState.question || ''}
                          onChange={(e) => setEditQuestionState((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), question: e.target.value },
                          }))}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 h-24 focus:outline-none focus:border-amber-500 font-medium"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCancelEditQuestion(item.id)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={curEditState.submitting}
                          onClick={() => handleSaveEditQuestion(item.id)}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs transition disabled:bg-slate-400"
                        >
                          {curEditState.submitting ? '저장 중...' : '수정 완료'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <span>🙋‍♂️</span>
                        <span>학생 질문 내용:</span>
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                        {item.question}
                      </div>

                      {/* 질문 다중 사진 갤러리 */}
                      {questionImages.length > 0 && (
                        <div className="space-y-1 pt-1">
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
                    </div>
                  )}

                  {/* ────────────────── 2. 선생님 1차 답변 영역 ────────────────── */}
                  {item.answer && !qState.isEditing ? (
                    <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/70 p-5 rounded-2xl border border-indigo-100 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                            쌤
                          </span>
                          <span className="text-xs font-black text-indigo-950">
                            {teacherName}의 풀이 답변
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
                            className="text-xs text-indigo-600 hover:underline font-bold px-2 py-1 whitespace-nowrap shrink-0 self-end sm:self-auto"
                          >
                            답변 수정
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-white/90 p-4 rounded-xl border border-indigo-100 font-medium">
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
                    /* 선생님 전용: 1차 답변 작성/수정 폼 */
                    <div className="bg-indigo-50/60 p-5 rounded-2xl border border-indigo-200/80 space-y-3">
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
                        className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 h-28 focus:outline-none focus:border-indigo-600 font-medium"
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

                  {/* ────────────────── 3. 대화형 연속 추가 질문/답변 스레드 타임라인 ────────────────── */}
                  {normalReplies.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 block">
                        💬 추가 질의응답 내역 ({normalReplies.length}개):
                      </span>

                      {normalReplies.map((reply) => {
                        const isReplyStudent = reply.sender_role === 'STUDENT';
                        const replyImages = parseImages(reply.images);

                        return (
                          <div
                            key={reply.id}
                            className={`p-4 rounded-2xl border space-y-2.5 transition ${
                              isReplyStudent
                                ? 'bg-amber-50/60 border-amber-200/80'
                                : 'bg-indigo-50/60 border-indigo-200/80'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-black ${
                                    isReplyStudent ? 'bg-amber-500' : 'bg-indigo-600'
                                  }`}
                                >
                                  {isReplyStudent ? '질문' : '해설'}
                                </span>
                                <span
                                  className={`text-xs font-black ${
                                    isReplyStudent ? 'text-amber-950' : 'text-indigo-950'
                                  }`}
                                >
                                  {isReplyStudent
                                    ? `💬 ${reply.sender_name || '학생'}의 추가 질문`
                                    : `🎓 ${reply.sender_name || '선생님'}의 추가 해설`}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-medium ${
                                  isReplyStudent ? 'text-amber-700' : 'text-indigo-700'
                                }`}
                              >
                                {reply.created_at ? new Date(reply.created_at).toLocaleString() : ''}
                              </span>
                            </div>

                            {reply.content && (
                              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-white/90 p-3.5 rounded-xl border border-slate-100 font-medium">
                                {reply.content}
                              </p>
                            )}

                            {replyImages.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {replyImages.map((imgUrl, rIdx) => (
                                  <div
                                    key={rIdx}
                                    onClick={() => setPreviewImageUrl(imgUrl)}
                                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-xs hover:scale-105 transition"
                                  >
                                    <img src={imgUrl} alt="추가 사진" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ────────────────── 3.5. 이해 완료 확인 & 상태 안내 박스 ────────────────── */}
                  {item.answer && !qState.isEditing && (
                    <div className="space-y-2 pt-1">
                      {/* 💡 학생 전용: 이해 완료 버튼 */}
                      {!isTeacher && item.computedStatus === 'ANSWERED' && (
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">💡</span>
                            <div>
                              <h4 className="text-xs font-black text-emerald-950">선생님 풀이가 잘 이해되었나요?</h4>
                              <p className="text-[11px] text-emerald-700 font-medium">더 이상 궁금한 점이 없다면 완료 버튼을 눌러주세요!</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleResolveQuestion(item)}
                            disabled={resolvingId === item.id}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition whitespace-nowrap flex items-center justify-center gap-1.5 disabled:bg-slate-400 cursor-pointer shrink-0"
                          >
                            <span>💡</span>
                            <span>{resolvingId === item.id ? '완료 처리 중...' : '완전히 이해했어요! (질문 완료)'}</span>
                          </button>
                        </div>
                      )}

                      {/* 💡 학생 전용: 이해 완료 안내 */}
                      {!isTeacher && item.computedStatus === 'RESOLVED' && (
                        <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center gap-2.5 text-emerald-900 shadow-2xs">
                          <span className="text-xl">🎉</span>
                          <div>
                            <p className="text-xs font-black text-emerald-950">풀이를 완전히 이해하여 해결 완료된 질문입니다!</p>
                            <p className="text-[11px] text-emerald-700 font-medium">다시 모르는 부분이 생기면 언제든 아래에서 추가 질문을 남길 수 있어요.</p>
                          </div>
                        </div>
                      )}

                      {/* 💡 선생님 전용: 이해 완료 안내 */}
                      {isTeacher && item.computedStatus === 'RESOLVED' && (
                        <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center gap-2.5 text-emerald-900 shadow-2xs">
                          <span className="text-xl">💡</span>
                          <div>
                            <p className="text-xs font-black text-emerald-950">학생이 풀이를 확인하고 [완전히 이해 완료]를 눌렀습니다.</p>
                            <p className="text-[11px] text-emerald-700 font-medium">질문이 깔끔하게 해결되었습니다 ✨</p>
                          </div>
                        </div>
                      )}

                      {/* 💡 선생님 전용: 학생 확인 중 안내 */}
                      {isTeacher && item.computedStatus === 'ANSWERED' && (
                        <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-2xl flex items-center gap-2 text-amber-900 shadow-2xs">
                          <span className="text-base">💬</span>
                          <span className="text-xs font-bold">선생님 답변 완료 (학생이 확인하고 이해 여부를 체크 중입니다)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ────────────────── 4. 추가 질문 / 추가 답변 작성창 ────────────────── */}
                  {item.answer && !qState.isEditing && (
                    <div className="pt-2">
                      {!currentFollowUp.isOpen ? (
                        <button
                          onClick={() =>
                            setFollowUpState((prev) => ({
                              ...prev,
                              [item.id]: { ...(prev[item.id] || {}), isOpen: true },
                            }))
                          }
                          className={`w-full py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition border shadow-2xs ${
                            !isTeacher
                              ? item.computedStatus === 'RESOLVED'
                                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                          }`}
                        >
                          <span>💬</span>
                          <span>
                            {!isTeacher
                              ? item.computedStatus === 'RESOLVED'
                                ? '해결된 질문에 다시 추가 질문(재질문) 남기기'
                                : '선생님 풀이에 추가 질문(재질문) 남기기'
                              : '학생에게 추가 풀이 / 힌트 남기기'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal ml-1">▼</span>
                        </button>
                      ) : (
                        <div
                          className={`p-4 rounded-2xl border space-y-3 animate-in fade-in ${
                            !isTeacher ? 'bg-amber-50/70 border-amber-200' : 'bg-indigo-50/70 border-indigo-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black flex items-center gap-1.5 text-slate-800">
                              <span>💬</span>
                              <span>
                                {!isTeacher ? '선생님께 추가 질문 작성하기' : '학생에게 추가 해설 작성하기'}
                              </span>
                            </h4>
                            <button
                              onClick={() =>
                                setFollowUpState((prev) => ({
                                  ...prev,
                                  [item.id]: { ...(prev[item.id] || {}), isOpen: false },
                                }))
                              }
                              className="text-xs font-bold text-slate-400 hover:text-slate-600"
                            >
                              ✕ 접기
                            </button>
                          </div>

                          <textarea
                            placeholder={
                              !isTeacher
                                ? '어느 부분이 여전히 이해가 안 가는지 추가 질문을 남겨주세요.'
                                : '추가로 설명해 줄 개념이나 식 전개 과정을 적어주세요.'
                            }
                            value={currentFollowUp.text || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFollowUpState((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || {}), text: val },
                              }));
                            }}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 h-24 focus:outline-none focus:border-amber-500 font-medium"
                          />

                          {/* 사진 첨부 버튼 */}
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <label className="text-[11px] font-bold text-slate-600">
                              📸 사진 첨부 (연습장/문제/해설 사진)
                            </label>
                            <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer transition text-center shadow-2xs">
                              + 사진 추가
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length === 0) return;
                                  const previews = files.map((f) => URL.createObjectURL(f));
                                  setFollowUpState((prev) => ({
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

                          {/* 사진 미리보기 */}
                          {(currentFollowUp.filePreviews || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {(currentFollowUp.filePreviews || []).map((prev, pIdx) => (
                                <div key={pIdx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-300 group shadow-xs">
                                  <img src={prev} alt="사진 미리보기" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFollowUpState((prevS) => {
                                        const cur = prevS[item.id] || {};
                                        return {
                                          ...prevS,
                                          [item.id]: {
                                            ...cur,
                                            files: (cur.files || []).filter((_, i) => i !== pIdx),
                                            filePreviews: (cur.filePreviews || []).filter((_, i) => i !== pIdx),
                                          },
                                        };
                                      });
                                    }}
                                    className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setFollowUpState((prev) => ({
                                  ...prev,
                                  [item.id]: { text: '', files: [], filePreviews: [], isOpen: false },
                                }))
                              }
                              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              disabled={currentFollowUp.submitting}
                              onClick={() => handleSubmitFollowUp(item)}
                              className={`px-5 py-2 text-white rounded-xl text-xs font-black shadow-md transition disabled:bg-slate-400 ${
                                !isTeacher
                                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                              }`}
                            >
                              {currentFollowUp.submitting
                                ? '전송 중...'
                                : (!isTeacher ? '추가 질문 보내기 🚀' : '추가 해설 등록하기 ✨')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
