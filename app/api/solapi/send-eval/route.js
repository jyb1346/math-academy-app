import { NextResponse } from 'next/server';
import { sendSolapiMessage, cleanPhoneNumber } from '@/lib/solapi';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/session';
import { markAlimtalkSentInComment } from '@/lib/evalUtils';
import { getKSTDateString } from '@/lib/dateUtils';
import { generateReportToken } from '@/lib/securityUtils';

export async function POST(req) {
  try {
    const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
    if (error) return error;

    const body = await req.json();
    const { evalId, evalDate, teacherName } = body;

    if (!evalId) {
      return NextResponse.json({ error: 'evalId가 필요합니다.' }, { status: 400 });
    }

    const dbClient = getSupabaseAdmin(req);

    // 🛑 본인이 작성한 과제표에 대해서만 알림톡 발송 가능 (evalId 조작을 통한 임의 발송 차단)
    const { data: evalRow, error: evalErr } = await dbClient
      .from('daily_evaluations')
      .select('id, teacher_id, student_id, users!daily_evaluations_student_id_fkey(name, parent_phone)')
      .eq('id', evalId)
      .maybeSingle();

    if (evalErr || !evalRow) {
      return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (evalRow.teacher_id !== user.id) {
      return NextResponse.json({ error: '본인이 작성한 기록만 알림톡을 발송할 수 있습니다.' }, { status: 403 });
    }

    // 📵 학부모 연락처는 반드시 DB에 등록된 값만 사용 (클라이언트가 임의 번호를 지정할 수 없도록)
    const targetPhone = evalRow.users?.parent_phone;
    const studentName = evalRow.users?.name;

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
      const { data: currentEval } = await dbClient
        .from('daily_evaluations')
        .select('teacher_comment')
        .eq('id', evalId)
        .maybeSingle();

      if (currentEval) {
        const updatedComment = markAlimtalkSentInComment(currentEval.teacher_comment, sentAt);
        await dbClient
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
