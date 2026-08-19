'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function QnaPage() {
  const [user, setUser] = useState(null);
  const [qnaList, setQnaList] = useState([]);
  const [loading, setLoading] = useState(true);

  // 질문 작성 상태 (학생용)
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [questionImage, setQuestionImage] = useState(null);
  const [uploadingQuestionImg, setUploadingQuestionImg] = useState(false);

  // 답변 작성 상태 (선생님용)
  const [replyingId, setReplyingId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answerImage, setAnswerImage] = useState(null);
  const [uploadingAnswerImg, setUploadingAnswerImg] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchQnaList();
  }, []);

  // Q&A 목록 불러오기
  const fetchQnaList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('qna')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQnaList(data || []);
    } catch (err) {
      console.error(err);
      alert('질문 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 이미지 업로드 공통 함수
  const uploadImageToStorage = async (file) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `qna/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('qna-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('qna-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // 학생: 질문 등록
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!title.trim() || !question.trim()) {
      alert('제목과 질문 내용을 입력해주세요.');
      return;
    }

    setUploadingQuestionImg(true);

    try {
      let imageUrl = null;
      if (questionImage) {
        imageUrl = await uploadImageToStorage(questionImage);
      }

      const { error } = await supabase.from('qna').insert([
        {
          student_id: user.id,
          title: title,
          question: question,
          question_image_url: imageUrl,
          status: 'PENDING',
        },
      ]);

      if (error) throw error;

      alert('질문과 문제 사진이 성공적으로 등록되었습니다!');
      setTitle('');
      setQuestion('');
      setQuestionImage(null);
      setShowQuestionModal(false);
      fetchQnaList();
    } catch (err) {
      console.error(err);
      alert(`질문 등록 실패: ${err.message}`);
    } finally {
      setUploadingQuestionImg(false);
    }
  };

  // 선생님: 답변 등록
  const handleCreateAnswer = async (qnaId) => {
    if (!answerText.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }

    setUploadingAnswerImg(true);

    try {
      let imageUrl = null;
      if (answerImage) {
        imageUrl = await uploadImageToStorage(answerImage);
      }

      const { error } = await supabase
        .from('qna')
        .update({
          answer: answerText,
          answer_image_url: imageUrl || undefined,
          teacher_id: user.id,
          status: 'ANSWERED',
          answered_at: new Date().toISOString(),
        })
        .eq('id', qnaId);

      if (error) throw error;

      alert('답변이 성공적으로 등록되었습니다!');
      setReplyingId(null);
      setAnswerText('');
      setAnswerImage(null);
      fetchQnaList();
    } catch (err) {
      console.error(err);
      alert(`답변 등록 실패: ${err.message}`);
    } finally {
      setUploadingAnswerImg(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 상단 헤더 */}
      <header className="bg-blue-600 text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">❓ 1:1 Q&A 수학 질문게시판</h1>
            <p className="text-sm opacity-90">
              {user?.name} {user?.role === 'TEACHER' ? '선생님' : '학생'} 로그인 중
            </p>
          </div>
          <button
            onClick={() => {
              if (user?.role === 'TEACHER') {
                router.push('/teacher/dashboard');
              } else {
                router.push('/student/dashboard');
              }
            }}
            className="bg-blue-700 hover:bg-blue-800 text-xs px-3 py-2 rounded-lg transition"
          >
            내 대시보드로 돌아가기
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">질문 및 답변 목록</h2>
          {user?.role === 'STUDENT' && (
            <button
              onClick={() => setShowQuestionModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition"
            >
              + 질문하기 (사진 첨부)
            </button>
          )}
        </div>

        {/* 질문하기 모달 (학생전용) */}
        {showQuestionModal && (
          <div className="bg-white p-6 rounded-2xl border border-gray-300 shadow-md space-y-4">
            <h3 className="text-lg font-bold text-gray-800">선생님께 질문하기</h3>
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">질문 제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: [수학I] 삼각함수 단원 15번 문제 질문입니다"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">질문 내용</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="풀리지 않는 풀이과정이나 모르는 개념을 적어주세요."
                  rows={4}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📸 문제 사진 첨부 (선택)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setQuestionImage(e.target.files[0])}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 font-medium text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={uploadingQuestionImg}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-sm disabled:bg-gray-400"
                >
                  {uploadingQuestionImg ? '사진 업로드 중...' : '질문 등록'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Q&A 목록 */}
        {loading ? (
          <p className="text-center py-8 text-gray-500">로딩 중...</p>
        ) : qnaList.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500">
            등록된 질문이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {qnaList.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.status === 'ANSWERED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {item.status === 'ANSWERED' ? '답변완료' : '답변대기'}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800">{item.title}</h3>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* 질문 정보 및 첨부 사진 */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                  <p className="text-xs text-blue-600 font-bold">Q. 학생 질문</p>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {item.question}
                  </p>

                  {/* 질문 이미지 표시 */}
                  {item.question_image_url && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1 font-semibold">📷 첨부된 문제 이미지:</p>
                      <a href={item.question_image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={item.question_image_url}
                          alt="문제 이미지"
                          className="max-h-64 rounded-lg border border-gray-200 hover:opacity-90 transition"
                        />
                      </a>
                    </div>
                  )}
                </div>

                {/* 선생님 답변 및 해설 이미지 */}
                {item.answer && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                    <p className="text-xs text-blue-800 font-bold">
                      A. 장영배 선생님 답변
                      {item.answered_at && (
                        <span className="font-normal text-gray-500 ml-2">
                          ({new Date(item.answered_at).toLocaleDateString('ko-KR')})
                        </span>
                      )}
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                      {item.answer}
                    </p>

                    {/* 답변 풀이 이미지 표시 */}
                    {item.answer_image_url && (
                      <div className="mt-2">
                        <p className="text-xs text-blue-700 mb-1 font-semibold">✏️ 첨부된 풀이 해설 이미지:</p>
                        <a href={item.answer_image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={item.answer_image_url}
                            alt="답변 풀이 이미지"
                            className="max-h-64 rounded-lg border border-blue-200 hover:opacity-90 transition"
                          />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* 선생님 답변 작성 폼 */}
                {user?.role === 'TEACHER' && (
                  <div className="pt-2">
                    {replyingId === item.id ? (
                      <div className="space-y-3 mt-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="학생에게 전달할 친절한 풀이 및 해설을 입력하세요..."
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            ✏️ 해설 풀이 사진 첨부 (선택)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setAnswerImage(e.target.files[0])}
                            className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => {
                              setReplyingId(null);
                              setAnswerText('');
                              setAnswerImage(null);
                            }}
                            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleCreateAnswer(item.id)}
                            disabled={uploadingAnswerImg}
                            className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                          >
                            {uploadingAnswerImg ? '업로드 중...' : '답변 등록'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingId(item.id);
                          setAnswerText(item.answer || '');
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {item.answer ? '✏️ 답변/해설 이미지 수정하기' : '💬 1:1 답변 및 해설 사진 달기'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}