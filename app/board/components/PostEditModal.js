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
  editYoutubeUrl,
  setEditYoutubeUrl,
  editGoogleFormUrl,
  setEditGoogleFormUrl,
  editHomeworkList,
  handleEditAddBook,
  handleEditRemoveBook,
  handleEditBookChange,
  handleEditToggleStudent,
  availableStudents = [],
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
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95">
        
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {editCategory === 'HOMEWORK' && '📝'}
              {editCategory === 'NOTICE' && '📢'}
              {editCategory === 'VIDEO' && '🎬'}
              {editCategory === 'MATERIAL' && '📄'}
            </span>
            <h3 className="text-base font-black text-slate-800">
              {editCategory === 'HOMEWORK' && '숙제 공지 수정'}
              {editCategory === 'NOTICE' && '일반 공지사항 수정'}
              {editCategory === 'VIDEO' && '복습 영상 수정'}
              {editCategory === 'MATERIAL' && '수업 자료 수정'}
            </h3>
          </div>
          <button
            onClick={() => setEditingPost(null)}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 p-1 transition"
          >
            ✕ 닫기
          </button>
        </div>

        <form onSubmit={handleUpdatePost} className="space-y-4">
          
          {/* 1. 카테고리 선택 탭 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">게시글 유형</label>
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
              {[
                { key: 'HOMEWORK', label: '📝 숙제', color: 'bg-blue-600' },
                { key: 'NOTICE', label: '📢 공지', color: 'bg-indigo-600' },
                { key: 'VIDEO', label: '🎬 영상', color: 'bg-purple-600' },
                { key: 'MATERIAL', label: '📄 자료', color: 'bg-emerald-600' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setEditCategory(tab.key)}
                  className={`py-2 rounded-xl text-xs font-extrabold transition ${
                    editCategory === tab.key
                      ? `${tab.color} text-white shadow-xs`
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 대상 반 & 마감일 선택 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">대상 반</label>
              <select
                value={editTargetClassId}
                onChange={(e) => setEditTargetClassId(e.target.value)}
                className="w-full p-2.5 border rounded-2xl text-xs bg-indigo-50/70 border-indigo-200 font-bold text-indigo-900"
              >
                <optgroup label="📘 내 담당 반 목록">
                  {(myClasses || []).map((c) => (
                    <option key={c.id} value={c.id}>🎯 [{c.name}] 전용</option>
                  ))}
                </optgroup>
                <optgroup label="──────────────────">
                  <option value="ALL_STUDENTS">📢 학원 전체 학생</option>
                </optgroup>
              </select>
            </div>

            {editCategory === 'HOMEWORK' && (
              <div className="sm:w-40">
                <label className="block text-[11px] font-bold text-blue-700 mb-1">⏰ 제출 마감일</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full p-2.5 border rounded-2xl text-xs bg-blue-50 border-blue-200 font-bold text-blue-800"
                />
              </div>
            )}
          </div>

          {/* 3. 게시글 제목 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {editCategory === 'HOMEWORK' && '숙제 제목'}
              {editCategory === 'NOTICE' && '공지사항 제목'}
              {editCategory === 'VIDEO' && '복습 영상 제목'}
              {editCategory === 'MATERIAL' && '수업자료 제목'}
            </label>
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
            />
          </div>

          {/* 4-A. [숙제 전용 양식] 교재별 숙제 목록 & 구글 폼 링크 */}
          {editCategory === 'HOMEWORK' && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록</span>
                  <p className="text-[10px] text-slate-400">교재별로 대상 학생(전체/특정학생)을 변경할 수 있습니다.</p>
                </div>
                <button
                  type="button"
                  onClick={handleEditAddBook}
                  className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-blue-700 transition shrink-0"
                >
                  + 교재 추가
                </button>
              </div>

              {(editHomeworkList || []).map((item, index) => (
                <div key={index} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="교재명 (예: 개념원리)"
                      value={item.bookTitle}
                      onChange={(e) => handleEditBookChange(index, 'bookTitle', e.target.value)}
                      className="w-1/3 p-2.5 border rounded-xl text-xs bg-white font-semibold"
                    />
                    <input
                      type="text"
                      placeholder="범위 (예: p.12~15 또는 1~50번)"
                      value={item.range}
                      onChange={(e) => handleEditBookChange(index, 'range', e.target.value)}
                      className="flex-1 p-2.5 border rounded-xl text-xs bg-white font-semibold"
                    />
                    {editHomeworkList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleEditRemoveBook(index)}
                        className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-xl hover:bg-rose-200 transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* 대상 학생 선택 (반 전체 vs 개별 학생) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">숙제 대상:</span>
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => handleEditBookChange(index, 'targetType', 'ALL')}
                          className={`px-2.5 py-1 rounded-md font-bold transition text-[11px] ${
                            item.targetType !== 'SELECTED'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          👥 반 전체 (기본)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditBookChange(index, 'targetType', 'SELECTED')}
                          className={`px-2.5 py-1 rounded-md font-bold transition text-[11px] ${
                            item.targetType === 'SELECTED'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          👤 특정 학생만 선택
                        </button>
                      </div>
                    </div>

                    {item.targetType === 'SELECTED' && (
                      <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-900">
                            선택된 학생 ({item.targetStudentNames?.length || 0}명):
                          </span>
                          {availableStudents?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allNames = availableStudents.map((s) => s.name);
                                const isAllSelected = allNames.every((n) => (item.targetStudentNames || []).includes(n));
                                handleEditBookChange(index, 'targetStudentNames', isAllSelected ? [] : allNames);
                              }}
                              className="text-[10px] text-indigo-700 underline font-bold"
                            >
                              {(item.targetStudentNames || []).length === availableStudents.length ? '전체 해제' : '모두 선택'}
                            </button>
                          )}
                        </div>

                        {availableStudents && availableStudents.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {availableStudents.map((st) => {
                              const isSelected = (item.targetStudentNames || []).includes(st.name);
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => handleEditToggleStudent(index, st.name)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300'
                                  }`}
                                >
                                  <span>{isSelected ? '✓' : '+'}</span>
                                  <span>{st.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 py-1">
                            선택 가능한 학생 명단이 없습니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  📋 구글 설문지 숙제 제출 링크 (선택)
                </label>
                <input
                  type="url"
                  placeholder="https://forms.gle/..."
                  value={editGoogleFormUrl}
                  onChange={(e) => setEditGoogleFormUrl(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                />
              </div>
            </div>
          )}

          {/* 4-B. [영상 전용 양식] 유튜브 링크 입력창 */}
          {editCategory === 'VIDEO' && (
            <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200 space-y-1.5">
              <label className="block text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <span>🎬</span>
                <span>유튜브 영상 링크 (URL)</span>
              </label>
              <input
                type="url"
                placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..."
                value={editYoutubeUrl}
                onChange={(e) => setEditYoutubeUrl(e.target.value)}
                className="w-full p-2.5 border border-purple-200 rounded-xl text-xs bg-white font-semibold text-slate-800"
              />
              <p className="text-[10px] text-purple-600">
                유튜브 주소를 입력하시면 게시글에 자동 재생 플레이어가 생성됩니다.
              </p>
            </div>
          )}

          {/* 5. 본문 내용 / 메모 / 설명 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {editCategory === 'HOMEWORK' && '📝 전달할 메모 (선택)'}
              {editCategory === 'NOTICE' && '📝 공지 내용'}
              {editCategory === 'VIDEO' && '📝 영상 설명 / 코멘트 (선택)'}
              {editCategory === 'MATERIAL' && '📝 자료 설명'}
            </label>
            <textarea
              placeholder={
                editCategory === 'HOMEWORK'
                  ? '숙제 관련 추가 안내사항이나 메모를 적어주세요.'
                  : editCategory === 'VIDEO'
                  ? '수업 영상에 대한 설명이나 주요 포인트를 적어주세요.'
                  : '내용을 자세히 적어주세요.'
              }
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-2xl text-xs h-24 font-medium"
            />
          </div>

          {/* 6. 📎 첨부파일 수정 및 교체 영역 */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-slate-700 block">
              📎 첨부파일 / 수업자료 (PDF, 이미지, 교재)
            </span>

            {/* 기존 첨부파일이 있을 때 */}
            {editExistingAttachment && !editNewFile && (
              <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-base">📄</span>
                  <span className="font-bold text-slate-800 truncate max-w-[220px]">
                    {editExistingAttachment?.name || "첨부파일"}
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

            {/* 새 파일이 선택되었을 때 */}
            {editNewFile && (
              <div className="flex items-center justify-between bg-emerald-50 px-3.5 py-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-base">✨</span>
                  <span className="font-extrabold truncate max-w-[220px]">
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

            {/* 파일 업로드 인풋 버튼 */}
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

          {/* 저장 및 취소 버튼 */}
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
