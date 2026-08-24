'use client';

import { useRouter } from 'next/navigation';

export default function MaterialBoardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              📄 수업 자료 게시판
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              수업 교재, 유인물 PDF 및 테스트 모의고사 자료를 확인하세요.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200"
        >
          ← 이전 화면으로
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-4">
        <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80 space-y-3">
          <span className="text-4xl">📁</span>
          <h2 className="text-base font-extrabold text-slate-800">등록된 수업 자료가 없습니다.</h2>
          <p className="text-xs text-slate-400">선생님이 업로드하신 PDF 및 테스트 자료가 여기에 표시됩니다.</p>
        </div>
      </main>
    </div>
  );
}