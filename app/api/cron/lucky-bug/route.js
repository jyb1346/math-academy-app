import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createLuckyEvent, getJangStudentUserIds } from '@/lib/luckyBugService';
import { sendPushToUsers } from '@/lib/pushService';

/**
 * ⏰ 돌발 황금 벌레 자동 스케줄러 (타이머)
 * - 선생님께서 원하시는 시간대(예: 하루 2회 랜덤)를 설정하시면 자동 동작하도록 설계된 엔드포인트입니다.
 */
export async function GET(req) {
  try {
    // 🛡️ Cron 엔드포인트 보안 검증
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && !isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized: 유효하지 않은 Cron 접근입니다.' }, { status: 401 });
    }

    // 1. 장영배 원장님 계정 조회
    const db = getSupabaseAdmin(req);
    const { data: teacher } = await db
      .from('users')
      .select('id')
      .eq('role', 'HEAD_TEACHER')
      .eq('name', '장영배')
      .maybeSingle();

    if (!teacher) {
      return NextResponse.json({ ok: false, message: '등록된 원장님 계정이 없습니다.' });
    }

    const targetUserIds = await getJangStudentUserIds(req, teacher.id);

    // 2. 담당 학생 대상 2마리 황금 벌레 자동 소환
    const result = await createLuckyEvent(req, {
      teacherId: teacher.id,
      classId: null, // 전체 대상
      targetCount: 2,
      rewardText: '선생님의 깜짝 선물 🎁 (간식 쿠폰)',
    });

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error });
    }

    // 3. 담당 학생 푸시 알림 발송 (타 선생님 및 타 학생 제외) — 서버 내부 호출 (세션 없는 cron 컨텍스트이므로 공개 엔드포인트를 거치지 않음)
    if (targetUserIds && targetUserIds.length > 0) {
      sendPushToUsers(req, targetUserIds, {
        title: '🚨 [돌발 이벤트] 학원에 황금 벌레 출현! 🐛',
        message: '선착순 2명! 지금 앱에 접속해서 황금 벌레를 먼저 잡으세요!',
        url: '/student/dashboard',
        tag: `lucky-bug-${result.event.id}`,
        renotify: true,
      }).catch((e) => console.warn('Push error:', e));
    }

    return NextResponse.json({
      ok: true,
      message: '자동 황금 벌레 소환 이벤트가 성공적으로 발동되었습니다.',
      event: result.event,
    });
  } catch (err) {
    console.error('Lucky bug cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
