import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const body = await req.json();
    const { subscription, userId } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: '유효하지 않은 구독 정보입니다.' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!p256dh || !auth) {
      return NextResponse.json({ error: '구독 키가 누락되었습니다.' }, { status: 400 });
    }

    // Supabase push_subscriptions 테이블에 저장 (없으면 안내 메시지)
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        [
          {
            user_id: userId || null,
            endpoint,
            p256dh,
            auth,
          },
        ],
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.warn('push_subscriptions table error:', error.message);
      return NextResponse.json({ warning: error.message, ok: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
