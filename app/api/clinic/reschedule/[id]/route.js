import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import {
  minutesToTime,
  formatRangesSummary,
} from '@/lib/clinicUtils';

// PATCH /api/clinic/reschedule/[id] — 선생님의 클리닉 시간 변경 승인 또는 반려
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'ADMIN']);
  if (error) return error;

  const { id: requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { action, rejectReason = '' } = body; // action: 'APPROVE' | 'REJECT'

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ error: '유효한 action (APPROVE 또는 REJECT)을 지정해 주세요.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);

    // 1. 해당 변경 요청 조회
    const { data: requestRow, error: reqErr } = await db
      .from('clinic_reschedule_requests')
      .select('*, clinic_schedules(*)')
      .eq('id', requestId)
      .single();

    if (reqErr || !requestRow) {
      return NextResponse.json({ error: '해당 시간 변경 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (requestRow.status !== 'PENDING') {
      return NextResponse.json({ error: `이미 ${requestRow.status === 'APPROVED' ? '승인' : '처리'}된 요청입니다.` }, { status: 400 });
    }

    const schedule = requestRow.clinic_schedules;
    const studentId = requestRow.student_id;
    const scheduleId = requestRow.schedule_id;

    if (action === 'APPROVE') {
      // 2-A. 승인 처리:
      // (1) 기존 유효 예약 취소 처리
      await db
        .from('clinic_bookings')
        .update({ status: 'CANCELLED', memo: '시간 변경 승인으로 인한 자동 취소' })
        .eq('schedule_id', scheduleId)
        .eq('student_id', studentId)
        .neq('status', 'CANCELLED');

      // (2) 요청된 새 시간대 예약 레코드 삽입
      const requestedRanges = Array.isArray(requestRow.requested_ranges)
        ? requestRow.requested_ranges
        : [];

      const newBookingRows = requestedRanges.map((r) => ({
        schedule_id: scheduleId,
        student_id: studentId,
        start_time: r.startTime,
        end_time: r.endTime,
        status: 'BOOKED',
        subject: r.subject || requestRow.subject || null,
        memo: `시간 변경 승인 (${user.name} 선생님)`,
      }));

      if (newBookingRows.length > 0) {
        const { error: insertErr } = await db
          .from('clinic_bookings')
          .insert(newBookingRows);
        if (insertErr) throw insertErr;
      }

      // (3) 요청 상태를 APPROVED로 업데이트
      await db
        .from('clinic_reschedule_requests')
        .update({
          status: 'APPROVED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      // (4) 학생에게 승인 푸시 알림 발송
      const approvedSummary = formatRangesSummary(requestedRanges);
      try {
        await sendPushToUsers(
          [studentId],
          `🎉 [클리닉 시간 변경 승인] ${schedule?.date || ''}`,
          `선생님이 클리닉 시간 변경을 승인했습니다!\n새로운 시간: ${approvedSummary}`,
          `/student/dashboard`,
          {
            tag: `clinic-reschedule-${requestId}`,
            renotify: true,
          }
        );
      } catch (pushErr) {
        console.error('Push error on reschedule approve:', pushErr);
      }

      return NextResponse.json({
        success: true,
        message: '클리닉 시간 변경이 승인되어 적용되었습니다.',
      });
    } else {
      // 2-B. 반려 처리:
      await db
        .from('clinic_reschedule_requests')
        .update({
          status: 'REJECTED',
          reject_reason: rejectReason.trim() || '선생님 반려',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      // 학생에게 반려 푸시 알림 발송
      try {
        await sendPushToUsers(
          [studentId],
          `⚠️ [클리닉 시간 변경 반려] ${schedule?.date || ''}`,
          `클리닉 시간 변경 요청이 반려되었습니다. (기존 시간 유지)${rejectReason.trim() ? `\n사유: ${rejectReason.trim()}` : ''}`,
          `/student/dashboard`,
          {
            tag: `clinic-reschedule-${requestId}`,
            renotify: true,
          }
        );
      } catch (pushErr) {
        console.error('Push error on reschedule reject:', pushErr);
      }

      return NextResponse.json({
        success: true,
        message: '시간 변경 요청이 반려되었습니다.',
      });
    }
  } catch (err) {
    console.error('Reschedule PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
