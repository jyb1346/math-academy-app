'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  STICKER_CATALOG,
  STICKER_MAP,
  MEET_DAYS,
  MEET_TIME_OPTIONS,
  FIXED_MEET_PLACE,
} from '@/lib/stickerTradeStore';

const CHARACTER_FILTERS = ['전체', '나라T', '성우T', '영배T', '동희T', '몽돌'];

export default function StudentStickerMarketModal({ user, onClose, onStatsChange }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // 탭 & 필터 상태
  const [activeTab, setActiveTab] = useState('OPEN'); // 'OPEN' | 'MINE' | 'ALL'
  const [filterStickerId, setFilterStickerId] = useState('ALL');
  const [showWriteForm, setShowWriteForm] = useState(false);

  // 글 작성 폼 상태
  const [writeCharFilter, setWriteCharFilter] = useState('전체');
  const [offeredStickerId, setOfferedStickerId] = useState('');
  const [wantedStickerIds, setWantedStickerIds] = useState([]);
  const [meetDay, setMeetDay] = useState('월요일');
  const [meetTime, setMeetTime] = useState('18:00');
  const [memo, setMemo] = useState('');

  // 게시글별 댓글 입력 상태: { [postId]: { offeredStickerId, content } }
  const [commentInputs, setCommentInputs] = useState({});

  const fetchPosts = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch('/api/sticker-trades');
      if (!res.ok) throw new Error('교환 장터 목록을 불러오지 못했습니다.');
      const data = await res.json();
      const loadedPosts = data.posts || [];
      setPosts(loadedPosts);
      if (onStatsChange) {
        onStatsChange(loadedPosts);
      }
    } catch (err) {
      console.error('fetchPosts error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(true);
  }, []);

  // 내가 연관된 확정 약속 (내가 작성자이거나 내가 채택된 댓글 작성자인 COMPLETED 글)
  const myConfirmedTrades = useMemo(() => {
    return posts.filter((p) => p.status === 'COMPLETED' && p.isMatchedParty);
  }, [posts]);

  const openPostsCount = useMemo(
    () => posts.filter((p) => p.status === 'OPEN').length,
    [posts]
  );

  const myPostsOrCommentsCount = useMemo(
    () =>
      posts.filter(
        (p) => p.isMine || (p.comments || []).some((c) => c.isMine)
      ).length,
    [posts]
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (activeTab === 'OPEN' && p.status !== 'OPEN') return false;
      if (activeTab === 'MINE') {
        const isParticipant =
          p.isMine || (p.comments || []).some((c) => c.isMine);
        if (!isParticipant) return false;
      }
      if (filterStickerId !== 'ALL') {
        const matchesOffered = p.offeredStickerId === filterStickerId;
        const matchesWanted = (p.wantedStickerIds || []).includes(filterStickerId);
        if (!matchesOffered && !matchesWanted) return false;
      }
      return true;
    });
  }, [posts, activeTab, filterStickerId]);

  const filteredCatalogForWrite = useMemo(() => {
    if (writeCharFilter === '전체') return STICKER_CATALOG;
    return STICKER_CATALOG.filter((s) => s.character === writeCharFilter);
  }, [writeCharFilter]);

  const toggleWantedSticker = (id) => {
    if (id === offeredStickerId) return;
    setWantedStickerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectOfferedSticker = (id) => {
    setOfferedStickerId(id);
    setWantedStickerIds((prev) => prev.filter((item) => item !== id));
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!offeredStickerId) {
      return alert('내가 줄(보유 중복) 띠부씰을 선택해 주세요!');
    }
    if (wantedStickerIds.length === 0) {
      return alert('받고 싶은 띠부씰을 최소 1개 이상 선택해 주세요!');
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/sticker-trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeredStickerId,
          wantedStickerIds,
          meetDay,
          meetTime,
          memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '등록 실패');

      const nextPosts = [data.post, ...posts];
      setPosts(nextPosts);
      if (onStatsChange) onStatsChange(nextPosts);

      // 폼 초기화
      setOfferedStickerId('');
      setWantedStickerIds([]);
      setMemo('');
      setShowWriteForm(false);
      setActiveTab('OPEN');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getCommentInputForPost = (post) => {
    const existing = commentInputs[post.id];
    if (existing) return existing;
    const defaultStickerId = (post.wantedStickerIds || [])[0] || '01';
    return {
      offeredStickerId: defaultStickerId,
      content: '저 이거 가지고 있어요! 로비에서 교환해요 🙋',
    };
  };

  const updateCommentInput = (post, field, value) => {
    const current = getCommentInputForPost(post);
    setCommentInputs((prev) => ({
      ...prev,
      [post.id]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleAddComment = async (post) => {
    const input = getCommentInputForPost(post);
    if (!input.offeredStickerId) {
      return alert('내가 교환해 줄 띠부씰을 선택해 주세요.');
    }
    if (!input.content || !input.content.trim()) {
      return alert('댓글 내용을 입력해 주세요.');
    }

    setActionLoadingId(`cmt_${post.id}`);
    try {
      const res = await fetch(`/api/sticker-trades/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_COMMENT',
          offeredStickerId: input.offeredStickerId,
          content: input.content.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '댓글 등록 실패');

      const nextPosts = posts.map((p) => (p.id === post.id ? data.post : p));
      setPosts(nextPosts);
      if (onStatsChange) onStatsChange(nextPosts);

      setCommentInputs((prev) => ({
        ...prev,
        [post.id]: {
          offeredStickerId: (post.wantedStickerIds || [])[0] || '01',
          content: '',
        },
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptComment = async (post, comment) => {
    const giveSticker = STICKER_MAP[post.offeredStickerId]?.fullName || post.offeredStickerId;
    const receiveSticker = STICKER_MAP[comment.offeredStickerId]?.fullName || comment.offeredStickerId;

    if (
      !confirm(
        `🤝 이 친구와 교환을 확정(채택)하시겠습니까?\n\n` +
          `• 일시: ${post.meetDay} ${post.meetTime}\n` +
          `• 장소: ${post.meetPlace || FIXED_MEET_PLACE}\n` +
          `• 교환: [내 씰: ${giveSticker}] ↔ [상대 씰: ${receiveSticker}]\n\n` +
          `※ 채택 즉시 두 사람에게 서로의 실명이 공개되며, 상대 학생과 담당 선생님께 알림이 전송됩니다.`
      )
    ) {
      return;
    }

    setActionLoadingId(`accept_${comment.id}`);
    try {
      const res = await fetch(`/api/sticker-trades/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCEPT_COMMENT',
          commentId: comment.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '채택 처리 실패');

      const nextPosts = posts.map((p) => (p.id === post.id ? data.post : p));
      setPosts(nextPosts);
      if (onStatsChange) onStatsChange(nextPosts);

      alert(
        `🎉 교환이 성사되었습니다!\n\n` +
          `상대 학생 실명: [${data.post.matchedPartnerRealName || '확인됨'} 학생]\n` +
          `약속 시간/장소: ${post.meetDay} ${post.meetTime} · 학원 로비`
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteComment = async (post, commentId) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    setActionLoadingId(`del_cmt_${commentId}`);
    try {
      const res = await fetch(`/api/sticker-trades/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_COMMENT',
          commentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '댓글 삭제 실패');

      const nextPosts = posts.map((p) => (p.id === post.id ? data.post : p));
      setPosts(nextPosts);
      if (onStatsChange) onStatsChange(nextPosts);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('내가 올린 교환글을 삭제하시겠습니까?')) return;
    setActionLoadingId(`del_post_${postId}`);
    try {
      const res = await fetch(`/api/sticker-trades/${postId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '글 삭제 실패');

      const nextPosts = posts.filter((p) => p.id !== postId);
      setPosts(nextPosts);
      if (onStatsChange) onStatsChange(nextPosts);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStickerBadge = (stickerId, size = 'md', highlight = false) => {
    const info = STICKER_MAP[stickerId];
    if (!info) return <span className="text-xs font-bold">{stickerId}</span>;

    const sizeClass =
      size === 'lg'
        ? 'px-3 py-1.5 text-xs sm:text-sm rounded-xl'
        : 'px-2.5 py-1 text-[11px] sm:text-xs rounded-lg';

    const colorClass = highlight
      ? 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-200'
      : info.series === '천사'
      ? 'bg-sky-50 text-sky-900 border-sky-200'
      : info.series === '악마'
      ? 'bg-rose-50 text-rose-900 border-rose-200'
      : info.series === '동물'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : info.series === '스페셜'
      ? 'bg-purple-50 text-purple-900 border-purple-200'
      : 'bg-indigo-50 text-indigo-900 border-indigo-200';

    return (
      <span
        key={stickerId}
        className={`inline-flex items-center gap-1.5 font-extrabold border shadow-2xs whitespace-nowrap ${sizeClass} ${colorClass}`}
      >
        <span>{info.emoji}</span>
        <span className="font-black opacity-75">{info.number}</span>
        <span>{info.name}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* 1. 상단 헤더 */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                품수학 띠부띠부씰 로비 교환 장터
              </h2>
              <span className="bg-white/25 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                학생 전용
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-50 font-bold mt-0.5">
              중복 씰을 올리고 댓글을 채택하면 두 사람에게만 실명이 공개됩니다 · 📍 교환 장소: 학원 로비 고정
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black flex items-center justify-center transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* 2. 본문 스크롤 영역 */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/70">
          {/* 🤝 내 확정된 로비 교환 약속 배너 (채택 성사된 내 거래가 있을 때 최상단 노출) */}
          {myConfirmedTrades.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5">
                  <span>🎉</span>
                  <span>내 확정된 로비 교환 약속 ({myConfirmedTrades.length}건)</span>
                </span>
                <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
                  서로 실명 공개됨
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {myConfirmedTrades.map((trade) => {
                  const acceptedCmt = (trade.comments || []).find(
                    (c) => c.id === trade.acceptedCommentId
                  );
                  const myStickerId = trade.isMine
                    ? trade.offeredStickerId
                    : acceptedCmt?.offeredStickerId;
                  const partnerStickerId = trade.isMine
                    ? acceptedCmt?.offeredStickerId
                    : trade.offeredStickerId;

                  return (
                    <div
                      key={trade.id}
                      className="bg-white rounded-xl p-3 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-emerald-600 text-white font-black px-2.5 py-1 rounded-lg">
                          🗓️ {trade.meetDay} {trade.meetTime}
                        </span>
                        <span className="bg-slate-800 text-white font-black px-2.5 py-1 rounded-lg">
                          📍 {trade.meetPlace || FIXED_MEET_PLACE}
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          🤝 교환 상대: <span className="text-emerald-700 underline">{trade.matchedPartnerRealName} 학생</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500">내 씰</span>
                        {renderStickerBadge(myStickerId, 'md')}
                        <span className="font-black text-slate-400">⇄</span>
                        <span className="text-[11px] font-bold text-slate-500">상대 씰</span>
                        {renderStickerBadge(partnerStickerId, 'md', true)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. 상단 툴바: 탭 전환 + 띠부씰 필터 + 새 교환글 작성 버튼 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('OPEN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeTab === 'OPEN'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🔥 교환 가능 ({openPostsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('MINE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeTab === 'MINE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🙋 내 글·내 참여 ({myPostsOrCommentsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                전체 보기 ({posts.length})
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterStickerId}
                onChange={(e) => setFilterStickerId(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50"
              >
                <option value="ALL">🔍 모든 띠부씰 보기 (25종)</option>
                {STICKER_CATALOG.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.emoji} {s.fullName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowWriteForm((prev) => !prev)}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer whitespace-nowrap ${
                  showWriteForm
                    ? 'bg-slate-700 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                }`}
              >
                {showWriteForm ? '✕ 작성 닫기' : '+ 새 교환글 올리기'}
              </button>
            </div>
          </div>

          {/* 4. ✍️ 새 교환글 작성 폼 */}
          {showWriteForm && (
            <form
              onSubmit={handleCreatePost}
              className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-amber-300 shadow-md space-y-5 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    ✍️ 새 띠부띠부씰 교환글 올리기
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                    내가 가진 중복 씰 1개와 바꾸고 싶은 씰(복수 선택 가능), 로비에서 만날 요일·시간을 선택해 주세요.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {CHARACTER_FILTERS.map((cf) => (
                    <button
                      key={cf}
                      type="button"
                      onClick={() => setWriteCharFilter(cf)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                        writeCharFilter === cf
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cf}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 1: 내가 줄 띠부씰 (보유 중복 1개) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">STEP 1</span>
                    <span>📤 내가 줄 띠부씰 선택 (보유 중인 중복 씰 1개)</span>
                  </label>
                  {offeredStickerId && (
                    <span className="text-xs font-black text-amber-700">
                      선택됨: {STICKER_MAP[offeredStickerId]?.fullName}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {filteredCatalogForWrite.map((s) => {
                    const isSelected = offeredStickerId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectOfferedSticker(s.id)}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-black ring-2 ring-amber-300'
                            : 'bg-white hover:bg-amber-50/60 text-slate-700 border-slate-200 font-bold'
                        }`}
                      >
                        <span className="text-sm shrink-0">{s.emoji}</span>
                        <div className="truncate">
                          <div className={`text-[10px] font-black ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                            No.{s.number}
                          </div>
                          <div className="text-xs truncate">{s.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: 내가 받고 싶은 띠부씰 (복수 선택 가능) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">STEP 2</span>
                    <span>📥 내가 받고 싶은 띠부씰 선택 (여러 개 복수 선택 가능!)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-indigo-700">
                      {wantedStickerIds.length}종 선택됨
                    </span>
                    {wantedStickerIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWantedStickerIds([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        선택 초기화
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {filteredCatalogForWrite.map((s) => {
                    const isDisabled = s.id === offeredStickerId;
                    const isSelected = wantedStickerIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => toggleWantedSticker(s.id)}
                        className={`p-2 rounded-xl border text-left transition flex items-center gap-1.5 ${
                          isDisabled
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-black ring-2 ring-indigo-300 cursor-pointer'
                            : 'bg-white hover:bg-indigo-50/60 text-slate-700 border-slate-200 font-bold cursor-pointer'
                        }`}
                      >
                        <span className="text-sm shrink-0">{s.emoji}</span>
                        <div className="truncate">
                          <div className={`text-[10px] font-black ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            No.{s.number}
                          </div>
                          <div className="text-xs truncate">{s.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 3: 교환 약속 시간 (요일 + 시간) & 장소(로비 고정) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    🗓️ 교환 희망 요일
                  </label>
                  <select
                    value={meetDay}
                    onChange={(e) => setMeetDay(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black bg-white text-slate-800"
                  >
                    {MEET_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    ⏰ 교환 희망 시간 (10분 단위)
                  </label>
                  <select
                    value={meetTime}
                    onChange={(e) => setMeetTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black bg-white text-slate-800"
                  >
                    {MEET_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    📍 교환 장소 (고정)
                  </label>
                  <div className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black bg-slate-800 text-white flex items-center justify-center gap-1.5">
                    <span>📍</span>
                    <span>{FIXED_MEET_PLACE} (고정)</span>
                  </div>
                </div>
              </div>

              {/* 한줄 메모 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  💬 한줄 메시지 (선택)
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="예: 수업 시작 10분 전에 로비 정수기 앞에서 만나요!"
                  maxLength={120}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWriteForm(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? '등록 중...' : '🚀 교환글 등록하기'}
                </button>
              </div>
            </form>
          )}

          {/* 5. 게시글 목록 */}
          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400">
              띠부띠부씰 교환 장터 불러오는 중...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
              <div className="text-3xl">🎁</div>
              <p className="text-sm font-black text-slate-700">
                현재 조건에 맞는 띠부씰 교환글이 없습니다.
              </p>
              <p className="text-xs text-slate-400 font-bold">
                중복으로 나온 띠부씰이 있다면 첫 번째로 교환글을 올려 보세요!
              </p>
              {!showWriteForm && (
                <button
                  type="button"
                  onClick={() => setShowWriteForm(true)}
                  className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
                >
                  + 첫 교환글 올리기
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const cmtInput = getCommentInputForPost(post);
                const isCompleted = post.status === 'COMPLETED';
                const wantedSet = new Set(post.wantedStickerIds || []);
                const prioritizedCatalog = [
                  ...STICKER_CATALOG.filter((s) => wantedSet.has(s.id)),
                  ...STICKER_CATALOG.filter((s) => !wantedSet.has(s.id)),
                ];

                return (
                  <div
                    key={post.id}
                    className={`rounded-3xl border p-4 sm:p-5 transition space-y-4 ${
                      isCompleted
                        ? 'bg-slate-50/90 border-slate-200'
                        : 'bg-white border-slate-200 shadow-xs hover:border-amber-300'
                    }`}
                  >
                    {/* 카드 상단: 상태 뱃지 + 작성자 + 약속 시간/장소(로비) + 삭제 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCompleted ? (
                          <span className="bg-emerald-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">
                            🎉 교환 성사 완료
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                            🟢 교환 가능
                          </span>
                        )}

                        <span className="text-xs font-black text-slate-800">
                          {post.isMine ? (
                            <span className="text-indigo-700">🙋 내 교환글 ({post.displayAuthorName})</span>
                          ) : post.isAuthorRealNameRevealed ? (
                            <span className="text-emerald-700">
                              🎉 교환 상대 실명: {post.displayAuthorName} 학생
                            </span>
                          ) : (
                            <span>👤 {post.displayAuthorName} 학생</span>
                          )}
                        </span>

                        <span className="text-[11px] text-slate-400 font-bold">
                          · {new Date(post.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-xl">
                          🗓️ {post.meetDay} {post.meetTime}
                        </span>
                        <span className="bg-slate-800 text-white text-xs font-black px-2.5 py-1 rounded-xl">
                          📍 {post.meetPlace || FIXED_MEET_PLACE}
                        </span>
                        {post.isMine && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={actionLoadingId === `del_post_${post.id}`}
                            className="text-xs font-bold text-rose-500 hover:underline px-2 py-1 cursor-pointer"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 카드 중단: 주는 씰 ⇄ 받고 싶은 씰 */}
                    <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                      <div className="md:col-span-4 space-y-1">
                        <div className="text-[11px] font-extrabold text-amber-800">
                          📤 주는 띠부씰 (보유 중복)
                        </div>
                        <div>{renderStickerBadge(post.offeredStickerId, 'lg', true)}</div>
                      </div>

                      <div className="md:col-span-1 flex justify-center text-lg font-black text-slate-400">
                        ⇄
                      </div>

                      <div className="md:col-span-6 space-y-1">
                        <div className="text-[11px] font-extrabold text-indigo-800">
                          📥 받고 싶은 띠부씰 ({(post.wantedStickerIds || []).length}종 중 1개와 교환 희망)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(post.wantedStickerIds || []).map((wid) =>
                            renderStickerBadge(wid, 'md')
                          )}
                        </div>
                      </div>
                    </div>

                    {post.memo && (
                      <div className="text-xs font-bold text-slate-700 bg-amber-50/50 px-3.5 py-2 rounded-xl border border-amber-200/60">
                        💬 작성자 메모: &ldquo;{post.memo}&rdquo;
                      </div>
                    )}

                    {/* 💬 댓글 목록 및 댓글 작성 영역 */}
                    <div className="space-y-2.5 pt-1">
                      <div className="text-xs font-black text-slate-700 flex items-center justify-between">
                        <span>💬 교환 신청 댓글 ({(post.comments || []).length}건)</span>
                        {!isCompleted && post.isMine && (post.comments || []).length > 0 && (
                          <span className="text-[11px] font-extrabold text-amber-700">
                            💡 마음에 드는 친구의 댓글에서 [채택하기]를 누르면 교환이 확정됩니다!
                          </span>
                        )}
                      </div>

                      {(post.comments || []).length > 0 && (
                        <div className="space-y-2">
                          {(post.comments || []).map((cmt) => {
                            const isAccepted =
                              isCompleted && String(cmt.id) === String(post.acceptedCommentId);

                            return (
                              <div
                                key={cmt.id}
                                className={`p-3 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                  isAccepted
                                    ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isAccepted && (
                                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                        ✓ 채택된 교환 상대
                                      </span>
                                    )}
                                    <span className="font-black text-slate-800">
                                      {cmt.isMine ? (
                                        <span className="text-indigo-700">
                                          🙋 내 댓글 ({cmt.displayAuthorName})
                                        </span>
                                      ) : cmt.isRealNameRevealed ? (
                                        <span className="text-emerald-800 underline">
                                          🎉 실명 공개: {cmt.displayAuthorName} 학생
                                        </span>
                                      ) : (
                                        <span>{cmt.displayAuthorName} 학생</span>
                                      )}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-bold">제시한 씰:</span>
                                    {renderStickerBadge(cmt.offeredStickerId, 'md', isAccepted)}
                                  </div>
                                  <p className="text-slate-700 font-bold pl-0.5">{cmt.content}</p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  {/* 작성자 본인이고 아직 미채택 상태일 때 [채택하기] 버튼 노출 */}
                                  {post.isMine && !isCompleted && !cmt.isMine && (
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptComment(post, cmt)}
                                      disabled={actionLoadingId === `accept_${cmt.id}`}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                                    >
                                      {actionLoadingId === `accept_${cmt.id}`
                                        ? '확정 중...'
                                        : '🤝 이 친구와 교환 채택하기'}
                                    </button>
                                  )}

                                  {/* 본인 댓글 삭제 버튼 (채택 전) */}
                                  {cmt.isMine && !isAccepted && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(post, cmt.id)}
                                      disabled={actionLoadingId === `del_cmt_${cmt.id}`}
                                      className="text-[11px] font-bold text-rose-500 hover:underline px-1.5 py-1 cursor-pointer"
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 아직 진행 중인 글일 때 댓글 작성 폼 */}
                      {!isCompleted && (
                        <div className="bg-slate-100/80 p-2.5 sm:p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={cmtInput.offeredStickerId}
                            onChange={(e) =>
                              updateCommentInput(post, 'offeredStickerId', e.target.value)
                            }
                            className="p-2 border border-slate-300 rounded-xl text-xs font-black bg-white text-slate-800 sm:w-52 shrink-0"
                          >
                            {prioritizedCatalog.map((s) => {
                              const isWanted = wantedSet.has(s.id);
                              return (
                                <option key={s.id} value={s.id}>
                                  {isWanted ? '⭐ [희망씰] ' : ''}
                                  {s.emoji} {s.fullName}
                                </option>
                              );
                            })}
                          </select>

                          <input
                            type="text"
                            value={cmtInput.content}
                            onChange={(e) =>
                              updateCommentInput(post, 'content', e.target.value)
                            }
                            placeholder="저 이거 가지고 있어요! 로비에서 교환해요 🙋"
                            maxLength={120}
                            className="flex-1 p-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-800"
                          />

                          <button
                            type="button"
                            onClick={() => handleAddComment(post)}
                            disabled={actionLoadingId === `cmt_${post.id}`}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {actionLoadingId === `cmt_${post.id}`
                              ? '등록 중...'
                              : '🙋 저 이거 있어요! (댓글)'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

