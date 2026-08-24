{/* 빠른 기능 바로가기 */}
<section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
  <h2 className="text-base font-bold text-slate-800 mb-2">⚡ 바로가기</h2>
  <button
    onClick={() => router.push('/teacher/eval')}
    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-xl font-bold text-xs shadow hover:opacity-95 transition flex justify-between items-center"
  >
    <span>📊 일일 학습 피드백 작성</span>
    <span>→</span>
  </button>
  <button
    onClick={() => router.push('/teacher/eval/history')}
    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 p-3.5 rounded-xl font-bold text-xs border border-slate-200 transition flex justify-between items-center"
  >
    <span>📋 학생 피드백 이력 전체 조회</span>
    <span>→</span>
  </button>
  <button
    onClick={() => router.push('/board')}
    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 p-3.5 rounded-xl font-bold text-xs border border-slate-200 transition flex justify-between items-center"
  >
    <span>📢 반별 공지 및 숙제 작성</span>
    <span>→</span>
  </button>
</section>