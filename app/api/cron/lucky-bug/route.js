import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createLuckyEvent } from '@/lib/luckyBugService';

/**
 * ⏰ 돌발 황금 벌레 자동 스케줄러 (타이머)
 * - 선생님께서 원하시는 시간대(예: 하루 2회 랜덤)를 설정하시면 자동 동작하도록 설계된 엔드포인트입니다.
 */
export async function GET(req) {
  try {
    // 1. 강사 계정 하나 조회 (시스템 작성자용)
    const { data: teacher } = await supabase
      .from('users')
      .select('id')
      .in('role', ['TEACHER', 'HEAD_TEACHER'])
      .limit(1)
      .single();

    if (!teacher) {
      return NextResponse.json({ ok: false, message: '등록된 강사 계정이 없습니다.' });
    }

    // 2. 전체 학생 대상 2마리 황금 벌레 자동 소환
    const result = await createLuckyEvent({
      teacherId: teacher.id,
      classId: null, // 전체 대상
      targetCount: 2,
      rewardText: '선생님의 깜짝 선물 🎁 (간식 쿠폰)',
    });

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error });
    }

    // 3. 전체 학생 푸시 알림 발송
    try {
      fetch(`${req.nextUrl.origin}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🚨 [돌발 이벤트] 학원에 황금 벌레 출현! 🐛',
          message: '선착순 2명! 지금 앱에 접속해서 황금 벌레를 먼저 잡으세요!',
          url: '/student/dashboard',
        }),
      }).catch((e) => console.warn('Push error:', e));
    } catch (e) {}

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
