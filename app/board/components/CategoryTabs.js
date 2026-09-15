'use client';

export default function CategoryTabs({
  category,
  setCategory,
  selectedClassId,
  setSelectedClassId,
  myClasses = [],
}) {
  return (
    <div className="space-y-3">
      {/* 1. 카테고리 4등분 컴팩트 세그먼트 탭 (가로 넘김 없이 1줄 4등분으로 화면에 쏙 맞춤) */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setCategory('ALL')}
          className={`py-2.5 px-1 rounded-xl text-xs sm:text-sm font-black transition text-center flex items-center justify-center gap-1 ${
            category === 'ALL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span>📋</span>
          <span className="truncate">전체</span>
        </button>

        <button
          type="button"
          onClick={() => setCategory('NOTICE_HOMEWORK')}
          className={`py-2.5 px-1 rounded-xl text-xs sm:text-sm font-black transition text-center flex items-center justify-center gap-1 ${
            category === 'NOTICE_HOMEWORK'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span>📝</span>
          <span className="truncate">숙제·공지</span>
        </button>

        <button
          type="button"
          onClick={() => setCategory('VIDEO')}
          className={`py-2.5 px-1 rounded-xl text-xs sm:text-sm font-black transition text-center flex items-center justify-center gap-1 ${
            category === 'VIDEO'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span>🎬</span>
          <span className="truncate">복습영상</span>
        </button>

        <button
          type="button"
          onClick={() => setCategory('MATERIAL')}
          className={`py-2.5 px-1 rounded-xl text-xs sm:text-sm font-black transition text-center flex items-center justify-center gap-1 ${
            category === 'MATERIAL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span>📁</span>
          <span className="truncate">수업자료</span>
        </button>
      </div>

      {/* 2. 반 선택 드롭다운 (가로 스크롤 잘림 문제 해결) */}
      <div className="flex items-center gap-2 bg-slate-50/80 p-2 sm:p-2.5 rounded-xl border border-slate-200">
        <label className="text-xs font-black text-slate-700 shrink-0 flex items-center gap-1">
          <span>🏫</span>
          <span className="hidden sm:inline">공지 대상:</span>
          <span className="sm:hidden">대상:</span>
        </label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-bold text-slate-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="PUBLIC">🌐 학원 전체 공지사항</option>
          {myClasses.map((c) => (
            <option key={c.id} value={String(c.id)}>
              🎯 [{c.name}]
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
