import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import webpush from '@/lib/webpush';

export async function GET(req) {
  try {
    // 1. 상태가 'ANSWERED'인 모든 1:1 질문 레코드 조회
    const { data: qnaList, error: qnaErr } = await supabase
      .from('qna')
      .select('*')
      .eq('status', 'ANSWERED');

    if (qnaErr) throw qnaErr;
    if (!qnaList || qnaList.length === 0) {
      return NextResponse.json({ ok: true, message: '확인 대기 중인 질문이 없습니다.', dispatched: 0 });
    }

    // 2. 푸시 구독 목록 조회
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

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    let dispatchedCount = 0;

    for (const qnaItem of qnaList) {
      let replies = [];
      if (Array.isArray(qnaItem.replies)) {
        replies = qnaItem.replies;
      } else if (typeof qnaItem.replies === 'string') {
        try {
          replies = JSON.parse(qnaItem.replies) || [];
        } catch {
          replies = [];
        }
      }

      // 이미 이해 완료된 질문인 경우 스킵
      const lastReply = replies.length > 0 ? replies[replies.length - 1] : null;
      if (lastReply?.type === 'RESOLVED') {
        continue;
      }

      // 마지막 선생님 답변 시각 산출 (추가 해설 포함)
      let lastTeacherAnswerTime = qnaItem.answered_at || qnaItem.created_at;
      const teacherReplies = replies.filter((r) => r.sender_role === 'TEACHER' || r.sender_role === 'HEAD_TEACHER');
      if (teacherReplies.length > 0) {
        const lastTReply = teacherReplies[teacherReplies.length - 1];
        if (lastTReply?.created_at) {
          lastTeacherAnswerTime = lastTReply.created_at;
        }
      }

      if (!lastTeacherAnswerTime) continue;

      const timeSinceAnswer = now - new Date(lastTeacherAnswerTime).getTime();
      // 24시간이 경과하지 않았으면 스킵
      if (timeSinceAnswer < TWENTY_FOUR_HOURS_MS) {
        continue;
      }

      // 이미 해당 답변 건에 대해 24시간 리마인더를 발송했는지 체크 (중복 발송 방지)
      const alreadyReminded = replies.some(
        (r) => r.type === '24H_REMINDER' && new Date(r.created_at).getTime() >= new Date(lastTeacherAnswerTime).getTime()
      );
      if (alreadyReminded) {
        continue;
      }

      // 학생에게 리마인더 푸시 발송
      const studentId = qnaItem.student_id;
      const studentSubs = subMap[studentId] || [];

      const notificationTitle = '💡 [질문 확인] 선생님의 풀이가 잘 이해되었나요?';
      const notificationBody = `'${qnaItem.title}' 문제 풀이를 확인하셨다면 '완전히 이해했어요'를 눌러 질문을 완료해 주세요! (궁금한 점이 있다면 추가 질문도 가능해요)`;

      const payload = JSON.stringify({
        title: notificationTitle,
        body: notificationBody,
        url: '/qna',
      });

      // 학생 구독 기기에 발송
      for (const sub of studentSubs) {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushConfig, payload).catch((err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              return supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          });
        } catch (e) {
          console.warn('Reminder single send error:', e);
        }
      }

      // 24시간 리마인더 발송 기록을 replies에 안전하게 추가
      const reminderEvent = {
        id: `remind_${Date.now()}`,
        type: '24H_REMINDER',
        created_at: new Date().toISOString(),
      };

      await supabase
        .from('qna')
        .update({
          replies: [...replies, reminderEvent],
        })
        .eq('id', qnaItem.id);

      dispatchedCount++;
    }

    return NextResponse.json({
      ok: true,
      message: `24시간 경과 미완료 질문 리마인더 발송 완료: ${dispatchedCount}건`,
      dispatched: dispatchedCount,
    });
  } catch (err) {
    console.error('QnA 24h reminder error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

