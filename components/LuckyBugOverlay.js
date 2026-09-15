'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getActiveLuckyEvent, getRecentFinishedLuckyEvent, catchLuckyBug, hitBossRaid } from '@/lib/luckyBugService';
import { getBugById } from '@/lib/bugCatalog';
import StudentBugDexModal from './StudentBugDexModal';

export default function LuckyBugOverlay() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [catching, setCatching] = useState(false);
  const [winModal, setWinModal] = useState(null); // { rank, rewardText, message, bugInfo }
  const [bossClearModal, setBossClearModal] = useState(null); // { bugInfo, mvp, finisher, rewardText }
  const [missedAlert, setMissedAlert] = useState(null);
  const [bugPosition, setBugPosition] = useState({ top: 35, left: 50, rotate: 0 });
  const [showDexModal, setShowDexModal] = useState(false);

  // 💨 특수 기믹 상태
  const [escapeCount, setEscapeCount] = useState(0);
  const [isTired, setIsTired] = useState(false);
  const [gimmickBubble, setGimmickBubble] = useState(null);

  // 👑 보스 레이드 실시간 상태
  const [bossHp, setBossHp] = useState(30);
  const [bossMaxHp, setBossMaxHp] = useState(30);
  const [myHits, setMyHits] = useState(0);
  const [myHitLimit, setMyHitLimit] = useState(5);
  const [combatLogs, setCombatLogs] = useState([]);
  const [floatingDamages, setFloatingDamages] = useState([]); // [ { id, x, y, damage } ]

  const channelRef = useRef(null);
  const moveTimerRef = useRef(null);
  const tiredTimerRef = useRef(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) return;

    try {
      const parsed = JSON.parse(userData);
      if (parsed.role === 'STUDENT') {
        setUser(parsed);
        initStudent(parsed);
      }
    } catch (e) {
      console.error(e);
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);
      if (tiredTimerRef.current) clearTimeout(tiredTimerRef.current);
    };
  }, []);

  // 🔒 벌레 이벤트가 활성화되면 메인 화면(/student/dashboard)으로 자동 이동
  useEffect(() => {
    if (activeEvent && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/student/dashboard' && currentPath !== '/') {
        router.push('/student/dashboard');
      }
    }
  }, [activeEvent, router]);

  const initStudent = async (studentUser) => {
    try {
      const { data: csData } = await supabase
        .from('class_students')
        .select('class_id')
        .eq('student_id', studentUser.id);

      const classIds = (csData || []).map((cs) => String(cs.class_id));

      await checkActiveEvent(classIds, studentUser.id);

      // 실시간 채널 구독
      const channel = supabase
        .channel('poom-lucky-events')
        .on('broadcast', { event: 'BUG_SPAWNED' }, (payload) => {
          const ev = payload.payload || {};
          if (!ev.classId || classIds.includes(String(ev.classId))) {
            const bugInfo = getBugById(ev.bugId || 'gold_beetle');
            const newEv = {
              id: ev.eventId,
              classId: ev.classId,
              bugId: ev.bugId || 'gold_beetle',
              bugInfo,
              isBossRaid: Boolean(ev.isBossRaid),
              maxHp: Number(ev.maxHp) || 30,
              currentHp: Number(ev.currentHp) || Number(ev.maxHp) || 30,
              perUserHitLimit: Number(ev.perUserHitLimit) || 5,
              targetCount: ev.targetCount || 2,
              rewardText: ev.rewardText || '선생님의 깜짝 선물',
              speedMode: ev.speedMode || bugInfo.defaultSpeed || 'FAST',
              escapeGimmick: ev.escapeGimmick !== false,
            };
            setActiveEvent(newEv);
            setBossHp(newEv.currentHp);
            setBossMaxHp(newEv.maxHp);
            setMyHits(0);
            setMyHitLimit(newEv.perUserHitLimit);
            setCombatLogs([]);
            setEscapeCount(0);
            setIsTired(false);
            setGimmickBubble(null);
            playChimeSound();
            startBugMovement(newEv.speedMode, newEv.isBossRaid);

            if (typeof window !== 'undefined' && window.location.pathname !== '/student/dashboard') {
              router.push('/student/dashboard');
            }
          }
        })
        .on('broadcast', { event: 'BUG_HIT' }, (payload) => {
          const { eventId, currentHp, maxHp, log, studentId, damage } = payload.payload || {};
          setActiveEvent((prev) => {
            if (prev && prev.id === eventId) {
              setBossHp(currentHp);
              if (log) {
                setCombatLogs((prevLogs) => [log, ...prevLogs.slice(0, 4)]);
              }
              return { ...prev, currentHp };
            }
            return prev;
          });
        })
        .on('broadcast', { event: 'BUG_FINISHED' }, (payload) => {
          const { eventId, isBossRaid, mvp, finisher, rewardText, bugInfo } = payload.payload || {};
          setActiveEvent((prev) => {
            if (prev && (!eventId || prev.id === eventId)) {
              if (isBossRaid) {
                setBossClearModal({
                  bugInfo: bugInfo || prev.bugInfo,
                  mvp,
                  finisher,
                  rewardText: rewardText || prev.rewardText,
                });
              } else {
                setMissedAlert('💨 [마감] 방금 선착순 마감되어 벌레가 날아갔습니다! 다음 기회를 노려보세요! ⚡');
                setTimeout(() => setMissedAlert(null), 5000);
              }
              return null;
            }
            return prev;
          });
        })
        .subscribe();

      channelRef.current = channel;
    } catch (e) {
      console.error('initStudent lucky bug error:', e);
    }
  };

  const checkActiveEvent = async (classIds, studentId) => {
    const event = await getActiveLuckyEvent(classIds);
    if (event) {
      setActiveEvent(event);
      setBossHp(event.currentHp);
      setBossMaxHp(event.maxHp);
      setMyHits(event.hitsByUser?.[studentId] || 0);
      setMyHitLimit(event.perUserHitLimit || 5);
      setCombatLogs(event.combatLogs || []);
      setEscapeCount(0);
      setIsTired(false);
      setGimmickBubble(null);
      startBugMovement(event.speedMode, event.isBossRaid);
    } else if (studentId) {
      const finishedEvent = await getRecentFinishedLuckyEvent(classIds, studentId);
      if (finishedEvent) {
        const sessionKey = `seen_finished_bug_${finishedEvent.id}`;
        if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          setMissedAlert(
            `💨 [황금 벌레 마감] 앗! 이번 ${finishedEvent.bugName || '벌레'}는 다른 친구가 먼저 잡았습니다! 다음 돌발 이벤트를 기대해 보세요! ⚡`
          );
          setTimeout(() => setMissedAlert(null), 6000);
        }
      }
    }
  };

  const getIntervalMs = (mode, isBoss = false) => {
    if (isBoss) return 1000; // 보스는 화면을 묵직하게 배회
    if (mode === 'EXTREME') return 100;
    if (mode === 'NORMAL') return 1200;
    return 250;
  };

  const startBugMovement = (speedMode = 'FAST', isBoss = false) => {
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    const interval = getIntervalMs(speedMode, isBoss);

    moveTimerRef.current = setInterval(() => {
      const randomTop = Math.floor(Math.random() * (isBoss ? 45 : 68)) + (isBoss ? 25 : 14);
      const randomLeft = Math.floor(Math.random() * (isBoss ? 55 : 74)) + (isBoss ? 22 : 12);
      const randomRotate = Math.floor(Math.random() * 40) - 20;
      setBugPosition({ top: randomTop, left: randomLeft, rotate: randomRotate });
    }, interval);
  };

  // 💨 일반 벌레 도망치기 핸들러
  const handleEscapeAttempt = (e) => {
    if (!activeEvent?.escapeGimmick || isTired || catching || activeEvent.isBossRaid) return;

    if (escapeCount < 2) {
      e.stopPropagation();
      setEscapeCount((prev) => prev + 1);

      const randomTop = Math.floor(Math.random() * 68) + 14;
      const randomLeft = Math.floor(Math.random() * 74) + 12;
      const randomRotate = Math.floor(Math.random() * 60) - 30;
      setBugPosition({ top: randomTop, left: randomLeft, rotate: randomRotate });

      setGimmickBubble('💨 앗 들켰다!');
      setTimeout(() => setGimmickBubble(null), 700);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40]);
      }
    } else {
      setIsTired(true);
      setGimmickBubble('😵 헥헥... 지쳤다!');
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);

      if (tiredTimerRef.current) clearTimeout(tiredTimerRef.current);
      tiredTimerRef.current = setTimeout(() => {
        setIsTired(false);
        setEscapeCount(0);
        setGimmickBubble(null);
        startBugMovement(activeEvent?.speedMode, activeEvent?.isBossRaid);
      }, 1800);
    }
  };

  // 🎯 메인 클릭/터치 핸들러
  const handleInteract = async (e) => {
    e.stopPropagation();
    if (!activeEvent || !user || catching) return;

    // 1. 일반 벌레 잡기 모드
    if (!activeEvent.isBossRaid) {
      if (activeEvent?.escapeGimmick && !isTired && escapeCount < 2) {
        handleEscapeAttempt(e);
        return;
      }

      setCatching(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 150]);
      }

      try {
        const res = await catchLuckyBug(activeEvent.id, user.id, user.name);
        if (res.success) {
          setWinModal({
            rank: res.rank,
            bugInfo: res.bugInfo || activeEvent.bugInfo,
            rewardText: res.rewardText || '선생님의 깜짝 선물 🎁',
            message: res.message,
          });
          setActiveEvent(null);

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'BUG_CAUGHT',
              payload: { eventId: activeEvent.id, rank: res.rank },
            });
          }
        } else {
          setMissedAlert(res.message || '앗! 아쉽게도 방금 마감되었습니다! 💨');
          setActiveEvent(null);
          setTimeout(() => setMissedAlert(null), 5000);
        }
      } catch (err) {
        console.error('Catch error:', err);
      } finally {
        setCatching(false);
      }
      return;
    }

    // 2. 👑 보스 레이드 공격 모드
    if (myHits >= myHitLimit) {
      setGimmickBubble(`⚠️ 최대 타격 수(${myHitLimit}회)를 모두 사용했습니다!`);
      setTimeout(() => setGimmickBubble(null), 2000);
      return;
    }

    setCatching(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60]);
    }

    // 플로팅 대미지 숫자 추가
    const dmgId = Date.now() + Math.random();
    setFloatingDamages((prev) => [
      ...prev,
      { id: dmgId, x: bugPosition.left + (Math.random() * 10 - 5), y: bugPosition.top - 5, dmg: 5 },
    ]);
    setTimeout(() => {
      setFloatingDamages((prev) => prev.filter((d) => d.id !== dmgId));
    }, 900);

    try {
      const res = await hitBossRaid(activeEvent.id, user.id, user.name, 5);
      if (res.success) {
        setBossHp(res.currentHp);
        setMyHits(res.myHits);
        setMyHitLimit(res.myLimit);

        const newLog = `${user.name} 학생이 보스 타격! (-5 HP)`;

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'BUG_HIT',
            payload: {
              eventId: activeEvent.id,
              currentHp: res.currentHp,
              maxHp: res.maxHp,
              studentId: user.id,
              damage: 5,
              log: { id: Date.now(), text: newLog },
            },
          });
        }

        // 보스 격파 성공!
        if (res.isCleared) {
          setBossClearModal({
            bugInfo: res.bugInfo || activeEvent.bugInfo,
            mvp: res.mvp,
            finisher: res.finisher,
            rewardText: res.rewardText || activeEvent.rewardText,
          });
          setActiveEvent(null);

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'BUG_FINISHED',
              payload: {
                eventId: activeEvent.id,
                isBossRaid: true,
                bugInfo: res.bugInfo || activeEvent.bugInfo,
                mvp: res.mvp,
                finisher: res.finisher,
                rewardText: res.rewardText || activeEvent.rewardText,
              },
            });
          }
        }
      } else {
        if (res.reason === 'HIT_LIMIT') {
          setGimmickBubble(`⚠️ ${res.message}`);
          setTimeout(() => setGimmickBubble(null), 3000);
        } else {
          setMissedAlert(res.message);
          setActiveEvent(null);
          setTimeout(() => setMissedAlert(null), 5000);
        }
      }
    } catch (err) {
      console.error('Hit boss error:', err);
    } finally {
      setCatching(false);
    }
  };

  const playChimeSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  const bugInfo = activeEvent?.bugInfo || getBugById('gold_beetle');
  const hpPercent = bossMaxHp > 0 ? Math.round((bossHp / bossMaxHp) * 100) : 100;
  const isEnraged = activeEvent?.isBossRaid && hpPercent <= 50 && hpPercent > 20;
  const isGroggy = activeEvent?.isBossRaid && hpPercent <= 20;

  return (
    <>
      {/* 🛡️ 1. 전체 화면 터치 방어막 & 상단 HUD */}
      {activeEvent && (
        <>
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px] cursor-crosshair select-none"
          />

          {/* 👑 A. 보스 레이드 전용 상단 HUD */}
          {activeEvent.isBossRaid ? (
            <div className="fixed top-3 left-1/2 transform -translate-x-1/2 z-45 w-[92%] max-w-md bg-slate-950/90 text-white p-3 rounded-2xl shadow-2xl border-2 border-rose-500/80 backdrop-blur-md space-y-2 animate-scale-up pointer-events-none">
              <div className="flex justify-between items-center text-xs font-black">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl animate-bounce">👑</span>
                  <span className="text-rose-400 font-extrabold">{bugInfo.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                    isGroggy
                      ? 'bg-amber-500 text-white animate-pulse'
                      : isEnraged
                      ? 'bg-rose-600 text-white animate-ping'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {isGroggy ? '😵 그로기 피니시 찬스!' : isEnraged ? '🔥 폭주 분노 모드' : '⚔️ 협동 레이드'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-rose-400 text-xs font-black">HP {bossHp} / {bossMaxHp}</span>
                  <span className="text-[10px] text-slate-400 ml-1">({hpPercent}%)</span>
                </div>
              </div>

              {/* 보스 실시간 HP 바 */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    hpPercent > 50
                      ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                      : hpPercent > 20
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : 'bg-gradient-to-r from-rose-600 to-red-700 animate-pulse'
                  }`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>

              {/* 내 공격 횟수 및 실시간 자막 티커 */}
              <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-300 pt-0.5">
                <div className="flex items-center gap-1">
                  <span>내 타격:</span>
                  <span className={`font-black ${myHits >= myHitLimit ? 'text-rose-400' : 'text-yellow-300'}`}>
                    {myHits} / {myHitLimit}회
                  </span>
                </div>

                {combatLogs.length > 0 && (
                  <div className="text-amber-300 font-extrabold truncate max-w-[200px] animate-fade-in text-right">
                    ⚔️ {combatLogs[0]?.text}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 🚨 B. 일반 벌레 상단 배너 */
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-45 bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 text-white font-black text-xs px-4 py-2 rounded-full shadow-2xl border border-yellow-200 animate-bounce flex items-center gap-2 pointer-events-none whitespace-nowrap">
              <span className="text-sm">{bugInfo.emoji}</span>
              <span>돌발 {bugInfo.name} 출현! 화면의 벌레를 터치하세요!</span>
            </div>
          )}
        </>
      )}

      {/* 💥 플로팅 대미지 이펙트 (-5! CRITICAL) */}
      {floatingDamages.map((dmg) => (
        <div
          key={dmg.id}
          style={{ top: `${dmg.y}%`, left: `${dmg.x}%` }}
          className="fixed z-55 text-red-400 font-black text-xl sm:text-2xl pointer-events-none animate-bounce drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        >
          💥 -{dmg.dmg} HP!
        </div>
      ))}

      {/* 🐛 2. 화면 위를 이동하는 벌레 / 거대 보스 (z-50) */}
      {activeEvent && (
        <div
          onClick={handleInteract}
          onMouseEnter={activeEvent.escapeGimmick && !isTired ? handleEscapeAttempt : undefined}
          style={{
            top: `${bugPosition.top}%`,
            left: `${bugPosition.left}%`,
            transform: `translate(-50%, -50%) rotate(${isTired || isGroggy ? 0 : bugPosition.rotate || 0}deg)`,
          }}
          className={`fixed z-50 cursor-pointer select-none transition-all duration-300 ease-out ${
            activeEvent.isBossRaid ? 'scale-135 sm:scale-150' : isTired ? 'scale-125 animate-pulse' : 'hover:scale-110 active:scale-95'
          }`}
        >
          <div className="relative group">
            {/* 오라 효과 */}
            <div
              className={`absolute -inset-4 rounded-full blur-md animate-pulse ${
                isEnraged
                  ? 'bg-rose-600/90 animate-ping'
                  : isGroggy
                  ? 'bg-amber-400/80'
                  : bugInfo.auraClass || 'bg-amber-400/60'
              }`}
            />

            <div
              className={`relative border-2 shadow-2xl rounded-full ${
                activeEvent.isBossRaid ? 'w-22 h-22 sm:w-26 sm:h-26 border-rose-300' : 'w-16 h-16 sm:w-20 sm:h-20 border-yellow-200'
              } flex flex-col items-center justify-center text-center p-1 bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500`}
            >
              {/* 👑 보스 전용 머리 위 황금 왕관 */}
              {activeEvent.isBossRaid && (
                <span className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl animate-bounce drop-shadow-md z-10">
                  👑
                </span>
              )}

              {/* 곤충 캐릭터 및 속성 뱃지 */}
              <div className="relative">
                <span
                  className={`text-3xl sm:text-4xl inline-block ${
                    isTired || isGroggy ? 'animate-bounce' : 'animate-spin'
                  }`}
                  style={{ animationDuration: isEnraged ? '0.5s' : '3s' }}
                >
                  {isTired || isGroggy ? '😵' : bugInfo.emoji}
                </span>

                {/* 특수 속성 심볼 (⚡, 🔥, ❄️, ✨, 💎, 🌈 등) */}
                {bugInfo.iconSymbol && bugInfo.iconSymbol !== '👑' && !isTired && !isGroggy && (
                  <span className="absolute -right-2 -top-1 text-xs sm:text-sm animate-ping">
                    {bugInfo.iconSymbol}
                  </span>
                )}
              </div>

              <span className="text-[9px] sm:text-[10px] font-black leading-none mt-0.5 px-1.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap bg-yellow-100/95 text-amber-950">
                {activeEvent.isBossRaid
                  ? myHits >= myHitLimit
                    ? '타격 완료! 👏'
                    : '공격하기! ⚔️'
                  : isTired
                  ? '지금 잡기! 🎯'
                  : '터치해서 포획!'}
              </span>
            </div>

            {/* 말풍선 */}
            {gimmickBubble && (
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap shadow-xl border border-amber-400 animate-bounce">
                {gimmickBubble}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 💥 3. 마감 안내 토스트 */}
      {missedAlert && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-slate-950/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-500/40 text-xs sm:text-sm font-black flex items-center gap-3 animate-fade-in backdrop-blur-md max-w-md w-[92%] sm:w-auto text-center justify-center">
          <span className="text-xl shrink-0 animate-bounce">💨</span>
          <span className="leading-snug">{missedAlert}</span>
        </div>
      )}

      {/* 🎉 4-A. 일반 벌레 포획 축하 팝업 */}
      {winModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-2 border-amber-300 text-center space-y-4 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-4xl mx-auto shadow-inner">
              {winModal.bugInfo?.emoji || '🏆'}
            </div>

            <div className="space-y-1">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full">
                {winModal.bugInfo?.name} {winModal.rank}등 포획 성공! 🎉
              </span>
              <h3 className="text-xl font-black text-slate-800 pt-1">축하합니다!</h3>
              <p className="text-xs text-slate-500 font-semibold">
                순발력으로 벌레를 잡고 도감에 등록되었습니다.
              </p>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-1 text-left">
              <span className="text-[11px] font-bold text-amber-800 block">🎁 당첨 선물</span>
              <p className="text-sm font-black text-amber-950">{winModal.rewardText}</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setWinModal(null);
                  setShowDexModal(true);
                }}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold py-3 rounded-2xl text-xs transition"
              >
                📖 도감 확인
              </button>
              <button
                type="button"
                onClick={() => setWinModal(null)}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-black py-3 rounded-2xl text-xs shadow-md transition"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👑 4-B. 보스 레이드 격파 축하 모달 (엔딩 크레딧) */}
      {bossClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-rose-400 text-center space-y-4 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-4xl mx-auto shadow-lg text-white">
              👑
            </div>

            <div className="space-y-1">
              <span className="bg-rose-100 text-rose-900 border border-rose-300 text-xs font-black px-3 py-1 rounded-full">
                {bossClearModal.bugInfo?.name} 레이드 격파 완료! 🎆
              </span>
              <h3 className="text-xl font-black text-slate-900 pt-1">반 전체 협동 승리!</h3>
              <p className="text-xs text-slate-500 font-semibold">
                모두의 힘을 모아 강력한 보스를 쓰러뜨렸습니다.
              </p>
            </div>

            {/* MVP & 피니셔 */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <span className="text-[10px] text-amber-800 block">👑 딜량 1등 (MVP)</span>
                <span className="text-amber-950 font-black truncate block">{bossClearModal.mvp?.damage || 0} 데미지</span>
              </div>
              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <span className="text-[10px] text-rose-800 block">⚡ 럭키 피니셔 (막타)</span>
                <span className="text-rose-950 font-black truncate block">{bossClearModal.finisher?.studentName || '학생'}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left text-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-600 block">🎁 단체 선물</span>
              <p className="text-sm font-black text-slate-900">{bossClearModal.rewardText}</p>
              <span className="text-[10px] text-slate-500 block">참여한 모든 학생에게 보스 도감이 등록되었습니다.</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBossClearModal(null);
                  setShowDexModal(true);
                }}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold py-3 rounded-2xl text-xs transition"
              >
                📖 보스 도감 보기
              </button>
              <button
                type="button"
                onClick={() => setBossClearModal(null)}
                className="flex-1 bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black py-3 rounded-2xl text-xs shadow-md transition"
              >
                축하합니다!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📖 5. 도감 모달 연결 */}
      {showDexModal && user && (
        <StudentBugDexModal user={user} onClose={() => setShowDexModal(false)} />
      )}
    </>
  );
}
