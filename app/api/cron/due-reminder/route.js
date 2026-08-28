import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import webpush from '@/lib/webpush';

export async function GET(req) {
  try {
    // 1. 한국 시간(KST, UTC+9) 기준 오늘 날짜 계산
    const now = new Date();
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayStr = kstNow.toISOString().split('T')[0];

    // 2. 마감일이 존재하는 모든 숙제 게시글 조회
    const { data: posts, error: postErr } = await supabase
      .from('posts')
      .select('*, classes(name)')
      .eq('category', 'HOMEWORK')
      .not('due_date', 'is', null);

    if (postErr) throw postErr;
    if (!posts || posts.length === 0) {
      return NextResponse.json({ ok: true, message: '진행 중인 숙제 게시글이 없습니다.', dispatched: 0 });
    }

    // 3. 반-학생 매핑 정보 및 학생 사용자 목록 조회
    const { data: classStudents } = await supabase.from('class_students').select('*');
    const { data: users } = await supabase.from('users').select('id, role').eq('role', 'STUDENT');
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, message: '등록된 푸시 구독 기기가 없습니다.', dispatched: 0 });
    }

    const subMap = {};
    subscriptions.forEach((sub) => {
      if (sub.user_id) {
        if (!subMap[sub.user_id]) subMap[sub.user_id] = [];
        subMap[sub.user_id].push(sub);
      }
    });

    let totalNotificationsSent = 0;
    const sendPromises = [];

    for (const post of posts) {
      if (!post.due_date) continue;

      // 마감일까지 남은 일수 계산
      const dueDate = new Date(post.due_date);
      const todayDate = new Date(todayStr);
      const diffTime = dueDate.getTime() - todayDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      let notificationTitle = '';
      let notificationMessage = '';

      if (diffDays === 2) {
        // ⏰ D-2 알림
        notificationTitle = `⏰ [숙제 마감 2일 전] ${post.title}`;
        notificationMessage = `제출 마감일이 2일 남았습니다 (${post.due_date}). 숙제를 확인하고 기한 내에 제출해 주세요!`;
      } else if (diffDays === 1) {
        // 🚨 D-1 알림 (하루 전)
        notificationTitle = `🚨 [숙제 마감 D-1] ${post.title}`;
        notificationMessage = `내일(${post.due_date})이 숙제 제출 마감일입니다! 잊지 말고 꼭 제출하세요.`;
      } else {
        // D-2, D-1이 아니면 발송 스킵
        continue;
      }

      // 발송 대상 학생 ID 목록 추출
      let targetStudentIds = [];
      if (post.class_id) {
        targetStudentIds = (classStudents || [])
          .filter((cs) => String(cs.class_id) === String(post.class_id))
          .map((cs) => cs.student_id);
      } else {
        targetStudentIds = (users || []).map((u) => u.id);
      }

      // 해당 학생들의 구독 기기 찾기
      const targetSubs = [];
      targetStudentIds.forEach((sId) => {
        if (subMap[sId]) {
          targetSubs.push(...subMap[sId]);
        }
      });

      const payload = JSON.stringify({
        title: notificationTitle,
        body: notificationMessage,
        url: '/board?category=NOTICE_HOMEWORK',
      });

      for (const sub of targetSubs) {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const p = webpush.sendNotification(pushConfig, payload).then(() => {
          totalNotificationsSent++;
        }).catch((err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            return supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          console.warn('Cron push send single error:', err.message);
        });

        sendPromises.push(p);
      }
    }

    await Promise.allSettled(sendPromises);

    return NextResponse.json({
      ok: true,
      timestampKST: kstNow.toISOString(),
      dispatched: totalNotificationsSent,
    });
  } catch (err) {
    console.error('Cron reminder error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
