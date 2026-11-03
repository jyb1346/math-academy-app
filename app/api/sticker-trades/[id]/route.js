import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import {
  STICKER_MAP,
  getStickerFullName,
  maskStudentName,
  loadStickerTradeStore,
  saveStickerTradeStore,
  sanitizeTradePostForViewer,
  findAssignedTeacherIdsForStudents,
} from '@/lib/stickerTradeStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PATCH /api/sticker-trades/[id] — 댓글 등록(ADD_COMMENT) | 댓글 채택(ACCEPT_COMMENT) | 댓글 삭제(DELETE_COMMENT)
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  try {
    const { id: postId } = await params;
    const body = await req.json();
    const { action } = body;

    const db = getSupabaseAdmin(req);
    const store = await loadStickerTradeStore(db);
    const posts = Array.isArray(store.posts) ? store.posts : [];

    const postIdx = posts.findIndex((p) => p.id === postId);
    if (postIdx === -1) {
      return NextResponse.json({ error: '존재하지 않는 교환글입니다.' }, { status: 404 });
    }

    const post = {
      ...posts[postIdx],
      comments: Array.isArray(posts[postIdx].comments) ? [...posts[postIdx].comments] : [],
    };

    // 1️⃣ 댓글 달기 ("저 이거 가지고 있어요!")
    if (action === 'ADD_COMMENT') {
      if (post.status === 'COMPLETED') {
        return NextResponse.json(
          { error: '이미 교환 채택이 완료된 글입니다.' },
          { status: 400 }
        );
      }

      const { offeredStickerId, content } = body;
      const validStickerId =
        offeredStickerId && STICKER_MAP[offeredStickerId]
          ? offeredStickerId
          : (post.wantedStickerIds || [])[0] || '';

      if (!validStickerId || !STICKER_MAP[validStickerId]) {
        return NextResponse.json(
          { error: '교환해 줄 띠부씰을 선택해 주세요.' },
          { status: 400 }
        );
      }

      const trimmedContent =
        typeof content === 'string' && content.trim()
          ? content.trim().slice(0, 150)
          : '저 이거 가지고 있어요! 로비에서 교환해요 🙋';

      const newComment = {
        id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        authorId: user.id,
        authorName: user.name || '학생',
        offeredStickerId: validStickerId,
        content: trimmedContent,
        createdAt: new Date().toISOString(),
      };

      post.comments.push(newComment);
      posts[postIdx] = post;
      await saveStickerTradeStore(db, { posts });

      // 🔔 게시글 작성자(본인이 아닐 때)에게 웹 푸시 알림 발송
      if (String(post.authorId) !== String(user.id)) {
        const maskedCommenter = maskStudentName(user.name);
        const stickerLabel = getStickerFullName(validStickerId);
        sendPushToUsers(req, [post.authorId], {
          title: '💬 [띠부씰 교환장터] 새 교환 신청 댓글!',
          message: `${maskedCommenter} 학생이 [${stickerLabel}] 씰로 교환 신청 댓글을 남겼어요: "${trimmedContent}"`,
          url: '/student/dashboard?openStickerMarket=1',
          tag: `sticker_cmt_${post.id}`,
          renotify: true,
        }).catch((err) => console.warn('Sticker comment push warning:', err));
      }

      return NextResponse.json({
        post: sanitizeTradePostForViewer(post, user.id),
      });
    }

    // 2️⃣ 댓글 채택하기 (교환 확정 ➔ 두 학생 실명 공개 + 상대 학생 푸시 + 양쪽 담당 선생님 푸시)
    if (action === 'ACCEPT_COMMENT') {
      if (String(post.authorId) !== String(user.id)) {
        return NextResponse.json(
          { error: '글 작성자 본인만 댓글을 채택할 수 있습니다.' },
          { status: 403 }
        );
      }

      if (post.status === 'COMPLETED') {
        return NextResponse.json(
          { error: '이미 채택이 완료된 교환글입니다.' },
          { status: 400 }
        );
      }

      const { commentId } = body;
      const targetComment = post.comments.find((c) => c.id === commentId);
      if (!targetComment) {
        return NextResponse.json(
          { error: '채택할 댓글을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (String(targetComment.authorId) === String(user.id)) {
        return NextResponse.json(
          { error: '본인의 댓글은 채택할 수 없습니다.' },
          { status: 400 }
        );
      }

      post.status = 'COMPLETED';
      post.acceptedCommentId = targetComment.id;
      post.acceptedAt = new Date().toISOString();

      posts[postIdx] = post;
      await saveStickerTradeStore(db, { posts });

      const authorGiveLabel = getStickerFullName(post.offeredStickerId);
      const partnerGiveLabel = getStickerFullName(targetComment.offeredStickerId);
      const scheduleLabel = `${post.meetDay} ${post.meetTime} (${post.meetPlace || '학원 로비'})`;

      // 🔔 1) 채택된 댓글 작성 학생에게 웹 푸시 알림 발송 (실명 + 약속 시간/장소 안내)
      sendPushToUsers(req, [targetComment.authorId], {
        title: '🎉 [띠부씰 교환 성사] 내 댓글이 채택되었어요!',
        message: `${post.authorName} 학생과 [${scheduleLabel}]에서 교환이 확정되었습니다! (${partnerGiveLabel} ↔ ${authorGiveLabel})`,
        url: '/student/dashboard?openStickerMarket=1',
        tag: `sticker_accept_${post.id}`,
        renotify: true,
      }).catch((err) => console.warn('Sticker accept student push warning:', err));

      // 🔔 2) 교환이 확정된 두 학생의 담당 선생님 어플에도 웹 푸시 알림 발송!
      findAssignedTeacherIdsForStudents(db, [post.authorId, targetComment.authorId])
        .then((teacherIds) => {
          if (teacherIds.length > 0) {
            return sendPushToUsers(req, teacherIds, {
              title: '🤝 [띠부씰 교환 확정] 담당 학생 교환 알림',
              message: `${post.authorName} 학생 ↔ ${targetComment.authorName} 학생이 [${scheduleLabel}]에서 띠부씰(${authorGiveLabel} ↔ ${partnerGiveLabel}) 교환을 확정했습니다.`,
              url: '/teacher/dashboard',
              tag: `sticker_teacher_${post.id}`,
              renotify: true,
            });
          }
        })
        .catch((err) => console.warn('Sticker accept teacher push warning:', err));

      return NextResponse.json({
        post: sanitizeTradePostForViewer(post, user.id),
      });
    }

    // 3️⃣ 본인 댓글 삭제
    if (action === 'DELETE_COMMENT') {
      const { commentId } = body;
      const targetComment = post.comments.find((c) => c.id === commentId);
      if (!targetComment) {
        return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
      }
      if (String(targetComment.authorId) !== String(user.id)) {
        return NextResponse.json({ error: '본인의 댓글만 삭제할 수 있습니다.' }, { status: 403 });
      }
      if (post.status === 'COMPLETED' && post.acceptedCommentId === commentId) {
        return NextResponse.json(
          { error: '이미 채택 확정된 댓글은 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }

      post.comments = post.comments.filter((c) => c.id !== commentId);
      posts[postIdx] = post;
      await saveStickerTradeStore(db, { posts });

      return NextResponse.json({
        post: sanitizeTradePostForViewer(post, user.id),
      });
    }

    return NextResponse.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
  } catch (err) {
    console.error('PATCH /api/sticker-trades/[id] error:', err);
    return NextResponse.json({ error: err.message || '요청 처리 실패' }, { status: 500 });
  }
}

// DELETE /api/sticker-trades/[id] — 작성자 본인의 교환글 삭제
export async function DELETE(req, { params }) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  try {
    const { id: postId } = await params;
    const db = getSupabaseAdmin(req);
    const store = await loadStickerTradeStore(db);
    const posts = Array.isArray(store.posts) ? store.posts : [];

    const target = posts.find((p) => p.id === postId);
    if (!target) {
      return NextResponse.json({ error: '존재하지 않는 교환글입니다.' }, { status: 404 });
    }

    if (String(target.authorId) !== String(user.id)) {
      return NextResponse.json(
        { error: '본인이 작성한 교환글만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    const updatedPosts = posts.filter((p) => p.id !== postId);
    await saveStickerTradeStore(db, { posts: updatedPosts });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/sticker-trades/[id] error:', err);
    return NextResponse.json({ error: err.message || '삭제 실패' }, { status: 500 });
  }
}

