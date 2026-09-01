import { NextResponse } from 'next/server';
import { sendSolapiMessage, cleanPhoneNumber } from '@/lib/solapi';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
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

    // 도메인 URL 결정 (요청 헤더 origin 또는 기본 프로덕션 도메인)
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://math-academy-app-kappa.vercel.app';
    const reportUrl = `${origin}/report/${evalId}`;

    const name = studentName || '학생';
    const date = evalDate || new Date().toISOString().split('T')[0];
    const teacher = teacherName ? ` (${teacherName} 선생님)` : '';

    const subject = `[품수학] ${name} 학생 일일 학습 피드백`;
    const messageText = `[품수학 일일 학습 피드백]
안녕하세요, 학부모님!

${name} 학생의 ${date} 일일 학습 피드백${teacher}이 등록되었습니다.

아래 링크에서 6대 영역(개념/계산/응용/태도/과제/집중) 성취도 차트와 상세 코멘트를 확인해 보세요.

▶ 피드백 리포트 바로가기:
${reportUrl}`;

    // Solapi 카카오 옵션 (환경변수에 설정된 경우 알림톡 발송)
    const pfId = process.env.SOLAPI_KAKAO_PFID;
    const templateId = process.env.SOLAPI_KAKAO_TEMPLATE_ID;
    let kakaoOptions = null;

    if (pfId && templateId) {
      kakaoOptions = {
        pfId,
        templateId,
        variables: {
          '#{이름}': name,
          '#{날짜}': date,
          '#{링크}': reportUrl,
        },
      };
    }

    const result = await sendSolapiMessage({
      to: cleanTo,
      text: messageText,
      title: subject,
      kakaoOptions,
    });

    return NextResponse.json({
      success: true,
      result,
      reportUrl,
      sentTo: cleanTo,
    });
  } catch (err) {
    console.error('Solapi send-eval error:', err);
    return NextResponse.json({ error: err.message || '메시지 발송 실패' }, { status: 500 });
  }
}
