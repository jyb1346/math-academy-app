import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req) {
  try {
    const { user, error } = requireSession(req);
    if (error) return error;

    if (user.role !== 'HEAD_TEACHER') {
      return NextResponse.json({ error: '원장님만 접근할 수 있습니다.' }, { status: 403 });
    }

    const db = getSupabaseAdmin(req);

    // 1. 모든 학생 정보 가져오기
    const { data: students, error: studentError } = await db
      .from('users')
      .select('id, name, phone, school')
      .eq('role', 'STUDENT');

    if (studentError) throw studentError;

    // 2. 푸시 알림 구독 정보 가져오기
    const { data: subs, error: subError } = await db
      .from('push_subscriptions')
      .select('user_id, created_at');

    if (subError) throw subError;

    // 3. 학생 정보와 구독 정보 매핑 (중복 user_id 제거)
    const subUserIds = new Set(subs.map(s => s.user_id));
    
    const subscribedStudents = students.filter(s => subUserIds.has(s.id)).map(s => {
      const userSubs = subs.filter(sub => sub.user_id === s.id);
      // 가장 최근 구독일시 찾기
      const latestSub = userSubs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      return {
        ...s,
        subscribedAt: latestSub?.created_at,
      };
    });

    return NextResponse.json({
      totalStudents: students.length,
      subscribedCount: subscribedStudents.length,
      list: subscribedStudents,
    });
  } catch (err) {
    console.error('Push subscribers fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
