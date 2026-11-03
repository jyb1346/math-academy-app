import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  STICKER_MAP,
  MEET_DAYS,
  FIXED_MEET_PLACE,
  loadStickerTradeStore,
  saveStickerTradeStore,
  sanitizeTradePostForViewer,
} from '@/lib/stickerTradeStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/sticker-trades — 학생 전용 띠부띠부씰 교환 장터 전체 목록 조회
export async function GET(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  const db = getSupabaseAdmin(req);
  const store = await loadStickerTradeStore(db);

  const sortedPosts = [...(store.posts || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const sanitizedPosts = sortedPosts.map((p) => sanitizeTradePostForViewer(p, user.id));

  return NextResponse.json(
    { posts: sanitizedPosts },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}

// POST /api/sticker-trades — 학생의 새 띠부씰 교환 글 등록
export async function POST(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  try {
    const body = await req.json();
    const { offeredStickerId, wantedStickerIds, meetDay, meetTime, memo } = body;

    if (!offeredStickerId || !STICKER_MAP[offeredStickerId]) {
      return NextResponse.json(
        { error: '내가 줄(보유 중복) 띠부씰을 선택해 주세요.' },
        { status: 400 }
      );
    }

    const validWantedIds = Array.isArray(wantedStickerIds)
      ? [...new Set(wantedStickerIds.filter((id) => Boolean(STICKER_MAP[id]) && id !== offeredStickerId))]
      : [];

    if (validWantedIds.length === 0) {
      return NextResponse.json(
        { error: '받고 싶은 띠부씰을 최소 1개 이상 선택해 주세요.' },
        { status: 400 }
      );
    }

    if (!meetDay || !MEET_DAYS.includes(meetDay)) {
      return NextResponse.json({ error: '교환할 요일을 선택해 주세요.' }, { status: 400 });
    }

    if (!meetTime || typeof meetTime !== 'string') {
      return NextResponse.json({ error: '교환할 시간을 선택해 주세요.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);
    const store = await loadStickerTradeStore(db);

    const newPost = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      authorId: user.id,
      authorName: user.name || '학생',
      offeredStickerId,
      wantedStickerIds: validWantedIds,
      meetDay,
      meetTime: meetTime.trim(),
      meetPlace: FIXED_MEET_PLACE, // '학원 로비' 고정
      memo: typeof memo === 'string' ? memo.trim().slice(0, 150) : '',
      status: 'OPEN', // 'OPEN' | 'COMPLETED'
      acceptedCommentId: null,
      acceptedAt: null,
      createdAt: new Date().toISOString(),
      comments: [],
    };

    const updatedPosts = [newPost, ...(store.posts || [])];
    await saveStickerTradeStore(db, { posts: updatedPosts });

    return NextResponse.json({
      post: sanitizeTradePostForViewer(newPost, user.id),
    });
  } catch (err) {
    console.error('POST /api/sticker-trades error:', err);
    return NextResponse.json({ error: err.message || '교환글 등록 실패' }, { status: 500 });
  }
}

