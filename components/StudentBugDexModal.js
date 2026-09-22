'use client';

import { useState, useEffect, useRef } from 'react';
import { BUG_TIERS, BUG_CATALOG } from '@/lib/bugCatalog';

export default function StudentBugDexModal({ user, onClose }) {
  const [tab, setTab] = useState('DEX'); // 'DEX' | 'TERRARIUM' | 'LAB' | 'LEADERBOARD'
  const [tierFilter, setTierFilter] = useState('ALL');
  const [dexData, setDexData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState(null);
  const [milestoneCert, setMilestoneCert] = useState(null); // { title, tier, reqCount, desc }

  // 🌿 사육장(Terrarium) 인터랙션 상태
  const [bugReactions, setBugReactions] = useState({}); // { [instanceId]: { heart: true, msg: string } }
  const [terrariumPositions, setTerrariumPositions] = useState({});

  // ⚗️ 연구실(Lab) 합성 상태
  const [synthTier, setSynthTier] = useState('COMMON');
  const [synthLoading, setSynthLoading] = useState(false);
  const [hatchState, setHatchState] = useState(null); // null | 'SHAKING' | 'CRACKING' | 'REVEALED'
  const [hatchResult, setHatchResult] = useState(null); // { isUpgrade, hatchedBug, targetTier, consumedTier }
  const [synthError, setSynthError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dexRes, leaderboardRes] = await Promise.all([
        fetch('/api/lucky-bug/dex'),
        fetch('/api/lucky-bug/leaderboard'),
      ]);
      const dexJson = await dexRes.json();
      const leaderboardJson = await leaderboardRes.json();
      setDexData(dexJson.dex);
      setLeaderboard(leaderboardJson.leaderboard || []);
      if (dexJson.dex?.terrariumBugs) {
        randomizeTerrariumPositions(dexJson.dex.terrariumBugs);
      }
    } catch (e) {
      console.error('Dex load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 🎲 사육장 벌레 완전 무작위 위치 생성 함수 (0~360도 무작위 각도 & 위치)
  const randomizeTerrariumPositions = (bugs = dexData?.terrariumBugs) => {
    if (!bugs || bugs.length === 0) return;
    const positions = {};
    bugs.forEach((bug) => {
      positions[bug.instanceId] = {
        x: Math.floor(Math.random() * 70) + 15, // 15% ~ 85%
        y: Math.floor(Math.random() * 56) + 18, // 18% ~ 74%
        rot: Math.floor(Math.random() * 360), // 0 ~ 359도 전방위 회전
      };
    });
    setTerrariumPositions(positions);
  };

  // 🌿 사육장 진입 시마다 완전 랜덤 배치 & 0~360도 회전 후 얼굴(머리) 방향으로 전진 이동
  useEffect(() => {
    if (tab !== 'TERRARIUM' || !dexData?.terrariumBugs?.length) return;

    // 사육장 탭에 들어올 때마다 벌레들의 위치와 0~360도 각도를 완전 랜덤으로 즉시 재배치
    randomizeTerrariumPositions(dexData.terrariumBugs);

    const interval = setInterval(() => {
      setTerrariumPositions((prev) => {
        const nextPos = { ...prev };
        dexData.terrariumBugs.forEach((bug) => {
          const cur = nextPos[bug.instanceId] || {
            x: 50,
            y: 50,
            rot: Math.floor(Math.random() * 360),
          };

          // 1. 0~360도 회전 결정 (40% 확률로 새로운 각도 탐색, 60% 확률로 부드러운 전방 조향)
          let headingRot = cur.rot;
          if (Math.random() < 0.4) {
            headingRot = (cur.rot + (Math.floor(Math.random() * 240) - 120) + 360) % 360;
          } else {
            headingRot = (cur.rot + (Math.floor(Math.random() * 50) - 25) + 360) % 360;
          }

          // 2. 머리(얼굴)가 향한 각도 방향으로 전진 거리(벡터) 계산
          // 0° = 위(-y), 90° = 오른쪽(+x), 180° = 아래(+y), 270° = 왼쪽(-x)
          const step = Math.random() * 7 + 6; // 6% ~ 13% 전진
          const rad = (headingRot * Math.PI) / 180;
          let nextX = cur.x + step * Math.sin(rad);
          let nextY = cur.y - step * Math.cos(rad);

          // 3. 사육장 유리벽 충돌 검사 (벽에 닿으면 사육장 중심 방향으로 회전 전환)
          if (nextX < 12 || nextX > 86 || nextY < 16 || nextY > 74) {
            const centerX = 49;
            const centerY = 45;
            const dx = centerX - cur.x;
            const dy = cur.y - centerY;
            const centerRad = Math.atan2(dx, dy);
            headingRot = Math.round((centerRad * 180 / Math.PI + (Math.random() * 40 - 20) + 360) % 360);
            const bounceRad = (headingRot * Math.PI) / 180;
            nextX = Math.max(12, Math.min(86, cur.x + (step * 0.8) * Math.sin(bounceRad)));
            nextY = Math.max(16, Math.min(74, cur.y - (step * 0.8) * Math.cos(bounceRad)));
          }

          nextPos[bug.instanceId] = {
            x: Math.round(nextX * 10) / 10,
            y: Math.round(nextY * 10) / 10,
            rot: Math.round(headingRot),
          };
        });
        return nextPos;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [tab, dexData?.terrariumBugs]);

  // 🌿 사육장 벌레 터치 인터랙션
  const handleTerrariumBugClick = (instanceId, bugName) => {
    const messages = [
      '❤️ 뾱!',
      '🌿 기분 최고!',
      '✨ 꼬물꼬물~',
      '💖 안녕 친구야!',
      '🌱 냠냠 맛있다!',
      '⚡ 번쩍!',
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

    setBugReactions((prev) => ({
      ...prev,
      [instanceId]: { active: true, msg: randomMsg },
    }));

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40]);
    }

    // 터치 시 놀라서 점프하며 방향 전환
    setTerrariumPositions((prev) => {
      const current = prev[instanceId] || { x: 50, y: 50, rot: 0 };
      const leapRot = (current.rot + (Math.floor(Math.random() * 180) - 90) + 360) % 360;
      const rad = (leapRot * Math.PI) / 180;
      const newX = Math.max(12, Math.min(86, current.x + 8 * Math.sin(rad)));
      const newY = Math.max(16, Math.min(74, current.y - 8 * Math.cos(rad)));
      return { ...prev, [instanceId]: { x: newX, y: newY, rot: leapRot } };
    });

    setTimeout(() => {
      setBugReactions((prev) => ({
        ...prev,
        [instanceId]: null,
      }));
    }, 1400);
  };

  // ⚗️ 3마리 벌레 합성 & 부화 실행
  const handleStartSynthesis = async () => {
    if (synthLoading) return;
    setSynthError(null);

    const availableCount = dexData?.inventoryByTier?.[synthTier] || 0;
    if (availableCount < 3) {
      setSynthError(`벌레가 부족합니다. ${synthTier} 등급 벌레가 최소 3마리 필요합니다.`);
      return;
    }

    setSynthLoading(true);
    setHatchState('SHAKING');

    try {
      const synthRes = await fetch('/api/lucky-bug/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: synthTier }),
      });
      const res = await synthRes.json();
      if (!res.success) {
        setSynthError(res.error || '합성에 실패했습니다.');
        setHatchState(null);
        setSynthLoading(false);
        return;
      }

      setHatchResult(res);

      // 🥚 부화 애니메이션 단계 진행
      setTimeout(() => {
        setHatchState('CRACKING');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([60, 40, 80]);
        }
      }, 1200);

      setTimeout(() => {
        setHatchState('REVEALED');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 150, 50, 200]);
        }
        fetchData(); // 도감 및 사육장 즉시 갱신
      }, 2600);
    } catch (err) {
      console.error('Synthesis error:', err);
      setSynthError('합성 중 오류가 발생했습니다.');
      setHatchState(null);
    } finally {
      setSynthLoading(false);
    }
  };

  const filteredBugs = (dexData?.bugList || []).filter((bug) => {
    if (tierFilter === 'ALL') return true;
    return bug.tier === tierFilter;
  });

  const myRankInfo = leaderboard.find((r) => r.studentId === user.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl animate-bounce">📖</span>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight flex items-center gap-2">
                <span>품수학 20종 벌레 컬렉션</span>
                <span className="bg-yellow-400/20 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-300/30">
                  도감 & 연구실
                </span>
              </h2>
              <p className="text-xs text-indigo-200 font-semibold">
                돌발 벌레 수집, 테라리움 사육장, 3마리 알 부화 연구소
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

        {/* 4분할 탭 바 (모바일 스크롤 없이 1줄로 완벽 노출) */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 p-1.5 gap-1 shrink-0">
          <button
            onClick={() => setTab('DEX')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              tab === 'DEX'
                ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📖 도감</span>
            {dexData && (
              <span className="bg-indigo-100 text-indigo-800 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full">
                {dexData.caughtKindsCount}/20
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('TERRARIUM')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              tab === 'TERRARIUM'
                ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🌿 사육장</span>
            {dexData?.terrariumBugs?.length > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full">
                {dexData.terrariumBugs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('LAB')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              tab === 'LAB'
                ? 'bg-white text-purple-900 shadow-xs border border-purple-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>⚗️ 연구실</span>
          </button>

          <button
            onClick={() => setTab('LEADERBOARD')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              tab === 'LEADERBOARD'
                ? 'bg-white text-amber-900 shadow-xs border border-amber-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🏆 랭킹</span>
            {myRankInfo && (
              <span className="bg-amber-100 text-amber-900 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full">
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
            /* ========================================================
               1. 📖 20종 도감 탭
               ======================================================== */
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
                          className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-3xl relative transition ${
                            bug.isCaught
                              ? `${bug.auraClass} shadow-inner`
                              : 'bg-slate-200 text-slate-400 grayscale'
                          }`}
                        >
                          {bug.isCaught && bug.hasCrown && (
                            <span className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 text-sm drop-shadow animate-bounce">
                              👑
                            </span>
                          )}
                          {bug.isCaught ? bug.emoji : '❓'}
                          {bug.isCaught && bug.iconSymbol && bug.iconSymbol !== '👑' && (
                            <span className="absolute -bottom-1 -right-1 text-xs">
                              {bug.iconSymbol}
                            </span>
                          )}
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
          ) : tab === 'TERRARIUM' ? (
            /* ========================================================
               2. 🌿 내 사육장 (Terrarium) 탭
               ======================================================== */
            <div className="space-y-3">
              {/* 테라리움 소개 배너 */}
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌿</span>
                  <div>
                    <h3 className="font-black text-emerald-950">유리 테라리움 생태 사육장</h3>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      수집한 벌레들을 터치하면 반응합니다! (총 {dexData?.terrariumBugs?.length || 0}마리 서식 중)
                    </p>
                  </div>
                </div>
                <div className="text-[10px] bg-emerald-200/70 text-emerald-900 px-2 py-1 rounded-xl font-bold">
                  온도 24°C • 습도 65%
                </div>
              </div>

              {/* 유리 테라리움 사육장 컨테이너 */}
              <div className="relative w-full h-80 sm:h-96 rounded-3xl overflow-hidden border-4 border-emerald-700/60 shadow-2xl bg-gradient-to-b from-teal-900 via-emerald-950 to-stone-900 select-none">
                {/* 유리 반사광 & 테라리움 내부 데코 */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/15 via-transparent to-black/40" />
                <div className="absolute top-2 left-4 text-emerald-300/30 text-xs font-mono font-bold tracking-widest pointer-events-none">
                  POOM ECO-TERRARIUM GLASS
                </div>

                {/* 하단 잔디/이끼 바닥 */}
                <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-emerald-950 via-emerald-900/80 to-transparent flex items-end justify-around px-4 pointer-events-none opacity-80">
                  <span className="text-2xl">🌱</span>
                  <span className="text-xl">🌿</span>
                  <span className="text-3xl">🍄</span>
                  <span className="text-2xl">🌾</span>
                  <span className="text-xl">🪵</span>
                  <span className="text-2xl">🌿</span>
                </div>

                {/* 사육장 내 벌레 인스턴스들 */}
                {dexData?.terrariumBugs?.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <span className="text-4xl">🪴</span>
                    <p className="text-sm font-black text-emerald-200">
                      아직 사육장에 벌레가 없습니다.
                    </p>
                    <p className="text-xs text-emerald-400/80 max-w-xs">
                      돌발 벌레를 잡거나 연구실에서 알을 부화시켜 나만의 테라리움을 채워보세요!
                    </p>
                  </div>
                ) : (
                  dexData?.terrariumBugs?.map((bug) => {
                    const pos = terrariumPositions[bug.instanceId] || { x: 50, y: 50 };
                    const react = bugReactions[bug.instanceId];
                    return (
                      <div
                        key={bug.instanceId}
                        onClick={() => handleTerrariumBugClick(bug.instanceId, bug.name)}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute cursor-pointer transition-all duration-700 ease-out select-none group ${
                          react?.active ? 'scale-135 -translate-y-2' : 'hover:scale-120 active:scale-90'
                        }`}
                      >
                        {/* 터치 시 말풍선 / 하트 */}
                        {react?.active && (
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white/95 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border border-emerald-400 whitespace-nowrap animate-bounce z-20">
                            {react.msg}
                          </div>
                        )}

                        {/* 곤충 본체 (원형 배경 제거) */}
                        <div className="relative flex flex-col items-center">
                          {bug.hasCrown && (
                            <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-sm drop-shadow-md z-10 animate-bounce">
                              👑
                            </span>
                          )}
                          <span
                            className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] select-none inline-block transition-transform duration-700"
                            style={{
                              transform: `rotate(${pos.rot || 0}deg)`,
                            }}
                          >
                            {bug.emoji}
                          </span>

                          <span className="text-[9px] font-black text-emerald-100 bg-black/60 px-1.5 py-0.2 rounded-full mt-0.5 truncate max-w-[70px] shadow-xs">
                            {bug.name}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : tab === 'LAB' ? (
            /* ========================================================
               3. ⚗️ 벌레 연구실 (3마리 합성 & 알 부화) 탭
               ======================================================== */
            <div className="space-y-4">
              {/* 연구실 안내 헤더 배너 */}
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white p-4 rounded-2xl shadow-md space-y-1 border border-purple-500/30">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-spin" style={{ animationDuration: '6s' }}>⚗️</span>
                  <h3 className="text-sm sm:text-base font-black">
                    3마리 벌레 합성 & 신비의 알 부화 연구소
                  </h3>
                </div>
                <p className="text-xs text-purple-200 leading-relaxed font-semibold">
                  같은 등급 벌레 3마리를 소모하여 새로운 벌레 알을 부화시킵니다!
                  미수집 벌레가 우선적으로 선출되며, 행운의 확률로 상위 등급이 탄생합니다.
                </p>
              </div>

              {/* 합성 오류 메시지 */}
              {synthError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold p-3 rounded-2xl flex items-center gap-2 animate-fade-in">
                  <span>⚠️</span>
                  <span>{synthError}</span>
                </div>
              )}

              {/* 등급별 재료 선택 카드 (일반, 레어, 에픽, 전설) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    tier: 'COMMON',
                    label: '일반 합성',
                    emoji: '🟢',
                    color: 'border-emerald-300 bg-emerald-50/70',
                    rates: '85% 일반 / 15% 레어 승급',
                  },
                  {
                    tier: 'RARE',
                    label: '레어 합성',
                    emoji: '🔵',
                    color: 'border-sky-300 bg-sky-50/70',
                    rates: '92% 레어 / 8% 에픽 승급',
                  },
                  {
                    tier: 'EPIC',
                    label: '에픽 합성',
                    emoji: '🟣',
                    color: 'border-purple-300 bg-purple-50/70',
                    rates: '97% 에픽 / 3% 전설 승급',
                  },
                  {
                    tier: 'LEGENDARY',
                    label: '전설 합성',
                    emoji: '🟡',
                    color: 'border-amber-300 bg-amber-50/70',
                    rates: '99.5% 전설 / 0.5% 보스 승급',
                  },
                ].map((item) => {
                  const count = dexData?.inventoryByTier?.[item.tier] || 0;
                  const canSynth = count >= 3;
                  const isSelected = synthTier === item.tier;

                  return (
                    <div
                      key={item.tier}
                      onClick={() => setSynthTier(item.tier)}
                      className={`p-3 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between text-center relative ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/90 shadow-md scale-102'
                          : `${item.color} hover:border-indigo-300`
                      }`}
                    >
                      {/* 선택 표시 뱃지 */}
                      {isSelected && (
                        <span className="absolute -top-2 right-2 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          선택됨
                        </span>
                      )}

                      <div className="space-y-1">
                        <span className="text-2xl block">{item.emoji}</span>
                        <h4 className="text-xs font-black text-slate-800">{item.label}</h4>
                        <div className="text-xs font-extrabold">
                          <span className={canSynth ? 'text-indigo-600' : 'text-slate-500'}>
                            보유: {count}마리
                          </span>
                          <span className="text-slate-400 text-[10px]"> / 3마리</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 mt-2 text-[9.5px] font-bold text-slate-500 leading-tight">
                        {item.rates}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 합성 대기실 & 실행 버튼 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-slate-500 font-bold">선택된 합성 등급:</span>
                    <h4 className="font-black text-slate-900 text-sm">
                      {BUG_TIERS[synthTier]?.label} 등급 3마리 합성
                    </h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-500 font-bold">합성 가능 횟수:</span>
                    <span className="text-indigo-600 font-black text-sm block">
                      {Math.floor((dexData?.inventoryByTier?.[synthTier] || 0) / 3)}회 가능
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartSynthesis}
                  disabled={(dexData?.inventoryByTier?.[synthTier] || 0) < 3 || synthLoading}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 ${
                    (dexData?.inventoryByTier?.[synthTier] || 0) >= 3 && !synthLoading
                      ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 text-white active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  }`}
                >
                  <span className="text-base">⚗️</span>
                  <span>
                    {(dexData?.inventoryByTier?.[synthTier] || 0) >= 3
                      ? `${BUG_TIERS[synthTier]?.label} 3마리 합성 및 알 부화 시작`
                      : `재료 벌레가 부족합니다 (보유: ${dexData?.inventoryByTier?.[synthTier] || 0} / 3마리)`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================
               4. 🏆 월간 랭킹 탭
               ======================================================== */
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

        {/* 🥚 5. 알 부화 애니메이션 & 결과 발표 모달 */}
        {hatchState && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl border-2 border-purple-400 animate-scale-up">
              
              {/* 알 흔들림 단계 */}
              {hatchState === 'SHAKING' && (
                <div className="py-6 space-y-3">
                  <div className="text-7xl animate-bounce">
                    🥚
                  </div>
                  <h3 className="text-lg font-black text-slate-900 animate-pulse">
                    신비의 알이 흔들리고 있습니다...
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    3마리의 정기가 모여 새로운 생명이 탄생합니다!
                  </p>
                </div>
              )}

              {/* 알 깨짐 단계 */}
              {hatchState === 'CRACKING' && (
                <div className="py-6 space-y-3">
                  <div className="text-7xl animate-ping">
                    🐣✨
                  </div>
                  <h3 className="text-lg font-black text-purple-600">
                    알이 갈라지며 빛이 뿜어져 나옵니다! 💥
                  </h3>
                  <p className="text-xs text-purple-800 font-bold">
                    과연 어떤 벌레가 탄생할까요?!
                  </p>
                </div>
              )}

              {/* 부화 완료 결과 발표 */}
              {hatchState === 'REVEALED' && hatchResult?.hatchedBug && (
                <div className="space-y-4">
                  {/* 승급 여부 뱃지 */}
                  {hatchResult.isUpgrade ? (
                    <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-white font-black text-xs px-3 py-1 rounded-full shadow-md animate-bounce inline-block">
                      🚀 등급 승급 대성공! ({BUG_TIERS[hatchResult.hatchedBug.tier]?.label})
                    </span>
                  ) : (
                    <span className="bg-purple-100 text-purple-900 border border-purple-300 font-black text-xs px-3 py-1 rounded-full inline-block">
                      🐣 새로운 벌레 부화 성공!
                    </span>
                  )}

                  {/* 벌레 아이콘 */}
                  <div
                    className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl shadow-2xl relative border-2 border-white ${
                      hatchResult.hatchedBug.auraClass || 'bg-purple-100'
                    }`}
                  >
                    {hatchResult.hatchedBug.hasCrown && (
                      <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-2xl drop-shadow animate-bounce">
                        👑
                      </span>
                    )}
                    <span>{hatchResult.hatchedBug.emoji}</span>
                  </div>

                  <div className="space-y-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${(BUG_TIERS[hatchResult.hatchedBug.tier] || BUG_TIERS.COMMON).color}`}>
                      {(BUG_TIERS[hatchResult.hatchedBug.tier] || BUG_TIERS.COMMON).label} 등급
                    </span>
                    <h3 className="text-xl font-black text-slate-900">
                      {hatchResult.hatchedBug.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed px-2">
                      {hatchResult.hatchedBug.desc}
                    </p>
                  </div>

                  <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-xs text-purple-950 font-bold text-center">
                    ✨ 도감 및 테라리움 사육장에 등록되었습니다!
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setHatchState(null);
                      setHatchResult(null);
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 text-white font-black py-3 rounded-2xl text-xs shadow-md transition"
                  >
                    확인 완료!
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* 벌레 상세 모달 */}
        {selectedBug && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl border border-slate-200 animate-scale-up">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl relative shadow-inner ${selectedBug.auraClass}`}>
                {selectedBug.isCaught && selectedBug.hasCrown && (
                  <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-lg drop-shadow animate-bounce">
                    👑
                  </span>
                )}
                {selectedBug.isCaught ? selectedBug.emoji : '❓'}
                {selectedBug.isCaught && selectedBug.iconSymbol && selectedBug.iconSymbol !== '👑' && (
                  <span className="absolute -bottom-1 -right-1 text-sm">
                    {selectedBug.iconSymbol}
                  </span>
                )}
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
