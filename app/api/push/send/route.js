import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import webpush from '@/lib/webpush';

export async function POST(req) {
  try {
    const body = await req.json();
    const { userIds, title, message, url } = body;

    let query = supabase.from('push_subscriptions').select('*');
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data: subscriptions, error } = await query;
    if (error) {
      console.warn('Could not fetch subscriptions:', error.message);
      return NextResponse.json({ ok: false, warning: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const payload = JSON.stringify({
      title: title || '품수학 학원',
      body: message || '새로운 공지 또는 알림이 도착했습니다.',
      url: url || '/',
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
          // 만료된 구독 정리
          return supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
        console.warn('Push send single error:', err.message);
      });
    });

    await Promise.allSettled(sendPromises);

    return NextResponse.json({ ok: true, count: subscriptions.length });
  } catch (err) {
    console.error('Push send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
