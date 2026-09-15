'use client';

import { useState, useEffect } from 'react';
import { getStudentBugDex, getMonthlyBugLeaderboard } from '@/lib/luckyBugService';
import { BUG_TIERS } from '@/lib/bugCatalog';

export default function StudentBugDexModal({ user, onClose }) {
  const [tab, setTab] = useState('DEX'); // 'DEX' | 'LEADERBOARD'
  const [tierFilter, setTierFilter] = useState('ALL');
  const [dexData, setDexData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState(null);
  const [milestoneCert, setMilestoneCert] = useState(null); // { title, tier, reqCount, desc }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dex, ranks] = await Promise.all([
        getStudentBugDex(user.id),
        getMonthlyBugLeaderboard(),
      ]);
      setDexData(dex);
      setLeaderboard(ranks);
    } catch (e) {
      console.error('Dex load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredBugs = (dexData?.bugList || []).filter((bug) => {
    if (tierFilter === 'ALL') return true;
    return bug.tier === tierFilter;
  });

  const myRankInfo = leaderboard.find((r) => r.studentId === user.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl animate-bounce">📖</span>
            <div>
              <h2 className="text-lg font-black leading-tight flex items-center gap-2">
                <span>품수학 20종 벌레 도감</span>
                <span className="bg-yellow-400/20 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-300/30">
                  컬렉션
                </span>
              </h2>
              <p className="text-xs text-indigo-200 font-semibold">
                돌발 벌레와 보스 레이드에서 포획한 나만의 컬렉션
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-black px-2 py-1 transition"
          >
            ✕
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setTab('DEX')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-1.5 ${
              tab === 'DEX'
                ? 'bg-white text-indigo-900 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🐛 내 도감</span>
            {dexData && (
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {dexData.caughtKindsCount}/20
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('LEADERBOARD')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-1.5 ${
              tab === 'LEADERBOARD'
                ? 'bg-white text-indigo-900 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🏆 월간 명예의 전당</span>
            {myRankInfo && (
              <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {myRankInfo.rank}위
              </span>
            )}
          </button>
        </div>

        {/* 내용 영역 */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400 space-y-2">
              <div className="animate-spin text-2xl">⏳</div>
              <p>도감 데이터 로딩 중...</p>
            </div>
          ) : tab === 'DEX' ? (
            <>
              {/* 도감 달성도 게이지 바 */}
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex justify-between items-center text-xs font-black">
                  <div className="flex items-center gap-1.5 text-indigo-950">
                    <span>🎯 도감 완성률</span>
                    <span className="text-indigo-600 font-extrabold text-sm">{dexData?.progressPercent || 0}%</span>
                  </div>
                  <span className="text-slate-600 font-bold">
                    {dexData?.caughtKindsCount || 0} / 20종 발견
                  </span>
                </div>

                {/* 프로그레스 바 */}
                <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden shadow-inner p-0.5">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${dexData?.progressPercent || 0}%` }}
                  />
                </div>

                {/* 마일스톤 뱃지 (5종, 10종, 15종, 20종) */}
                <div className="grid grid-cols-4 gap-1.5 pt-1 text-center text-[10.5px] font-black">
                  <button
                    type="button"
                    onClick={() =>
                      setMilestoneCert({
                        title: '🥉 브론즈 헌터',
                        tier: '5종 수집 달성',
                        reqCount: 5,
                        achieved: dexData?.milestones?.bronze,
                        desc: '벌레 5종을 포획하여 초보 헌터 자격을 획득했습니다!',
                      })
                    }
                    className={`p-2 rounded-xl border transition ${
                      dexData?.milestones?.bronze
                        ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                        : 'bg-white/60 text-slate-400 border-slate-200 opacity-60'
                    }`}
                  >
                    <span className="block text-sm">🥉</span>
                    <span>5종 달성</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMilestoneCert({
                        title: '🥈 실버 헌터',
                        tier: '10종 수집 달성',
                        reqCount: 10,
                        achieved: dexData?.milestones?.silver,
                        desc: '벌레 10종을 포획하여 숙련된 헌터로 인정받았습니다!',
                      })
                    }
                    className={`p-2 rounded-xl border transition ${
                      dexData?.milestones?.silver
                        ? 'bg-slate-200 text-slate-800 border-slate-300 shadow-2xs'
                        : 'bg-white/60 text-slate-400 border-slate-200 opacity-60'
                    }`}
                  >
                    <span className="block text-sm">🥈</span>
                    <span>10종 달성</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMilestoneCert({
                        title: '🥇 골드 헌터',
                        tier: '15종 수집 달성',
                        reqCount: 15,
                        achieved: dexData?.milestones?.gold,
                        desc: '벌레 15종을 포획한 베테랑 헌터입니다!',
                      })
                    }
                    className={`p-2 rounded-xl border transition ${
                      dexData?.milestones?.gold
                        ? 'bg-yellow-100 text-yellow-900 border-yellow-300 shadow-2xs'
                        : 'bg-white/60 text-slate-400 border-slate-200 opacity-60'
                    }`}
                  >
                    <span className="block text-sm">🥇</span>
                    <span>15종 달성</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMilestoneCert({
                        title: '👑 마스터 헌터',
                        tier: '20종 올클리어',
                        reqCount: 20,
                        achieved: dexData?.milestones?.master,
                        desc: '모든 벌레와 보스를 정복한 전설의 마스터 헌터입니다! 특별 선물을 수령하세요!',
                      })
                    }
                    className={`p-2 rounded-xl border transition ${
                      dexData?.milestones?.master
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white border-yellow-300 shadow-md animate-pulse'
                        : 'bg-white/60 text-slate-400 border-slate-200 opacity-60'
                    }`}
                  >
                    <span className="block text-sm">👑</span>
                    <span>올클리어!</span>
                  </button>
                </div>
              </div>

              {/* 등급 필터 탭 */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
                {[
                  { id: 'ALL', label: '전체 (20)' },
                  { id: 'COMMON', label: '일반 (6)' },
                  { id: 'RARE', label: '레어 (5)' },
                  { id: 'EPIC', label: '에픽 (4)' },
                  { id: 'LEGENDARY', label: '전설 (3)' },
                  { id: 'BOSS', label: '👑 보스 (2)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTierFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition border ${
                      tierFilter === f.id
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* 20종 벌레 카드 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredBugs.map((bug) => {
                  const tierConfig = BUG_TIERS[bug.tier] || BUG_TIERS.COMMON;
                  return (
                    <div
                      key={bug.id}
                      onClick={() => setSelectedBug(bug)}
                      className={`p-3 rounded-2xl border transition text-center cursor-pointer select-none flex flex-col justify-between relative overflow-hidden shadow-2xs ${
                        bug.isCaught
                          ? 'bg-white hover:border-indigo-400 hover:shadow-md'
                          : 'bg-slate-100/90 border-slate-200/80 opacity-70 hover:opacity-90'
                      }`}
                    >
                      {/* 포획 횟수 뱃지 */}
                      {bug.isCaught && (
                        <span className="absolute top-2 right-2 bg-indigo-600 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded-full shadow-2xs">
                          {bug.count}마리
                        </span>
                      )}

                      <div className="space-y-1 pt-1">
                        {/* 벌레 아이콘 (포획: 컬러 / 미포획: 흑백 실루엣) */}
                        <div
                          className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-3xl transition ${
                            bug.isCaught
                              ? `${bug.auraClass} shadow-inner`
                              : 'bg-slate-200 text-slate-400 grayscale'
                          }`}
                        >
                          {bug.isCaught ? bug.emoji : '❓'}
                        </div>

                        {/* 이름 및 등급 */}
                        <div>
                          <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${tierConfig.color}`}>
                            {tierConfig.label}
                          </span>
                          <h4 className="text-xs font-black text-slate-800 mt-1 truncate">
                            {bug.isCaught ? bug.name : '미발견 벌레'}
                          </h4>
                        </div>
                      </div>

                      <div className="pt-2 text-[10px] text-slate-400 font-semibold border-t border-slate-100 mt-2">
                        {bug.isCaught ? (
                          <span className="text-indigo-600 font-bold">✨ 포획 완료</span>
                        ) : (
                          <span>돌발 이벤트 대기</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* 🏆 2. 월간 명예의 전당 탭 */
            <div className="space-y-4">
              {/* 내 순위 요약 배너 */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-2xl shadow-md flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-amber-100">이번 달 나의 사냥 성적</span>
                  <h3 className="text-base font-black">
                    {myRankInfo ? (
                      <span>🏆 {myRankInfo.rank}위 ({myRankInfo.totalCaught}마리 포획)</span>
                    ) : (
                      <span>아직 이번 달 포획 기록이 없습니다</span>
                    )}
                  </h3>
                </div>
                <div className="text-3xl">🎯</div>
              </div>

              {/* 1, 2, 3위 포디움 */}
              {leaderboard.length >= 1 && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {/* 2등 */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center space-y-1 shadow-2xs">
                    <span className="text-2xl block">🥈</span>
                    <span className="text-[11px] font-extrabold text-slate-800 block truncate">
                      {leaderboard[1]?.studentName || '-'}
                    </span>
                    <span className="text-[10px] font-black text-indigo-600 block">
                      {leaderboard[1] ? `${leaderboard[1].totalCaught}마리` : ''}
                    </span>
                  </div>

                  {/* 1등 */}
                  <div className="bg-amber-50 p-3 rounded-2xl border-2 border-amber-300 text-center space-y-1 shadow-md scale-105">
                    <span className="text-3xl block animate-bounce">🥇</span>
                    <span className="text-xs font-black text-amber-950 block truncate">
                      {leaderboard[0]?.studentName || '-'}
                    </span>
                    <span className="text-[11px] font-black text-amber-700 block">
                      {leaderboard[0] ? `${leaderboard[0].totalCaught}마리` : ''}
                    </span>
                  </div>

                  {/* 3등 */}
                  <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200 text-center space-y-1 shadow-2xs">
                    <span className="text-2xl block">🥉</span>
                    <span className="text-[11px] font-extrabold text-amber-900 block truncate">
                      {leaderboard[2]?.studentName || '-'}
                    </span>
                    <span className="text-[10px] font-black text-amber-700 block">
                      {leaderboard[2] ? `${leaderboard[2].totalCaught}마리` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* 전체 랭킹 리스트 */}
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                {leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-bold">
                    아직 이번 달 포획된 벌레가 없습니다. 첫 사냥꾼이 되어보세요!
                  </div>
                ) : (
                  leaderboard.map((item) => {
                    const isMe = item.studentId === user.id;
                    return (
                      <div
                        key={item.studentId}
                        className={`p-3 flex justify-between items-center text-xs ${
                          isMe ? 'bg-indigo-50 font-black text-indigo-950' : 'text-slate-700 font-bold'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                              item.rank === 1
                                ? 'bg-amber-400 text-white'
                                : item.rank === 2
                                ? 'bg-slate-300 text-slate-700'
                                : item.rank === 3
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.rank}
                          </span>
                          <span>{item.studentName} {isMe && '(나)'}</span>
                        </div>
                        <span className="text-indigo-600 font-black">
                          {item.totalCaught}마리 포획
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 벌레 상세 모달 */}
        {selectedBug && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl border border-slate-200 animate-scale-up">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-inner ${selectedBug.auraClass}`}>
                {selectedBug.isCaught ? selectedBug.emoji : '❓'}
              </div>

              <div className="space-y-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${(BUG_TIERS[selectedBug.tier] || BUG_TIERS.COMMON).color}`}>
                  {(BUG_TIERS[selectedBug.tier] || BUG_TIERS.COMMON).label} 등급
                </span>
                <h3 className="text-base font-black text-slate-800">
                  {selectedBug.isCaught ? selectedBug.name : '미발견 신비의 벌레'}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {selectedBug.desc}
                </p>
              </div>

              {selectedBug.isCaught && (
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-left text-xs space-y-1">
                  <div className="flex justify-between text-indigo-950 font-bold">
                    <span>누적 포획:</span>
                    <span className="text-indigo-600 font-black">{selectedBug.count}회</span>
                  </div>
                  {selectedBug.firstCaughtAt && (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>최초 포획:</span>
                      <span>{new Date(selectedBug.firstCaughtAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedBug(null)}
                className="w-full bg-slate-900 text-white font-black py-2.5 rounded-xl text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 마일스톤 인증서 모달 */}
        {milestoneCert && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border-2 border-amber-300 animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-3xl mx-auto shadow-inner">
                🏆
              </div>

              <div className="space-y-1">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10.5px] font-black px-2.5 py-0.5 rounded-full">
                  {milestoneCert.tier}
                </span>
                <h3 className="text-lg font-black text-slate-800 pt-1">{milestoneCert.title}</h3>
                <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                  {milestoneCert.desc}
                </p>
              </div>

              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-950 font-bold space-y-1">
                <span>🎁 선물 수령 안내:</span>
                <p className="text-[11px] font-normal text-amber-800">
                  {milestoneCert.achieved
                    ? '선생님께 이 화면을 보여드리고 달성 선물을 수령하세요!'
                    : `아직 ${milestoneCert.reqCount}종에 도달하지 못했습니다. 돌발 벌레를 더 모아보세요!`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMilestoneCert(null)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-3 rounded-xl text-xs shadow-md"
              >
                확인
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
