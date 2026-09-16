'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { createLuckyEvent, getLuckyEventHistory, deleteLuckyEvent, getJangStudentUserIds } from '@/lib/luckyBugService';
import { getNormalBugs, getBossBugs, getBugById, getRandomBug } from '@/lib/bugCatalog';

export default function TeacherLuckyBugModal({ user, classes = [], onClose }) {
  const [tab, setTab] = useState('SPAWN_NORMAL'); // 'SPAWN_NORMAL' | 'SPAWN_BOSS' | 'HISTORY'
  const [selectedClassId, setSelectedClassId] = useState(''); // '' = 전체
  
  // 🟢 일반 벌레 설정
  const [selectedBugId, setSelectedBugId] = useState('gold_beetle'); // or 'RANDOM'
  const [targetCount, setTargetCount] = useState(2);
  const [rewardText, setRewardText] = useState('선착순 깜짝 선물 🎁 (간식/기프티콘)');
  const [speedMode, setSpeedMode] = useState('FAST');
  const [customSpeedSec, setCustomSpeedSec] = useState('0.25');
  const [escapeGimmick, setEscapeGimmick] = useState(true);

  // 👑 보스 레이드 설정
  const [selectedBossId, setSelectedBossId] = useState('boss_stag_beetle');
  const [bossHp, setBossHp] = useState(30);
  const [hitDamage, setHitDamage] = useState(5);
  const [perUserHitLimit, setPerUserHitLimit] = useState(5);
  const [bossRewardText, setBossRewardText] = useState('반 전체 단체 간식 파티 🍕🥤');

  const [spawning, setSpawning] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [spawnSuccessMessage, setSpawnSuccessMessage] = useState(null);

  const channelRef = useRef(null);

  const normalBugs = getNormalBugs();
  const bossBugs = getBossBugs();

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel('poom-lucky-events')
      .on('broadcast', { event: 'BUG_CAUGHT' }, () => {
        fetchHistory();
      })
      .on('broadcast', { event: 'BUG_FINISHED' }, () => {
        fetchHistory();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const data = await getLuckyEventHistory(user.id);
    setHistory(data);
    setLoadingHistory(false);
  };

  // 1. 일반 벌레 소환
  const handleSpawnNormal = async (e) => {
    e.preventDefault();
    setSpawning(true);
    setSpawnSuccessMessage(null);

    try {
      let finalBug = selectedBugId === 'RANDOM' ? getRandomBug() : getBugById(selectedBugId);
      const parsedSpeedSec = customSpeedSec ? Number(customSpeedSec) : undefined;

      const result = await createLuckyEvent({
        teacherId: user.id,
        classId: selectedClassId || null,
        bugId: finalBug.id,
        isBossRaid: false,
        targetCount: Number(targetCount) || 2,
        rewardText: rewardText.trim(),
        speedMode,
        customSpeedSec: parsedSpeedSec,
        escapeGimmick,
      });

      if (!result.success) throw new Error(result.error);

      const event = result.event;
      const targetClassIds = selectedClassId
        ? [String(selectedClassId)]
        : classes.map((c) => String(c.id));

      // 1. 실시간 브로드캐스트
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'BUG_SPAWNED',
          payload: {
            eventId: event.id,
            teacherId: user.id,
            classId: selectedClassId || null,
            targetClassIds,
            bugId: finalBug.id,
            isBossRaid: false,
            targetCount: Number(targetCount),
            rewardText: rewardText.trim(),
            speedMode,
            customSpeedSec: parsedSpeedSec,
            escapeGimmick,
          },
        });
      }

      // 2. 푸시 알림 (선생님 제외, 담당 학생에게만 발송)
      try {
        let targetUserIds = [];
        if (selectedClassId) {
          const { data: csData } = await supabase
            .from('class_students')
            .select('student_id, users!class_students_student_id_fkey(role)')
            .eq('class_id', selectedClassId);
          targetUserIds = (csData || [])
            .filter((cs) => cs.users?.role === 'STUDENT' || !cs.users)
            .map((cs) => cs.student_id);
        } else {
          targetUserIds = await getJangStudentUserIds(user.id);
        }

        const classNameLabel = selectedClassId
          ? classes.find((c) => String(c.id) === String(selectedClassId))?.name || '우리 반'
          : '내 담당 모든 반';

        if (targetUserIds && targetUserIds.length > 0) {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: targetUserIds,
              title: `🚨 [${classNameLabel} 돌발] ${finalBug.name} 출현! ${finalBug.emoji}`,
              message: `선착순 ${targetCount}명! 화면의 ${finalBug.name}을(를) 잡으세요! (${rewardText})`,
              url: '/student/dashboard',
              tag: `lucky-bug-${event.id}`,
              renotify: true,
            }),
          }).catch((e) => console.warn('Push send warning:', e));
        }
      } catch (pushErr) {}

      setSpawnSuccessMessage(
        `🎉 성공적으로 [${finalBug.name} (${finalBug.emoji})] ${targetCount}마리가 소환되었습니다!`
      );
      fetchHistory();
      setTab('HISTORY');
    } catch (err) {
      alert('벌레 소환 실패: ' + err.message);
    } finally {
      setSpawning(false);
    }
  };

  // 2. 👑 보스 레이드 소환
  const handleSpawnBoss = async (e) => {
    e.preventDefault();
    setSpawning(true);
    setSpawnSuccessMessage(null);

    try {
      const bossInfo = getBugById(selectedBossId);
      const parsedHp = Number(bossHp) || 30;
      const parsedHitDamage = Number(hitDamage) || 5;
      const parsedLimit = Number(perUserHitLimit) || 5;

      const result = await createLuckyEvent({
        teacherId: user.id,
        classId: selectedClassId || null,
        bugId: bossInfo.id,
        isBossRaid: true,
        bossHp: parsedHp,
        hitDamage: parsedHitDamage,
        perUserHitLimit: parsedLimit,
        rewardText: bossRewardText.trim(),
        speedMode: 'FAST',
        escapeGimmick: false,
      });

      if (!result.success) throw new Error(result.error);

      const event = result.event;
      const targetClassIds = selectedClassId
        ? [String(selectedClassId)]
        : classes.map((c) => String(c.id));

      // 1. 실시간 브로드캐스트
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'BUG_SPAWNED',
          payload: {
            eventId: event.id,
            teacherId: user.id,
            classId: selectedClassId || null,
            targetClassIds,
            bugId: bossInfo.id,
            isBossRaid: true,
            maxHp: parsedHp,
            currentHp: parsedHp,
            hitDamage: parsedHitDamage,
            perUserHitLimit: parsedLimit,
            rewardText: bossRewardText.trim(),
            speedMode: 'FAST',
            escapeGimmick: false,
          },
        });
      }

      // 2. 푸시 알림 (선생님 제외, 담당 학생에게만 발송)
      try {
        let targetUserIds = [];
        if (selectedClassId) {
          const { data: csData } = await supabase
            .from('class_students')
            .select('student_id, users!class_students_student_id_fkey(role)')
            .eq('class_id', selectedClassId);
          targetUserIds = (csData || [])
            .filter((cs) => cs.users?.role === 'STUDENT' || !cs.users)
            .map((cs) => cs.student_id);
        } else {
          targetUserIds = await getJangStudentUserIds(user.id);
        }

        const classNameLabel = selectedClassId
          ? classes.find((c) => String(c.id) === String(selectedClassId))?.name || '우리 반'
          : '내 담당 모든 반';

        if (targetUserIds && targetUserIds.length > 0) {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: targetUserIds,
              title: `👑 [${classNameLabel} 긴급] ${bossInfo.name} 레이드 출현!`,
              message: `보스 HP: ${parsedHp}! 반 전체가 힘을 합쳐 보스를 쓰러뜨리세요! (${bossRewardText})`,
              url: '/student/dashboard',
              tag: `lucky-bug-${event.id}`,
              renotify: true,
            }),
          }).catch((e) => console.warn('Push send warning:', e));
        }
      } catch (pushErr) {}

      setSpawnSuccessMessage(
        `👑 [${bossInfo.name}] (HP: ${parsedHp}) 레이드가 소환되었습니다! 학생들의 화면에 실시간 레이드 UI가 출현합니다.`
      );
      fetchHistory();
      setTab('HISTORY');
    } catch (err) {
      alert('보스 소환 실패: ' + err.message);
    } finally {
      setSpawning(false);
    }
  };

  const handleEndEvent = async (eventId) => {
    if (!confirm('이 이벤트를 강제 종료하시겠습니까? (더 이상 벌레/보스가 나타나지 않습니다)')) return;

    try {
      const targetEvent = history.find((h) => h.id === eventId);
      if (targetEvent) {
        await supabase
          .from('posts')
          .update({
            content: JSON.stringify({
              targetCount: targetEvent.targetCount,
              rewardText: targetEvent.rewardText,
              bugId: targetEvent.bugId,
              isBossRaid: targetEvent.isBossRaid,
              maxHp: targetEvent.maxHp,
              status: 'FINISHED',
            }),
          })
          .eq('id', eventId);

        try {
          let targetUserIds = [];
          if (targetEvent.classId) {
            const { data: csData } = await supabase
              .from('class_students')
              .select('student_id')
              .eq('class_id', targetEvent.classId);
            targetUserIds = (csData || []).map((cs) => cs.student_id);
          } else {
            targetUserIds = await getJangStudentUserIds(user.id);
          }

          if (targetUserIds && targetUserIds.length > 0) {
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userIds: targetUserIds,
                title: '💨 [황금 벌레 마감] 이벤트 종료 ⚡',
                message: '이벤트가 종료되었습니다. 다음 돌발 이벤트를 기대하세요!',
                url: '/student/dashboard',
                tag: `lucky-bug-${eventId}`,
                renotify: false,
              }),
            }).catch((e) => console.warn('Push end warning:', e));
          }
        } catch (e) {}

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'BUG_FINISHED',
            payload: { eventId, isBossRaid: targetEvent.isBossRaid },
          });
        }
      }
      fetchHistory();
    } catch (e) {
      alert('종료 실패: ' + e.message);
    }
  };

  // 🗑️ 히스토리 이벤트 삭제 핸들러 (테스트 기록 삭제용)
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('정말 이 벌레 이벤트를 히스토리에서 완전히 삭제하시겠습니까?\n(테스트 기록 정리 시 유용하며 해당 이벤트 포획 데이터도 함께 삭제됩니다)')) return;

    try {
      const res = await deleteLuckyEvent(eventId);
      if (!res.success) throw new Error(res.error);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'BUG_FINISHED',
          payload: { eventId },
        });
      }

      setSpawnSuccessMessage('🗑️ 이벤트 기록이 안전하게 삭제되었습니다.');
      setTimeout(() => setSpawnSuccessMessage(null), 3000);
      fetchHistory();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl animate-bounce">🐛</span>
            <div>
              <h2 className="text-lg font-black leading-tight">돌발 벌레 & 보스 레이드 소환소</h2>
              <p className="text-xs text-amber-100 font-semibold">
                학생들에게 20종 벌레를 출현시키거나 협동 보스 레이드를 엽니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-black px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* 탭 버튼 3종 */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setTab('SPAWN_NORMAL')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition flex items-center gap-1.5 ${
              tab === 'SPAWN_NORMAL'
                ? 'bg-white text-amber-900 border-t-2 border-amber-500 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🚀 일반 벌레 소환</span>
          </button>

          <button
            onClick={() => setTab('SPAWN_BOSS')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition flex items-center gap-1.5 ${
              tab === 'SPAWN_BOSS'
                ? 'bg-white text-rose-900 border-t-2 border-rose-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>👑 보스 레이드 (HP 지정)</span>
          </button>

          <button
            onClick={() => setTab('HISTORY')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition flex items-center gap-1.5 ${
              tab === 'HISTORY'
                ? 'bg-white text-indigo-900 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🏆 실시간 히스토리</span>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full">
              {history.length}
            </span>
          </button>
        </div>

        {/* 내용 영역 */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* 1. 일반 벌레 소환 탭 */}
          {tab === 'SPAWN_NORMAL' && (
            <form onSubmit={handleSpawnNormal} className="space-y-4">
              
              {/* 소환 대상 반 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🏫 소환 대상 (반 선택)
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">🌐 내 담당 모든 반 (전체 소환)</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      📘 [{cls.name}] 전용 소환
                    </option>
                  ))}
                </select>
              </div>

              {/* 20종 벌레 선택기 (or 랜덤) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🐛 소환할 벌레 종류 선택 (18종)
                </label>
                <select
                  value={selectedBugId}
                  onChange={(e) => {
                    setSelectedBugId(e.target.value);
                    if (e.target.value !== 'RANDOM') {
                      const b = getBugById(e.target.value);
                      const sMode = b.defaultSpeed || 'FAST';
                      setSpeedMode(sMode);
                      setCustomSpeedSec(sMode === 'EXTREME' ? '0.1' : sMode === 'NORMAL' ? '1.2' : '0.25');
                      setEscapeGimmick(b.escapeGimmick !== false);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800"
                >
                  <option value="RANDOM">🎲 [완전 랜덤] 18종 중 무작위 뽑기 소환</option>
                  <optgroup label="🟢 일반 (6종)">
                    {normalBugs.filter((b) => b.tier === 'COMMON').map((b) => (
                      <option key={b.id} value={b.id}>{b.emoji} {b.name} (일반)</option>
                    ))}
                  </optgroup>
                  <optgroup label="🔵 레어 (5종)">
                    {normalBugs.filter((b) => b.tier === 'RARE').map((b) => (
                      <option key={b.id} value={b.id}>{b.emoji} {b.name} (레어)</option>
                    ))}
                  </optgroup>
                  <optgroup label="🟣 에픽 (4종)">
                    {normalBugs.filter((b) => b.tier === 'EPIC').map((b) => (
                      <option key={b.id} value={b.id}>{b.emoji} {b.name} (에픽)</option>
                    ))}
                  </optgroup>
                  <optgroup label="🟡 전설 (3종)">
                    {normalBugs.filter((b) => b.tier === 'LEGENDARY').map((b) => (
                      <option key={b.id} value={b.id}>{b.emoji} {b.name} (전설)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* 선착순 당첨 인원수 직접 입력 + 프리셋 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                    <span>🎯</span>
                    <span>선착순 당첨 인원수 직접 지정:</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={targetCount}
                      onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 p-1 text-center bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <span className="text-xs font-black text-slate-600">명</span>
                  </div>
                </div>

                {/* 빠른 인원 선택 프리셋 버튼 */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 2, 3, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setTargetCount(cnt)}
                      className={`py-1.5 rounded-lg text-xs font-black transition border ${
                        targetCount === cnt
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cnt}명
                    </button>
                  ))}
                </div>
              </div>

              {/* 당첨 선물 문구 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🎁 당첨 선물 안내 (학생 화면에 표시)
                </label>
                <input
                  type="text"
                  placeholder="예: 아이스크림 기프티콘, 간식 교환권"
                  value={rewardText}
                  onChange={(e) => setRewardText(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              {/* ⚡ 속도 프리셋 & 초 단위 직접 입력 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                    <span>⚡</span>
                    <span>벌레 이동 속도 (초 단위 직접 입력):</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0.05"
                      max="10"
                      step="0.05"
                      value={customSpeedSec}
                      onChange={(e) => setCustomSpeedSec(e.target.value)}
                      className="w-20 p-1 text-center bg-white border border-indigo-300 rounded-lg text-xs font-black text-indigo-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="0.25"
                    />
                    <span className="text-xs font-black text-slate-600">초</span>
                  </div>
                </div>

                {/* 빠른 속도 프리셋 버튼 */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mode: 'NORMAL', sec: '1.2', label: '🟢 보통 (1.2초)' },
                    { mode: 'FAST', sec: '0.25', label: '⚡ 빠름 (0.25초)' },
                    { mode: 'EXTREME', sec: '0.1', label: '🌪️ 광속 (0.1초)' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => {
                        setSpeedMode(item.mode);
                        setCustomSpeedSec(item.sec);
                      }}
                      className={`p-2 rounded-xl text-[11px] font-black transition border text-center ${
                        String(customSpeedSec) === item.sec
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10.5px] text-slate-500 font-semibold">
                  💡 숫자가 작을수록 벌레가 더 빠르게 순간이동합니다. (예: 0.08초 = 극한 난이도, 1.5초 = 쉬운 난이도)
                </p>
              </div>

              <button
                type="submit"
                disabled={spawning}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-black py-3.5 rounded-2xl text-sm shadow-md transition"
              >
                {spawning ? '벌레 소환 중...' : '🚀 지금 즉시 벌레 소환하기!'}
              </button>
            </form>
          )}

          {/* 2. 👑 보스 레이드 소환 탭 (보스 HP 지정 지원) */}
          {tab === 'SPAWN_BOSS' && (
            <form onSubmit={handleSpawnBoss} className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs text-rose-950 space-y-1">
                <span className="font-extrabold flex items-center gap-1">
                  <span>👑</span> 협동 보스 레이드 안내:
                </span>
                <p className="text-[11px] text-rose-800 leading-snug">
                  학생들이 각자 화면에서 보스를 공격하여 <strong>함께 체력(HP)을 0으로 깎아야 승리</strong>합니다! 
                  1인당 최대 타격 횟수가 제한되어 있어 진정한 협동이 필요합니다.
                </p>
              </div>

              {/* 소환 대상 반 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🏫 레이드 대상 (반 선택)
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">🌐 내 담당 모든 반 (총력전)</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      📘 [{cls.name}] 전용 레이드
                    </option>
                  ))}
                </select>
              </div>

              {/* 보스 종류 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  👑 보스 몬스터 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {bossBugs.map((boss) => (
                    <button
                      key={boss.id}
                      type="button"
                      onClick={() => {
                        setSelectedBossId(boss.id);
                        setBossHp(boss.defaultHp || 30);
                      }}
                      className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                        selectedBossId === boss.id
                          ? 'bg-rose-500 text-white border-rose-600 shadow-md'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-2xl">{boss.emoji}</span>
                      <div className="truncate">
                        <span className="text-xs font-black block">{boss.name}</span>
                        <span className={`text-[10px] ${selectedBossId === boss.id ? 'text-rose-100' : 'text-slate-400'}`}>
                          기본 권장 HP {boss.defaultHp}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 🎯 보스 HP(체력) 직접 지정 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                    <span>❤️</span>
                    <span>보스 총 체력(HP) 지정:</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="5"
                      max="500"
                      step="5"
                      value={bossHp}
                      onChange={(e) => setBossHp(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 p-1 text-center bg-white border border-rose-300 rounded-lg text-xs font-black text-rose-600 shadow-2xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                    <span className="text-xs font-black text-slate-600">HP</span>
                  </div>
                </div>

                {/* 빠른 HP 선택 버튼 */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[20, 30, 50, 100].map((hpVal) => (
                    <button
                      key={hpVal}
                      type="button"
                      onClick={() => setBossHp(hpVal)}
                      className={`py-1.5 rounded-lg text-xs font-black transition border ${
                        bossHp === hpVal
                          ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {hpVal} HP
                    </button>
                  ))}
                </div>
              </div>

              {/* 💥 1회 타격당 데미지 직접 지정 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                    <span>💥</span>
                    <span>1회 타격당 데미지(DMG) 지정:</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={hitDamage}
                      onChange={(e) => setHitDamage(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 p-1 text-center bg-white border border-rose-300 rounded-lg text-xs font-black text-rose-600 shadow-2xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                    <span className="text-xs font-black text-slate-600">DMG</span>
                  </div>
                </div>

                {/* 빠른 데미지 선택 버튼 */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 2, 5, 10].map((dmgVal) => (
                    <button
                      key={dmgVal}
                      type="button"
                      onClick={() => setHitDamage(dmgVal)}
                      className={`py-1.5 rounded-lg text-xs font-black transition border ${
                        hitDamage === dmgVal
                          ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {dmgVal} DMG
                    </button>
                  ))}
                </div>
              </div>

              {/* ⚔️ 학생 1인당 최대 타격 수 직접 지정 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                    <span>⚔️</span>
                    <span>학생 1인당 최대 타격 수 지정:</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={perUserHitLimit}
                      onChange={(e) => setPerUserHitLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 p-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <span className="text-xs font-black text-slate-600">회</span>
                  </div>
                </div>

                {/* 빠른 타격수 선택 버튼 */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[3, 5, 10, 20].map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setPerUserHitLimit(limit)}
                      className={`py-1.5 rounded-lg text-xs font-black transition border ${
                        perUserHitLimit === limit
                          ? 'bg-slate-900 text-white border-slate-950 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {limit}회
                    </button>
                  ))}
                </div>
              </div>

              {/* 💡 실시간 협동 밸런스 계산 안내 */}
              <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-2xl text-[11.5px] text-indigo-950 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>💡 1인당 최대 총 딜량:</span>
                  <span className="text-indigo-700 font-black">
                    {Number(hitDamage) * Number(perUserHitLimit)} DMG ({perUserHitLimit}타 × {hitDamage} DMG)
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>👥 보스 격파 최소 필요 인원:</span>
                  <span className="text-rose-600 font-black">
                    최소 {Math.max(1, Math.ceil(Number(bossHp) / ((Number(hitDamage) || 5) * (Number(perUserHitLimit) || 5))))}명 협동 필요
                  </span>
                </div>
              </div>

              {/* 단체 보상 문구 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🎁 격파 성공 시 단체 보상 문구
                </label>
                <input
                  type="text"
                  placeholder="예: 반 전체 피자/음료수 파티, 간식 교환권"
                  value={bossRewardText}
                  onChange={(e) => setBossRewardText(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={spawning}
                className="w-full bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-700 text-white font-black py-4 rounded-2xl text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>👑</span>
                <span>
                  {spawning
                    ? '보스 소환 중...'
                    : `지금 즉시 보스 레이드 소환! (HP: ${bossHp} | 1타당 ${hitDamage} DMG)`}
                </span>
              </button>
            </form>
          )}

          {/* 3. 실시간 히스토리 탭 */}
          {tab === 'HISTORY' && (
            <div className="space-y-3">
              {spawnSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-3 rounded-xl text-xs font-bold animate-fade-in">
                  {spawnSuccessMessage}
                </div>
              )}

              {loadingHistory ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  히스토리 로딩 중...
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  아직 진행된 벌레 이벤트가 없습니다.
                </div>
              ) : (
                history.map((ev) => {
                  const isActive = ev.status === 'ACTIVE';
                  const isBoss = ev.isBossRaid;
                  return (
                    <div
                      key={ev.id}
                      className={`p-4 rounded-2xl border transition space-y-2.5 ${
                        isActive
                          ? isBoss
                            ? 'bg-rose-50/80 border-rose-300 shadow-md'
                            : 'bg-amber-50/80 border-amber-300 shadow-md'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl">{ev.bugInfo?.emoji || '🐛'}</span>
                            <span className="text-xs font-black text-slate-900">{ev.bugInfo?.name || '황금 벌레'}</span>
                            <span className={`text-[9.5px] font-black px-1.5 py-0.2 rounded-full ${
                              isActive ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {isActive ? (isBoss ? '👑 레이드 진행 중' : '🚨 포획 진행 중') : '종료됨'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-semibold">
                            {ev.className} • {new Date(ev.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleEndEvent(ev.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black px-2.5 py-1 rounded-lg transition"
                            >
                              강제 종료
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-600 text-[10.5px] font-black px-2 py-1 rounded-lg transition"
                            title="히스토리 삭제"
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>

                      {/* 보스 레이드일 때 학생별 딜량 기여도 및 격파 상세 정보 */}
                      {isBoss ? (() => {
                        const contributorIds = Array.from(
                          new Set([
                            ...Object.keys(ev.damageByUser || {}),
                            ...Object.keys(ev.hitsByUser || {}),
                            ...(ev.winners || []).map((w) => w.studentId),
                          ])
                        );

                        const contributorList = contributorIds
                          .map((sId) => {
                            const dmg = ev.damageByUser?.[sId] || 0;
                            const hits = ev.hitsByUser?.[sId] || 0;
                            const name =
                              ev.studentNames?.[sId] ||
                              ev.winners?.find((w) => w.studentId === sId)?.studentName ||
                              (ev.finisher?.studentId === sId ? ev.finisher.studentName : null) ||
                              '학생';
                            const isMvp = ev.mvp?.studentId === sId || (ev.mvp && ev.mvp.damage === dmg && dmg > 0);
                            const isFinisher = ev.finisher?.studentId === sId;
                            return { studentId: sId, name, dmg, hits, isMvp, isFinisher };
                          })
                          .sort((a, b) => b.dmg - a.dmg);

                        const maxHpVal = Number(ev.maxHp) || 30;
                        const currentHpVal = ev.currentHp !== undefined ? Number(ev.currentHp) : 0;
                        const totalDealtDmg = contributorList.reduce((acc, c) => acc + c.dmg, 0);

                        return (
                          <div className="bg-white p-3.5 rounded-2xl border border-rose-200 text-xs space-y-3 shadow-xs">
                            {/* 보스 HP 상태 바 & 기본 스펙 */}
                            <div className="space-y-1.5 pb-2 border-b border-rose-100">
                              <div className="flex justify-between items-center text-xs font-black">
                                <span className="text-rose-950 flex items-center gap-1">
                                  <span>❤️ 보스 HP:</span>
                                  <span className="text-rose-600 font-extrabold">
                                    {currentHpVal} / {maxHpVal} HP
                                  </span>
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                  currentHpVal <= 0
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                }`}>
                                  {currentHpVal <= 0 ? '🏆 격파 성공' : '⚔️ 전투 진행 중'}
                                </span>
                              </div>

                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    currentHpVal <= 0 ? 'bg-slate-300' : 'bg-gradient-to-r from-rose-500 to-amber-500'
                                  }`}
                                  style={{
                                    width: `${Math.max(0, Math.min(100, Math.round((currentHpVal / maxHpVal) * 100)))}%`,
                                  }}
                                />
                              </div>

                              <div className="flex justify-between text-[11px] text-slate-500 font-semibold pt-0.5">
                                <span>1타당 기본 {ev.hitDamage || 5} DMG (최대 {ev.perUserHitLimit || 5}타)</span>
                                <span>총 누적 데미지: <strong className="text-rose-700">{totalDealtDmg} DMG</strong></span>
                              </div>
                            </div>

                            {/* 👑 MVP & ⚡ 막타 피니셔 요약 배너 */}
                            {(ev.mvp || ev.finisher) && (
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                {ev.mvp && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-amber-950">
                                    <span className="text-[10px] font-bold text-amber-700 block">👑 딜량 1등 (MVP)</span>
                                    <span className="font-black text-amber-900 truncate block">
                                      {contributorList.find((c) => c.isMvp)?.name || '학생'} ({ev.mvp.damage} DMG)
                                    </span>
                                  </div>
                                )}
                                {ev.finisher && (
                                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 text-rose-950">
                                    <span className="text-[10px] font-bold text-rose-700 block">⚡ 럭키 피니셔 (막타)</span>
                                    <span className="font-black text-rose-900 truncate block">
                                      {ev.finisher.studentName || '학생'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ⚔️ 학생별 딜량 및 기여도 상세 순위 리스트 */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[11.5px] font-black text-slate-700">
                                <span className="flex items-center gap-1">
                                  <span>📊</span>
                                  <span>학생별 딜량 기여도 순위</span>
                                </span>
                                <span className="text-[10.5px] text-indigo-600 font-bold">
                                  총 {contributorList.length}명 참여
                                </span>
                              </div>

                              {contributorList.length === 0 ? (
                                <p className="text-[11px] text-slate-400 font-semibold py-1">
                                  아직 보스를 타격한 학생이 없습니다.
                                </p>
                              ) : (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {contributorList.map((c, idx) => {
                                    const percent = maxHpVal > 0 ? Math.min(100, Math.round((c.dmg / maxHpVal) * 100)) : 0;
                                    return (
                                      <div
                                        key={c.studentId || idx}
                                        className={`p-2 rounded-xl border flex items-center justify-between text-xs transition ${
                                          idx === 0
                                            ? 'bg-amber-50/70 border-amber-300'
                                            : 'bg-slate-50 border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                                            idx === 0
                                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                                              : idx === 1
                                              ? 'bg-slate-300 text-slate-800'
                                              : idx === 2
                                              ? 'bg-amber-700/30 text-amber-900'
                                              : 'bg-slate-200 text-slate-600'
                                          }`}>
                                            {idx + 1}
                                          </span>
                                          <div className="truncate">
                                            <div className="flex items-center gap-1">
                                              <span className="font-black text-slate-800 truncate">
                                                {c.name}
                                              </span>
                                              {c.isMvp && (
                                                <span className="bg-amber-500 text-white text-[9px] font-black px-1 rounded">
                                                  MVP
                                                </span>
                                              )}
                                              {c.isFinisher && (
                                                <span className="bg-rose-500 text-white text-[9px] font-black px-1 rounded">
                                                  막타
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-semibold">
                                              {c.hits}회 타격 (기여도 {percent}%)
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className="text-xs font-black text-rose-600 block">
                                            {c.dmg} DMG
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 단체 선물 문구 */}
                            {ev.rewardText && (
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                                <span className="font-bold text-slate-600">🎁 단체 보상: </span>
                                <span className="font-black text-slate-800">{ev.rewardText}</span>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        /* 일반 벌레 당첨자 명단 */
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-600 block">
                            🏆 당첨자 명단 ({ev.winners.length}/{ev.targetCount}명):
                          </span>
                          {ev.winners.length === 0 ? (
                            <span className="text-slate-400 font-semibold">아직 포획자가 없습니다.</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {ev.winners.map((w, idx) => (
                                <span
                                  key={w.id}
                                  className="bg-amber-100 text-amber-900 font-black text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                                >
                                  <span>{idx + 1}등:</span>
                                  <span>{w.studentName}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
