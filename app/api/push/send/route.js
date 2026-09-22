import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { sendPushToUsers, broadcastPush } from '@/lib/pushService';

export async function POST(req) {
  try {
    const { user, error } = requireSession(req);
    if (error) return error;

    const body = await req.json();
    const { userIds, title, message, url, tag, renotify, broadcastAll } = body;

    if (broadcastAll && user.role !== 'HEAD_TEACHER') {
      return NextResponse.json({ error: '전체 발송 권한이 없습니다.' }, { status: 403 });
    }

    // STUDENT는 자기 자신에게 보내는 테스트 알림만 허용, 타인 대상 발송은 TEACHER/HEAD_TEACHER만 가능
    const isSelfOnly = Array.isArray(userIds) && userIds.length === 1 && userIds[0] === user.id;
    if (!broadcastAll && user.role === 'STUDENT' && !isSelfOnly) {
      return NextResponse.json({ error: '알림 발송 권한이 없습니다.' }, { status: 403 });
    }

    const payload = { title, message, url, tag, renotify };
    const result = broadcastAll
      ? await broadcastPush(req, payload)
      : await sendPushToUsers(req, userIds, payload);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Push send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
