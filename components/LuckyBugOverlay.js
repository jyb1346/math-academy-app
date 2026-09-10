'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveLuckyEvent, getRecentFinishedLuckyEvent, catchLuckyBug } from '@/lib/luckyBugService';

export default function LuckyBugOverlay() {
  const [user, setUser] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [catching, setCatching] = useState(false);
  const [winModal, setWinModal] = useState(null); // { rank, rewardText, message }
  const [missedAlert, setMissedAlert] = useState(null);
  const [bugPosition, setBugPosition] = useState({ top: 30, left: 40, rotate: 0 });

  // 💨 특수 기믹 상태 (도망 횟수 및 지침 상태)
  const [escapeCount, setEscapeCount] = useState(0);
  const [isTired, setIsTired] = useState(false);
  const [gimmickBubble, setGimmickBubble] = useState(null);

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

  const initStudent = async (studentUser) => {
    try {
      // 1. 학생의 소속 반 ID 목록 조회
      const { data: csData } = await supabase
        .from('class_students')
        .select('class_id')
        .eq('student_id', studentUser.id);

      const classIds = (csData || []).map((cs) => String(cs.class_id));

      // 2. 현재 활성화된 벌레 이벤트 확인 또는 최근 마감 안내 확인
      await checkActiveEvent(classIds, studentUser.id);

      // 3. 실시간 Supabase Realtime 채널 구독
      const channel = supabase
        .channel('poom-lucky-events')
        .on('broadcast', { event: 'BUG_SPAWNED' }, (payload) => {
          const { eventId, classId, targetCount, rewardText, speedMode, escapeGimmick } = payload.payload || {};
          // 내 반 또는 전체 대상인지 확인
          if (!classId || classIds.includes(String(classId))) {
            const newEv = {
              id: eventId,
              classId,
              targetCount,
              rewardText,
              speedMode: speedMode || 'FAST',
              escapeGimmick: escapeGimmick !== false,
            };
            setActiveEvent(newEv);
            setEscapeCount(0);
            setIsTired(false);
            setGimmickBubble(null);
            playChimeSound();
            startBugMovement(newEv.speedMode);
          }
        })
        .on('broadcast', { event: 'BUG_FINISHED' }, (payload) => {
          const { eventId } = payload.payload || {};
          setActiveEvent((prev) => {
            if (prev && (!eventId || prev.id === eventId)) {
              setMissedAlert('💨 [황금 벌레 마감] 방금 선착순 마감되어 벌레가 날아갔습니다! 다음 기회를 노려보세요! ⚡');
              setTimeout(() => setMissedAlert(null), 5000);
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
      setEscapeCount(0);
      setIsTired(false);
      setGimmickBubble(null);
      startBugMovement(event.speedMode);
    } else if (studentId) {
      // 활성화된 벌레가 없으면 최근 마감된 이벤트가 있는지 확인
      const finishedEvent = await getRecentFinishedLuckyEvent(classIds, studentId);
      if (finishedEvent) {
        const sessionKey = `seen_finished_bug_${finishedEvent.id}`;
        if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          setMissedAlert(
            `💨 [황금 벌레 마감] 앗! 이번 황금 벌레는 다른 친구가 먼저 잡았습니다! 다음 돌발 이벤트를 기대해 보세요! ⚡`
          );
          setTimeout(() => setMissedAlert(null), 6000);
        }
      }
    }
  };

  // ⚡ 속도별 이동 주기 (1단계 보통 1.2s / 2단계 빠름 0.25s / 3단계 초광속 0.1s)
  const getIntervalMs = (mode) => {
    if (mode === 'EXTREME') return 100; // 3단계: 초광속 순간이동 (0.1초)
    if (mode === 'NORMAL') return 1200; // 1단계: 보통 (1.2초)
    return 250; // 2단계: 빠름 (0.25초)
  };

  const startBugMovement = (speedMode = 'FAST') => {
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);

    const interval = getIntervalMs(speedMode);

    moveTimerRef.current = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 68) + 14; // 14% ~ 82%
      const randomLeft = Math.floor(Math.random() * 74) + 12; // 12% ~ 86%
      const randomRotate = Math.floor(Math.random() * 50) - 25; // -25deg ~ +25deg
      setBugPosition({ top: randomTop, left: randomLeft, rotate: randomRotate });
    }, interval);
  };

  // 💨 도망치기 기믹 핸들러 (2~3회 도망 후 지침 시스템)
  const handleEscapeAttempt = (e) => {
    if (!activeEvent?.escapeGimmick || isTired || catching) return;

    // 만약 마우스 호버나 빠른 접근 시
    if (escapeCount < 2) {
      e.stopPropagation();
      setEscapeCount((prev) => prev + 1);

      // 즉시 새로운 랜덤 위치로 슝 튕겨 도망감!
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
      // 3번째 시도: 벌레가 지쳐서 멈춤! (1.8초 동안 꼼짝 못함)
      setIsTired(true);
      setGimmickBubble('😵 헥헥... 지쳤다!');
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);

      if (tiredTimerRef.current) clearTimeout(tiredTimerRef.current);
      tiredTimerRef.current = setTimeout(() => {
        setIsTired(false);
        setEscapeCount(0);
        setGimmickBubble(null);
        startBugMovement(activeEvent?.speedMode);
      }, 1800);
    }
  };

  // 벌레 터치(잡기) 핸들러
  const handleCatch = async (e) => {
    e.stopPropagation();
    if (!activeEvent || !user || catching) return;

    // 도망 기믹이 켜져 있고 아직 지치지 않은 상태에서 첫 터치일 경우
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
          rewardText: res.rewardText || '선생님의 깜짝 선물 🎁',
          message: res.message,
        });
        setActiveEvent(null);

        // 만약 정원이 다 찼으면 다른 학생들에게도 소멸 알림 브로드캐스트
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'BUG_CAUGHT',
            payload: { eventId: activeEvent.id, rank: res.rank },
          });
        }
      } else {
        // 이미 2명이 마감된 경우
        setMissedAlert(res.message || '앗! 아쉽게도 방금 마감되었습니다! 다음 기회를 노려보세요! 💨');
        setActiveEvent(null);
        setTimeout(() => setMissedAlert(null), 5000);
      }
    } catch (err) {
      console.error('Catch error:', err);
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  const getTransitionStyle = () => {
    if (isTired) return 'transition-all duration-300 ease-out';
    if (activeEvent?.speedMode === 'EXTREME') return 'transition-all duration-75 ease-out';
    if (activeEvent?.speedMode === 'FAST') return 'transition-all duration-150 ease-out';
    return 'transition-all duration-500 ease-out';
  };

  return (
    <>
      {/* 🐛 1. 화면 위를 떠다니는 황금 벌레 */}
      {activeEvent && (
        <div
          onClick={handleCatch}
          onMouseEnter={activeEvent.escapeGimmick && !isTired ? handleEscapeAttempt : undefined}
          style={{
            top: `${bugPosition.top}%`,
            left: `${bugPosition.left}%`,
            transform: `translate(-50%, -50%) rotate(${isTired ? 0 : bugPosition.rotate || 0}deg)`,
          }}
          className={`fixed z-50 cursor-pointer select-none ${getTransitionStyle()} ${
            isTired ? 'scale-125 animate-pulse' : 'hover:scale-110 active:scale-95'
          }`}
        >
          {/* 황금빛 발광 효과 */}
          <div className="relative group">
            {/* 광속/빠름 모드 번개/후광 오라 */}
            <div
              className={`absolute -inset-3 rounded-full blur-md animate-pulse ${
                isTired
                  ? 'bg-rose-400/80 animate-ping'
                  : activeEvent.speedMode === 'EXTREME'
                  ? 'bg-rose-500/70'
                  : 'bg-amber-400/60'
              }`}
            ></div>

            <div
              className={`relative border-2 shadow-2xl rounded-full w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center text-center p-1 ${
                isTired
                  ? 'bg-gradient-to-tr from-rose-400 via-yellow-200 to-amber-300 border-rose-300'
                  : activeEvent.speedMode === 'EXTREME'
                  ? 'bg-gradient-to-tr from-rose-500 via-amber-400 to-yellow-300 border-yellow-100'
                  : 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 border-yellow-200'
              }`}
            >
              {/* 캐릭터 아이콘 & 이펙트 */}
              <div className="relative">
                <span
                  className={`text-2xl sm:text-3xl inline-block ${
                    isTired ? 'animate-bounce' : 'animate-spin'
                  }`}
                  style={{ animationDuration: isTired ? '0.5s' : activeEvent.speedMode === 'EXTREME' ? '1s' : '3s' }}
                >
                  {isTired ? '😵' : '🐛'}
                </span>

                {/* 빠른 속도일 때 바람 이펙트 */}
                {!isTired && activeEvent.speedMode === 'EXTREME' && (
                  <span className="absolute -left-3 -top-1 text-xs animate-ping">⚡</span>
                )}
                {!isTired && activeEvent.speedMode === 'FAST' && (
                  <span className="absolute -left-3 -top-1 text-xs opacity-80">💨</span>
                )}
              </div>

              {/* 하단 탭 안내 뱃지 */}
              <span
                className={`text-[9px] sm:text-[10px] font-black leading-none mt-0.5 px-1.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap ${
                  isTired
                    ? 'bg-rose-600 text-white animate-bounce'
                    : 'bg-yellow-100/95 text-amber-950'
                }`}
              >
                {isTired ? '지금 잡기! 🎯' : '터치해서 잡기!'}
              </span>
            </div>

            {/* 도망치기 / 지침 실시간 말풍선 */}
            {gimmickBubble && (
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap shadow-xl border border-amber-400 animate-bounce">
                {gimmickBubble}
              </div>
            )}

            {/* 머리 위 난이도 & 선착순 말풍선 */}
            {!gimmickBubble && (
              <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-rose-600 text-white text-[9.5px] sm:text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md flex items-center gap-1">
                <span>
                  {activeEvent.speedMode === 'EXTREME'
                    ? '🌪️ 광속'
                    : activeEvent.speedMode === 'NORMAL'
                    ? '🟢 보통'
                    : '⚡ 빠름'}
                </span>
                <span>•</span>
                <span>선착순 {activeEvent.targetCount}명!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 💥 2. 아쉽게 마감 안내 알림 (프리미엄 하단 토스트) */}
      {missedAlert && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-slate-950/95 text-white px-5 sm:px-6 py-3.5 rounded-2xl shadow-2xl border border-amber-500/40 text-xs sm:text-sm font-black flex items-center gap-3 animate-fade-in backdrop-blur-md max-w-md w-[92%] sm:w-auto text-center justify-center">
          <span className="text-xl shrink-0 animate-bounce">💨</span>
          <span className="leading-snug">{missedAlert}</span>
        </div>
      )}

      {/* 🎉 3. 당첨 축하 팝업 모달 (선생님께 보여주는 인증 쿠폰) */}
      {winModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-2 border-amber-300 text-center space-y-5 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-4xl mx-auto shadow-inner">
              🏆
            </div>

            <div className="space-y-1.5">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full">
                황금 벌레 {winModal.rank}등 포획 성공! 🎉
              </span>
              <h3 className="text-xl font-black text-slate-800 pt-1">축하합니다!</h3>
              <p className="text-xs text-slate-500 font-semibold">
                가장 빠른 순발력으로 황금 벌레를 잡았습니다.
              </p>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-1">
              <span className="text-[11px] font-bold text-amber-800 block">🎁 당첨 선물</span>
              <p className="text-sm font-black text-amber-950">{winModal.rewardText}</p>
              <span className="text-[10px] text-amber-700 block mt-1">
                선생님께 이 화면을 보여드리고 선물을 수령하세요!
              </span>
            </div>

            <button
              onClick={() => setWinModal(null)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black py-3 rounded-2xl text-sm shadow-md transition"
            >
              확인 완료!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
