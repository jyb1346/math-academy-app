import { NextResponse } from 'next/server';
import { sendSolapiMessage, cleanPhoneNumber } from '@/lib/solapi';
import { supabase } from '@/lib/supabase';
import { markAlimtalkSentInComment } from '@/lib/evalUtils';
import { getKSTDateString } from '@/lib/dateUtils';
import { generateReportToken } from '@/lib/securityUtils';

export async function POST(req) {
  try {
    // 🛑 [1주일 현장 화면 점검 기간] 학부모 알림톡 실제 발송 일시 중단
    return NextResponse.json({
      success: false,
      skipped: true,
      disabled: true,
      message: '현재 1주일 현장 점검 기간으로 학부모 알림톡 발송이 일시 중단되어 있습니다.',
    });

    const body = await req.json();
    const { evalId, studentId, studentName, evalDate, parentPhone, teacherName } = body;

    if (!evalId) {
      return NextResponse.json({ error: 'evalId가 필요합니다.' }, { status: 400 });
    }

    let targetPhone = parentPhone;

    // 만약 전달받은 학부모 번호가 없으면 DB에서 학생 정보 조회
    if (!targetPhone && studentId) {
      const { data: studentUser } = await supabase
        .from('users')
        .select('name, parent_phone')
        .eq('id', studentId)
        .maybeSingle();

      targetPhone = studentUser?.parent_phone;
    }

    const cleanTo = cleanPhoneNumber(targetPhone);
    if (!cleanTo || cleanTo.length < 10) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: '등록된 학부모 연락처가 없어 알림 발송을 건너뛰었습니다.',
      });
    }

    // 도메인 URL 결정 및 보안 HMAC 토큰 생성 (학부모 1클릭 열람 유지 + URL 위변조 차단)
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://math-academy-app-kappa.vercel.app';
    const reportToken = generateReportToken(evalId);
    const reportUrl = `${origin}/report/${evalId}${reportToken ? `?t=${reportToken}` : ''}`;

    const name = studentName || '학생';
    const date = evalDate || getKSTDateString();
    const teacher = teacherName ? ` (${teacherName} 선생님)` : '';

    const subject = `[품수학] ${name} 학생 일일 학습 피드백`;
    const messageText = `[품수학 일일 학습 피드백]
안녕하세요. 
품수학전문학원입니다.

${name} 학생의 ${date} 
일일 학습 피드백이 등록되었습니다.

아래 링크에서 수업 성취도 차트와 
상세 코멘트를 확인해 보세요.

▶ 피드백 리포트 바로가기:
${reportUrl}`;

    // Solapi 카카오 알림톡 옵션
    const pfId = process.env.SOLAPI_KAKAO_PFID;
    const templateId = process.env.SOLAPI_KAKAO_TEMPLATE_ID;

    const kakaoOptions = {
      pfId,
      templateId,
      variables: {
        '#{이름}': name,
        '#{날짜}': date,
        '#{링크}': reportUrl,
      },
    };

    const result = await sendSolapiMessage({
      to: cleanTo,
      text: messageText,
      title: subject,
      kakaoOptions,
    });

    // 🎯 발송 성공 시 daily_evaluations 에 [ALIMTALK_SENT:ISO_STRING] 기록
    const sentAt = new Date().toISOString();
    try {
      const { data: currentEval } = await supabase
        .from('daily_evaluations')
        .select('teacher_comment')
        .eq('id', evalId)
        .maybeSingle();

      if (currentEval) {
        const updatedComment = markAlimtalkSentInComment(currentEval.teacher_comment, sentAt);
        await supabase
          .from('daily_evaluations')
          .update({ teacher_comment: updatedComment })
          .eq('id', evalId);
      }
    } catch (updateErr) {
      console.error('Failed to update alimtalk_sent timestamp in daily_evaluations:', updateErr);
    }

    return NextResponse.json({
      success: true,
      result,
      reportUrl,
      sentTo: cleanTo,
      alimtalkSentAt: sentAt,
    });
  } catch (err) {
    console.error('Solapi send-eval error:', err);
    return NextResponse.json({ error: err.message || '메시지 발송 실패' }, { status: 500 });
  }
}
