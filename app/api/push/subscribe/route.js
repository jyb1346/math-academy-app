import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireSession } from '@/lib/session';

export async function POST(req) {
  try {
    const { user, error } = requireSession(req);
    if (error) return error;

    const body = await req.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: '유효하지 않은 구독 정보입니다.' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!p256dh || !auth) {
      return NextResponse.json({ error: '구독 키가 누락되었습니다.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);
    const { error: dbError } = await db.from('push_subscriptions').upsert(
      [
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
        },
      ],
      { onConflict: 'endpoint' }
    );

    if (dbError) {
      console.warn('push_subscriptions table error:', dbError.message);
      return NextResponse.json({ warning: dbError.message, ok: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
