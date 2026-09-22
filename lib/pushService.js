import webpush from './webpush';
import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * 서버 라우트 내부에서 직접 호출하는 push 발송 로직 (HTTP 왕복 없이 in-process 호출).
 * app/api/push/send/route.js 의 세션 인증이 걸린 공개 엔드포인트와는 별개로,
 * 이미 인증/소유권 검증이 끝난 다른 서버 라우트(과제표, QnA, 게시판, 럭키버그 등)에서 사용한다.
 */
async function dispatchPush(req, { userIds, broadcastAll = false, title, message, url, tag, renotify } = {}) {
  const db = getSupabaseAdmin(req);

  const sanitizedUserIds = Array.isArray(userIds)
    ? userIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
    : [];

  if (!broadcastAll && sanitizedUserIds.length === 0) {
    return { ok: true, count: 0 };
  }

  let query = db.from('push_subscriptions').select('*');
  if (!broadcastAll) {
    query = query.in('user_id', sanitizedUserIds);
  }

  const { data: subscriptions, error } = await query;
  if (error) {
    console.warn('pushService: could not fetch subscriptions:', error.message);
    return { ok: false, warning: error.message };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { ok: true, count: 0 };
  }

  const payload = JSON.stringify({
    title: title || '품수학 학원',
    body: message || '새로운 공지 또는 알림이 도착했습니다.',
    url: url || '/',
    tag: tag || undefined,
    renotify: typeof renotify === 'boolean' ? renotify : undefined,
  });

  const sendPromises = subscriptions.map((sub) => {
    const pushConfig = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    return webpush.sendNotification(pushConfig, payload).catch((err) => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        return db.from('push_subscriptions').delete().eq('id', sub.id);
      }
      console.warn('pushService: single send error:', err.message);
    });
  });

  await Promise.allSettled(sendPromises);

  return { ok: true, count: subscriptions.length };
}

export function sendPushToUsers(req, userIds, payload = {}) {
  return dispatchPush(req, { ...payload, userIds, broadcastAll: false });
}

export function broadcastPush(req, payload = {}) {
  return dispatchPush(req, { ...payload, broadcastAll: true });
}
