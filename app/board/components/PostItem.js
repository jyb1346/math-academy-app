'use client';

import FormattedContent from './FormattedContent';

function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function PostItem({
  post,
  user,
  postConfirmations,
  handleOpenEdit,
  handleDeletePost,
  togglePostConfirmation,
  studentScope,
  activeStudents,
}) {
  const postContent = post.content || '';
  const formMatch = postContent.match(/🔗 구글 폼 링크: (https?:\/\/[^\s]+)/);
  const formUrl = formMatch ? formMatch[1] : null;

  const fileMatch = postContent.match(/📎 첨부파일: (https?:\/\/[^\s]+)/);
  const fileUrl = fileMatch ? fileMatch[1] : null;
  const isImage = fileUrl && (fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || fileUrl.includes('image'));

  const ytId = getYouTubeId(postContent);

  const isMyPost = user?.id === post.author_id;
  const isConfirmedByMe = postConfirmations[post.id]?.has(user?.id);

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex justify-between items-center text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-600">
            {post.category === 'HOMEWORK' && '📝 숙제 알림'}
            {post.category === 'NOTICE' && '📢 공지사항'}
            {post.category === 'VIDEO' && '🎬 복습 영상'}
            {post.category === 'MATERIAL' && '📄 수업 자료'}
            {post.category === 'QNA' && '💬 질의응답'}
          </span>
          {post.classes ? (
            <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
              🎯 {post.classes.name}
            </span>
          ) : (
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
              🌐 학원 전체 공지
            </span>
          )}
          {post.due_date && (
            <span className="bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-bold">
              📅 마감일: {post.due_date}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isMyPost && (
            <>
              <button
                onClick={() => handleOpenEdit(post)}
                className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1 rounded-lg font-bold border border-amber-200 transition"
              >
                ✏️ 수정
              </button>
              <button
                onClick={() => handleDeletePost(post.id, post.title)}
                className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-2.5 py-1 rounded-lg font-bold border border-rose-200 transition"
              >
                삭제
              </button>
            </>
          )}
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <h3 className="font-bold text-base text-gray-800">{post.title}</h3>
      
      {/* 🎯 자동 링크 연결 텍스트 */}
      <FormattedContent text={post.content.replace(/📎 첨부파일: https?:\/\/[^\s]+/, '')} />

      {/* 🖼️ 이미지 파일 미리보기 */}
      {isImage && (
        <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2">
          <img
            src={fileUrl}
            alt="수업자료 이미지"
            className="w-full max-h-96 object-contain rounded-xl"
          />
        </div>
      )}

      {/* 📄 PDF 및 기타 첨부파일 다운로드 버튼 */}
      {fileUrl && !isImage && (
        <div className="pt-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition"
          >
            <span>📄 첨부된 PDF / 수업자료 받기</span>
            <span>⬇️</span>
          </a>
        </div>
      )}

      {/* 🎬 유튜브 영상 자동 플레이어 임베드 */}
      {ytId && (
        <div className="mt-3 aspect-video w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title="YouTube video player"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {formUrl && (
        <div className="pt-2">
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition"
          >
            <span>📋 구글 폼 숙제 제출하기</span>
            <span>↗</span>
          </a>
        </div>
      )}

      {/* 🎯 [학생 전용] 숙제/공지 확인 완료 버튼 */}
      {user?.role === 'STUDENT' && (
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => togglePostConfirmation(post.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 ${
              isConfirmedByMe
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <span>{isConfirmedByMe ? '✓ 숙제 및 공지 확인 완료' : '☐ 공지 확인하기'}</span>
          </button>
        </div>
      )}

      {/* 🎯 [선생님 전용] 학생 공지/숙제 확인 현황 표 */}
      {user?.role !== 'STUDENT' && (
        <div className="mt-4 pt-3 border-t border-gray-100 bg-slate-50 p-4 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-700">👀 학생 공지/숙제 확인 현황</p>
            <span className="text-[10px] font-bold text-blue-600">
              {studentScope === 'MY_STUDENTS' ? '👤 내 담당 학생만 보기' : '🌐 학원 전체 학생 보기'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeStudents.length === 0 ? (
              <span className="text-xs text-slate-400">해당 범위의 학생이 없습니다.</span>
            ) : (
              activeStudents.map((st) => {
                const isConfirmed = postConfirmations[post.id]?.has(st.id);
                return (
                  <span
                    key={st.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      isConfirmed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    {st.name} {isConfirmed ? '✓ 확인완료' : '미확인'}
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}