'use client';

export default function CategoryTabs({
  category,
  setCategory,
  selectedClassId,
  setSelectedClassId,
  myClasses,
}) {
  return (
    <div className="space-y-3">
      {/* 1. 카테고리 탭 (Q&A는 전용 1:1 메뉴로 분리되어 일반 게시판 3대 카테고리 유지) */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setCategory('ALL')}
          className={`px-4 py-2.5 rounded-xl text-sm font-black transition whitespace-nowrap ${
            category === 'ALL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          전체보기
        </button>
        <button
          onClick={() => setCategory('NOTICE_HOMEWORK')}
          className={`px-4 py-2.5 rounded-xl text-sm font-black transition whitespace-nowrap ${
            category === 'NOTICE_HOMEWORK'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          1️⃣ 📝 숙제 및 공지사항
        </button>
        <button
          onClick={() => setCategory('VIDEO')}
          className={`px-4 py-2.5 rounded-xl text-sm font-black transition whitespace-nowrap ${
            category === 'VIDEO'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          2️⃣ 🎬 복습영상 게시판
        </button>
        <button
          onClick={() => setCategory('MATERIAL')}
          className={`px-4 py-2.5 rounded-xl text-sm font-black transition whitespace-nowrap ${
            category === 'MATERIAL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          3️⃣ 📄 수업자료 게시판
        </button>
      </div>

      {/* 2. 반별 탭: '전체 반' 제거, [🌐 학원 전체 공지] 고정 탭 + [담당/소속 반 목록] */}
      <div className="flex gap-2 overflow-x-auto pt-1 pb-1 items-center scrollbar-none">
        <button
          onClick={() => setSelectedClassId('PUBLIC')}
          className={`px-4 py-2 rounded-xl text-sm font-extrabold transition whitespace-nowrap flex items-center gap-1.5 ${
            selectedClassId === 'PUBLIC'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>🌐</span>
          <span>학원 전체 공지사항</span>
        </button>

        {myClasses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedClassId(String(c.id))}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition whitespace-nowrap flex items-center gap-1 ${
              String(selectedClassId) === String(c.id)
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <span>🎯</span>
            <span>[{c.name}]</span>
          </button>
        ))}
      </div>
    </div>
  );
}
