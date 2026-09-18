'use client';

export default function PostCreateForm({
  user,
  myClasses,
  targetClassId,
  setTargetClassId,
  newCategory,
  setNewCategory,
  dueDate,
  setDueDate,
  title,
  setTitle,
  content,
  setContent,
  googleFormUrl,
  setGoogleFormUrl,
  homeworkList,
  handleAddBook,
  handleRemoveBook,
  handleBookChange,
  handleToggleStudent,
  availableStudents = [],
  setAttachedFile,
  handleCreatePost,
  uploading,
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="font-bold text-lg text-gray-800">✍️ 반별 공지 및 게시글 작성 ({user?.name || ''} 선생님)</h2>
      <form onSubmit={handleCreatePost} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={targetClassId}
            onChange={(e) => setTargetClassId(e.target.value)}
            className="p-2.5 border rounded-xl text-sm bg-indigo-50 border-indigo-200 font-bold text-indigo-900"
          >
            <optgroup label="📘 내 담당 반 목록">
              {myClasses.length === 0 ? (
                <option value="" disabled>개설된 내 반이 없습니다</option>
              ) : (
                myClasses.map((c) => (
                  <option key={c.id} value={c.id}>🎯 [{c.name}] 전용 공지</option>
                ))
              )}
            </optgroup>
            <optgroup label="──────────────────">
              <option value="ALL_STUDENTS">📢 학원 전체 학생 공지</option>
            </optgroup>
          </select>

          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="p-2.5 border rounded-xl text-sm bg-gray-50 font-semibold"
          >
            <option value="HOMEWORK">📝 숙제 알림</option>
            <option value="NOTICE">📢 공지사항</option>
            <option value="VIDEO">🎬 복습 영상</option>
            <option value="MATERIAL">📄 수업자료 (JPG/PDF)</option>
          </select>

          {newCategory === 'HOMEWORK' && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="p-2.5 border rounded-xl text-sm bg-blue-50 border-blue-200 font-bold text-blue-700"
            />
          )}
        </div>

        <input
          type="text"
          placeholder="제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2.5 border rounded-xl text-sm font-medium"
        />

        {newCategory === 'HOMEWORK' && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-slate-700">📚 교재별 숙제 목록</span>
                <p className="text-[10px] text-slate-400">교재별로 반 전체 또는 특정 학생을 지정하여 숙제를 부여할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={handleAddBook}
                className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shrink-0"
              >
                + 교재 추가
              </button>
            </div>

            {homeworkList.map((item, index) => (
              <div key={index} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="교재명 (예: 개념쎈)"
                    value={item.bookTitle}
                    onChange={(e) => handleBookChange(index, 'bookTitle', e.target.value)}
                    className="w-1/3 p-2 border rounded-lg text-sm bg-white font-medium"
                  />
                  <input
                    type="text"
                    placeholder="범위 (예: p.45 ~ p.50)"
                    value={item.range}
                    onChange={(e) => handleBookChange(index, 'range', e.target.value)}
                    className="flex-1 p-2 border rounded-lg text-sm bg-white font-medium"
                  />
                  {homeworkList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBook(index)}
                      className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-2 rounded-lg hover:bg-rose-200 transition"
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
                        onClick={() => handleBookChange(index, 'targetType', 'ALL')}
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
                        onClick={() => handleBookChange(index, 'targetType', 'SELECTED')}
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
                              handleBookChange(index, 'targetStudentNames', isAllSelected ? [] : allNames);
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
                                onClick={() => handleToggleStudent(index, st.name)}
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
                📋 구글 설문지 제출 링크 (선택)
              </label>
              <input
                type="url"
                placeholder="https://forms.gle/..."
                value={googleFormUrl}
                onChange={(e) => setGoogleFormUrl(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              />
            </div>
          </div>
        )}

        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📎</span>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-emerald-900 leading-tight">
                  첨부파일 / 수업자료 <span className="text-[11px] font-medium text-emerald-700">(JPG, PNG, PDF)</span>
                </label>
                <p className="text-[10px] text-emerald-600">이미지 및 문서는 게시글에 바로 첨부됩니다.</p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setAttachedFile(e.target.files[0] || null)}
              className="text-xs font-semibold text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer w-full sm:w-auto"
            />
          </div>
        </div>

        <textarea
          placeholder="내용을 적어주세요. (유튜브/웹사이트 링크 입력 시 자동 연결 및 재생 플레이어가 생성됩니다)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-3 border rounded-xl text-sm h-20"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow transition"
          >
            {uploading ? '파일 업로드 중...' : '등록하기'}
          </button>
        </div>
      </form>
    </div>
  );
}