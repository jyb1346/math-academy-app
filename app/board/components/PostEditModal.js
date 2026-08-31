'use client';

export default function PostEditModal({
  editingPost,
  setEditingPost,
  myClasses,
  editTargetClassId,
  setEditTargetClassId,
  editCategory,
  setEditCategory,
  editDueDate,
  setEditDueDate,
  editTitle,
  setEditTitle,
  editContent,
  setEditContent,
  editGoogleFormUrl,
  setEditGoogleFormUrl,
  editHomeworkList,
  handleEditAddBook,
  handleEditRemoveBook,
  handleEditBookChange,
  editExistingAttachment,
  setEditExistingAttachment,
  editNewFile,
  setEditNewFile,
  editUploading,
  handleUpdatePost,
}) {
  if (!editingPost) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl my-8 border border-slate-200">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <h3 className="text-base font-extrabold text-slate-800">게시글 수정</h3>
          </div>
          <button
            onClick={() => setEditingPost(null)}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 p-1"
          >
            ✕ 닫기
          </button>
        </div>

        <form onSubmit={handleUpdatePost} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={editTargetClassId}
              onChange={(e) => setEditTargetClassId(e.target.value)}
              className="p-2.5 border rounded-2xl text-xs bg-indigo-50 border-indigo-200 font-bold text-indigo-900"
            >
              <optgroup label="📘 내 담당 반 목록">
                {myClasses.map((c) => (
                  <option key={c.id} value={c.id}>🎯 [{c.name}] 전용 공지</option>
                ))}
              </optgroup>
              <optgroup label="──────────────────">
                <option value="ALL_STUDENTS">📢 학원 전체 학생 공지</option>
              </optgroup>
            </select>

            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="p-2.5 border rounded-2xl text-xs bg-gray-50 font-semibold"
            >
              <option value="HOMEWORK">📝 숙제 알림</option>
              <option value="NOTICE">📢 공지사항</option>
              <option value="VIDEO">🎬 복습 영상</option>
              <option value="MATERIAL">📄 수업 자료</option>
            </select>

            {editCategory === 'HOMEWORK' && (
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="p-2.5 border rounded-2xl text-xs bg-blue-50 border-blue-200 font-bold text-blue-700"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">제목</label>
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
            />
          </div>

          {/* 숙제 목록 편집 (HOMEWORK) */}
          {editCategory === 'HOMEWORK' && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록 수정</span>
                <button
                  type="button"
                  onClick={handleEditAddBook}
                  className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-blue-700 transition"
                >
                  + 교재 추가
                </button>
              </div>

              {editHomeworkList.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="교재명 (예: 개념원리)"
                    value={item.bookTitle}
                    onChange={(e) => handleEditBookChange(index, 'bookTitle', e.target.value)}
                    className="w-1/3 p-2.5 border rounded-xl text-xs bg-white font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="범위 (예: p.12~15)"
                    value={item.range}
                    onChange={(e) => handleEditBookChange(index, 'range', e.target.value)}
                    className="flex-1 p-2.5 border rounded-xl text-xs bg-white font-semibold"
                  />
                  {editHomeworkList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleEditRemoveBook(index)}
                      className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-xl"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  📋 구글 폼 숙제 제출 링크 (선택)
                </label>
                <input
                  type="url"
                  placeholder="https://forms.gle/..."
                  value={editGoogleFormUrl}
                  onChange={(e) => setEditGoogleFormUrl(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs bg-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">본문 내용 / 메모</label>
            <textarea
              placeholder="내용 또는 전달할 메모를 적어주세요."
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-2xl text-xs h-28 font-medium"
            />
          </div>

          {/* 📎 첨부파일 수정 및 교체 영역 */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-slate-700 block">
              📎 첨부파일 수정 / 변경 (PDF, 이미지, 교재 등)
            </span>

            {/* 1. 기존 첨부파일이 있을 때 */}
            {editExistingAttachment && !editNewFile && (
              <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-base">📄</span>
                  <span className="font-bold text-slate-800 truncate max-w-[240px]">
                    {editExistingAttachment.name}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">
                    (현재 파일)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditExistingAttachment(null)}
                  className="text-xs text-rose-600 font-bold hover:underline ml-2 whitespace-nowrap"
                  title="첨부파일 제거"
                >
                  ✕ 파일 삭제
                </button>
              </div>
            )}

            {/* 2. 새 파일이 선택되었을 때 */}
            {editNewFile && (
              <div className="flex items-center justify-between bg-emerald-50 px-3.5 py-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-base">✨</span>
                  <span className="font-extrabold truncate max-w-[240px]">
                    {editNewFile.name}
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    {(editNewFile.size / 1024).toFixed(0)} KB (새로 교체됨)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditNewFile(null)}
                  className="text-xs text-rose-600 font-bold hover:underline ml-2 whitespace-nowrap"
                >
                  ✕ 취소
                </button>
              </div>
            )}

            {/* 3. 파일 업로드 인풋 */}
            <div>
              <label className="inline-flex items-center gap-2 cursor-pointer bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs">
                <span>📁</span>
                <span>{editExistingAttachment || editNewFile ? '다른 파일로 교체하기' : '첨부파일 선택 (PDF, 이미지)'}</span>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEditNewFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingPost(null)}
              className="w-1/2 bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold text-xs hover:bg-slate-200 transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={editUploading}
              className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold text-xs shadow-md transition"
            >
              {editUploading ? '저장 및 업로드 중...' : '수정사항 저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
