'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { createLuckyEvent, getLuckyEventHistory } from '@/lib/luckyBugService';

export default function TeacherLuckyBugModal({ user, classes = [], onClose }) {
  const [tab, setTab] = useState('SPAWN'); // 'SPAWN' | 'HISTORY'
  const [selectedClassId, setSelectedClassId] = useState(''); // '' = 전체
  const [targetCount, setTargetCount] = useState(2);
  const [rewardText, setRewardText] = useState('선착순 깜짝 선물 🎁 (간식/기프티콘)');
  const [spawning, setSpawning] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [spawnSuccessMessage, setSpawnSuccessMessage] = useState(null);

  const channelRef = useRef(null);

  useEffect(() => {
    fetchHistory();

    // 실시간 포획 현황 수신 채널 구독
    const channel = supabase
      .channel('poom-lucky-events')
      .on('broadcast', { event: 'BUG_CAUGHT' }, () => {
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

  const handleSpawn = async (e) => {
    e.preventDefault();
    setSpawning(true);
    setSpawnSuccessMessage(null);

    try {
      const result = await createLuckyEvent({
        teacherId: user.id,
        classId: selectedClassId || null,
        targetCount: Number(targetCount) || 2,
        rewardText: rewardText.trim(),
      });

      if (!result.success) throw new Error(result.error);

      const event = result.event;

      // 1. 실시간 브로드캐스트 발송 (앱 켜고 있는 학생들에게 즉시 출현)
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'BUG_SPAWNED',
          payload: {
            eventId: event.id,
            classId: selectedClassId || null,
            targetCount: Number(targetCount),
            rewardText: rewardText.trim(),
          },
        });
      }

      // 2. 대상 학생들에게 실시간 푸시 알림 발송
      try {
        let targetUserIds = [];
        if (selectedClassId) {
          const { data: csData } = await supabase
            .from('class_students')
            .select('student_id')
            .eq('class_id', selectedClassId);
          targetUserIds = (csData || []).map((cs) => cs.student_id);
        }

        const classNameLabel = selectedClassId
          ? classes.find((c) => String(c.id) === String(selectedClassId))?.name || '우리 반'
          : '학원 전체';

        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: targetUserIds.length > 0 ? targetUserIds : undefined,
            title: `🚨 [${classNameLabel} 돌발 이벤트] 황금 벌레 출현! 🐛`,
            message: `선착순 ${targetCount}명! 지금 바로 접속해서 화면의 황금 벌레를 잡으세요! (${rewardText})`,
            url: '/student/dashboard',
          }),
        }).catch((e) => console.warn('Push send warning:', e));
      } catch (pushErr) {
        console.warn('Lucky push error:', pushErr);
      }

      setSpawnSuccessMessage(
        `🎉 성공적으로 황금 벌레 ${targetCount}마리가 소환되었습니다! 학생들의 화면에 실시간으로 출현합니다.`
      );
      fetchHistory();
      setTab('HISTORY');
    } catch (err) {
      alert('벌레 소환 실패: ' + err.message);
    } finally {
      setSpawning(false);
    }
  };

  const handleEndEvent = async (eventId) => {
    if (!confirm('이 이벤트를 강제 종료하시겠습니까? (더 이상 벌레가 나타나지 않습니다)')) return;

    try {
      const targetEvent = history.find((h) => h.id === eventId);
      if (targetEvent) {
        await supabase
          .from('posts')
          .update({
            content: JSON.stringify({
              targetCount: targetEvent.targetCount,
              rewardText: targetEvent.rewardText,
              status: 'FINISHED',
            }),
          })
          .eq('id', eventId);

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'BUG_FINISHED',
            payload: { eventId },
          });
        }
      }
      fetchHistory();
    } catch (e) {
      alert('종료 실패: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl animate-bounce">🐛</span>
            <div>
              <h2 className="text-lg font-black leading-tight">돌발! 황금 벌레 소환 이벤트</h2>
              <p className="text-xs text-amber-100 font-semibold">
                학생들 화면에 실시간으로 벌레를 출현시키고 선착순 선물을 줍니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl font-black px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* 탭 버튼 */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2">
          <button
            onClick={() => setTab('SPAWN')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition ${
              tab === 'SPAWN'
                ? 'bg-white text-amber-900 border-t-2 border-amber-500 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🚀 지금 벌레 소환하기
          </button>
          <button
            onClick={() => setTab('HISTORY')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition flex items-center gap-1.5 ${
              tab === 'HISTORY'
                ? 'bg-white text-amber-900 border-t-2 border-amber-500 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🏆 실시간 당첨자 명단</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full">
              {history.length}
            </span>
          </button>
        </div>

        {/* 내용 영역 */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* 1. 소환 탭 */}
          {tab === 'SPAWN' && (
            <form onSubmit={handleSpawn} className="space-y-4">
              
              {/* 소환 대상 반 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🏫 소환 대상 (반 선택)
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                >
                  <option value="">🌐 학원 전체 학생 (전체 소환)</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      📘 [{cls.name}] 전용 소환
                    </option>
                  ))}
                </select>
              </div>

              {/* 등장 벌레 마릿수 (당첨 정원) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  🎯 등장 벌레 수 (선착순 당첨 인원수)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setTargetCount(cnt)}
                      className={`py-2.5 rounded-xl text-xs font-black transition border ${
                        targetCount === cnt
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cnt}마리 ({cnt}명)
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
                  placeholder="예: 아이스크림 기프티콘, 문구 세트, 간식 교환권"
                  value={rewardText}
                  onChange={(e) => setRewardText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800"
                />
              </div>

              {/* 안내 문구 */}
              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <span>💡</span> 작동 방식 안내:
                </span>
                <p className="text-[11px] leading-relaxed">
                  버튼을 누르는 즉시 <strong>해당 반 학생들의 스마트폰으로 실시간 푸시 알림이 발송</strong>되며, 
                  화면 한가운데에 <strong>황금 벌레 🐛 애니메이션이 실시간으로 출현</strong>합니다. 
                  선착순 {targetCount}명이 잡으면 자동으로 모든 화면에서 사라집니다.
                </p>
              </div>

              <button
                type="submit"
                disabled={spawning}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black py-4 rounded-2xl text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>{spawning ? '벌레 소환 중...' : '지금 즉시 황금 벌레 소환하기!'}</span>
              </button>
            </form>
          )}

          {/* 2. 당첨자 히스토리 탭 */}
          {tab === 'HISTORY' && (
            <div className="space-y-4">
              {spawnSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-3 rounded-xl text-xs font-bold animate-fade-in">
                  {spawnSuccessMessage}
                </div>
              )}

              {loadingHistory ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  당첨자 현황 로딩 중...
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl">
                  아직 진행된 돌발 벌레 이벤트가 없습니다.
                </div>
              ) : (
                history.map((ev) => {
                  const isFinished = ev.status === 'FINISHED' || ev.winners.length >= ev.targetCount;

                  return (
                    <div
                      key={ev.id}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-800">
                              🐛 {ev.className}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                isFinished
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-rose-500 text-white animate-pulse'
                              }`}
                            >
                              {isFinished ? '✅ 종료됨' : '🚨 실시간 출현 중!'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            선물: {ev.rewardText} (정원 {ev.targetCount}명) • {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </p>
                        </div>

                        {!isFinished && (
                          <button
                            onClick={() => handleEndEvent(ev.id)}
                            className="text-xs text-rose-600 font-bold hover:underline"
                          >
                            강제 종료
                          </button>
                        )}
                      </div>

                      {/* 포획 당첨자 목록 */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span>🏆</span> 포획 성공 당첨자:
                        </span>

                        {ev.winners.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            아직 잡은 학생이 없습니다 (실시간 대기 중...)
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {ev.winners.map((w, idx) => (
                              <div
                                key={w.id}
                                className="flex justify-between items-center text-xs bg-amber-50/60 px-3 py-1.5 rounded-lg border border-amber-100 font-bold"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-amber-700 font-black">
                                    {idx === 0 ? '🥇 1등' : idx === 1 ? '🥈 2등' : `${idx + 1}등`}
                                  </span>
                                  <span className="text-slate-800">{w.studentName} 학생</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {new Date(w.caughtAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 포획
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
