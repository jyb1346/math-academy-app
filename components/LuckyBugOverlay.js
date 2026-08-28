'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveLuckyEvent, catchLuckyBug } from '@/lib/luckyBugService';

export default function LuckyBugOverlay() {
  const [user, setUser] = useState(null);
  const [studentClasses, setStudentClasses] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [catching, setCatching] = useState(false);
  const [winModal, setWinModal] = useState(null); // { rank, rewardText, message }
  const [missedAlert, setMissedAlert] = useState(null);
  const [bugPosition, setBugPosition] = useState({ top: 30, left: 40 });

  const channelRef = useRef(null);
  const moveTimerRef = useRef(null);

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
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current);
      }
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
      setStudentClasses(classIds);

      // 2. 현재 활성화된 벌레 이벤트가 있는지 확인
      checkActiveEvent(classIds);

      // 3. 실시간 Supabase Realtime 채널 구독
      const channel = supabase
        .channel('poom-lucky-events')
        .on('broadcast', { event: 'BUG_SPAWNED' }, (payload) => {
          const { eventId, classId, targetCount, rewardText } = payload.payload || {};
          // 내 반 또는 전체 대상인지 확인
          if (!classId || classIds.includes(String(classId))) {
            setActiveEvent({
              id: eventId,
              classId,
              targetCount,
              rewardText,
            });
            playChimeSound();
            startBugMovement();
          }
        })
        .on('broadcast', { event: 'BUG_FINISHED' }, (payload) => {
          const { eventId } = payload.payload || {};
          setActiveEvent((prev) => {
            if (prev && prev.id === eventId) {
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

  const checkActiveEvent = async (classIds) => {
    const event = await getActiveLuckyEvent(classIds);
    if (event) {
      setActiveEvent(event);
      startBugMovement();
    }
  };

  // 벌레가 화면 안에서 꼬물꼬물 움직이도록 하는 타이머
  const startBugMovement = () => {
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);

    moveTimerRef.current = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 65) + 15; // 15% ~ 80%
      const randomLeft = Math.floor(Math.random() * 70) + 10; // 10% ~ 80%
      setBugPosition({ top: randomTop, left: randomLeft });
    }, 2800);
  };

  // 벌레 터치(잡기) 핸들러
  const handleCatch = async () => {
    if (!activeEvent || !user || catching) return;
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
        setMissedAlert(res.message || '앗! 아쉽게도 방금 마감되었습니다!');
        setActiveEvent(null);
        setTimeout(() => setMissedAlert(null), 4000);
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

  return (
    <>
      {/* 🐛 1. 화면 위를 떠다니는 황금 벌레 */}
      {activeEvent && (
        <div
          onClick={handleCatch}
          style={{
            top: `${bugPosition.top}%`,
            left: `${bugPosition.left}%`,
          }}
          className="fixed z-50 cursor-pointer select-none transition-all duration-1000 ease-out transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 active:scale-95 animate-bounce"
        >
          {/* 황금빛 발광 효과 */}
          <div className="relative group">
            <div className="absolute -inset-3 bg-amber-400/60 rounded-full blur-md animate-pulse"></div>
            <div className="relative bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 border-2 border-yellow-200 shadow-2xl rounded-full w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center text-center p-1">
              <span className="text-2xl sm:text-3xl animate-spin" style={{ animationDuration: '6s' }}>
                🐛
              </span>
              <span className="text-[9px] sm:text-[10px] font-black text-amber-950 leading-none mt-0.5 bg-yellow-100/90 px-1.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap">
                터치해서 잡기!
              </span>
            </div>

            {/* 머리 위 말풍선 */}
            <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md animate-pulse">
              선착순 {activeEvent.targetCount}명! ⚡
            </div>
          </div>
        </div>
      )}

      {/* 💥 2. 아쉽게 마감 알림 토스트 */}
      {missedAlert && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <span>💨</span>
          <span>{missedAlert}</span>
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
