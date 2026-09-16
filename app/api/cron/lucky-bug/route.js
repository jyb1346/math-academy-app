import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createLuckyEvent, getJangStudentUserIds } from '@/lib/luckyBugService';

/**
 * ⏰ 돌발 황금 벌레 자동 스케줄러 (타이머)
 * - 선생님께서 원하시는 시간대(예: 하루 2회 랜덤)를 설정하시면 자동 동작하도록 설계된 엔드포인트입니다.
 */
export async function GET(req) {
  try {
    // 1. 장영배 원장님 계정 조회
    const { data: teacher } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'HEAD_TEACHER')
      .eq('name', '장영배')
      .maybeSingle();

    if (!teacher) {
      return NextResponse.json({ ok: false, message: '등록된 원장님 계정이 없습니다.' });
    }

    const targetUserIds = await getJangStudentUserIds(teacher.id);

    // 2. 담당 학생 대상 2마리 황금 벌레 자동 소환
    const result = await createLuckyEvent({
      teacherId: teacher.id,
      classId: null, // 전체 대상
      targetCount: 2,
      rewardText: '선생님의 깜짝 선물 🎁 (간식 쿠폰)',
    });

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error });
    }

    // 3. 담당 학생 푸시 알림 발송 (타 선생님 및 타 학생 제외)
    if (targetUserIds && targetUserIds.length > 0) {
      try {
        fetch(`${req.nextUrl.origin}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: targetUserIds,
            title: '🚨 [돌발 이벤트] 학원에 황금 벌레 출현! 🐛',
            message: '선착순 2명! 지금 앱에 접속해서 황금 벌레를 먼저 잡으세요!',
            url: '/student/dashboard',
            tag: `lucky-bug-${result.event.id}`,
            renotify: true,
          }),
        }).catch((e) => console.warn('Push error:', e));
      } catch (e) {}
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
