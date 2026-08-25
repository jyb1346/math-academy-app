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
      {/* 4대 카테고리 분류 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setCategory('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
            category === 'ALL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          🌐 전체보기
        </button>
        <button
          onClick={() => setCategory('NOTICE_HOMEWORK')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
            category === 'NOTICE_HOMEWORK'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          1️⃣ 📝 숙제 및 반별 공지사항
        </button>
        <button
          onClick={() => setCategory('VIDEO')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
            category === 'VIDEO'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          2️⃣ 🎬 복습영상 게시판
        </button>
        <button
          onClick={() => setCategory('MATERIAL')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
            category === 'MATERIAL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          3️⃣ 📄 수업자료 게시판
        </button>
        <button
          onClick={() => setCategory('QNA')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
            category === 'QNA'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          4️⃣ 💬 질의응답
        </button>
      </div>

      {/* 반별 서브 필터 버튼 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedClassId('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            selectedClassId === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          전체 반
        </button>

        {myClasses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedClassId(c.id.toString())}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              selectedClassId === c.id.toString() ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            🎯 [{c.name}]
          </button>
        ))}

        <button
          onClick={() => setSelectedClassId('PUBLIC')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            selectedClassId === 'PUBLIC' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          🌐 학원 전체 공지
        </button>
      </div>
    </div>
  );
}