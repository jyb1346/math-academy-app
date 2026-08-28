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
  handleUpdatePost,
}) {
  if (!editingPost) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl my-8">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-bold text-slate-800">✏️ 게시글 수정</h3>
          <button onClick={() => setEditingPost(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">닫기</button>
        </div>

        <form onSubmit={handleUpdatePost} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={editTargetClassId}
              onChange={(e) => setEditTargetClassId(e.target.value)}
              className="p-2.5 border rounded-xl text-sm bg-indigo-50 border-indigo-200 font-bold text-indigo-900"
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
              className="p-2.5 border rounded-xl text-sm bg-gray-50 font-semibold"
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
                className="p-2.5 border rounded-xl text-sm bg-blue-50 border-blue-200 font-bold text-blue-700"
              />
            )}
          </div>

          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full p-2.5 border rounded-xl text-sm font-medium"
          />

          {editCategory === 'HOMEWORK' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록 수정</span>
                <button
                  type="button"
                  onClick={handleEditAddBook}
                  className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                >
                  + 교재 추가
                </button>
              </div>

              {editHomeworkList.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="교재명"
                    value={item.bookTitle}
                    onChange={(e) => handleEditBookChange(index, 'bookTitle', e.target.value)}
                    className="w-1/3 p-2 border rounded-lg text-sm bg-white font-medium"
                  />
                  <input
                    type="text"
                    placeholder="범위"
                    value={item.range}
                    onChange={(e) => handleEditBookChange(index, 'range', e.target.value)}
                    className="flex-1 p-2 border rounded-lg text-sm bg-white font-medium"
                  />
                  {editHomeworkList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleEditRemoveBook(index)}
                      className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-lg"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  📋 숙제 제출 링크 (선택)
                </label>
                <input
                  type="url"
                  placeholder="https://forms.gle/..."
                  value={editGoogleFormUrl}
                  onChange={(e) => setEditGoogleFormUrl(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                />
              </div>
            </div>
          )}

          <textarea
            placeholder="내용을 적어주세요."
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 border rounded-xl text-sm h-28"
          />

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingPost(null)}
              className="w-1/2 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs"
            >
              취소
            </button>
            <button
              type="submit"
              className="w-1/2 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs shadow hover:bg-indigo-700 transition"
            >
              수정사항 저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}