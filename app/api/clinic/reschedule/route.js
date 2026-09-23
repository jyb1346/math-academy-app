import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import {
  timeToMinutes,
  minutesToTime,
  blocksToRanges,
  formatRangesSummary,
} from '@/lib/clinicUtils';

// POST /api/clinic/reschedule — 학생의 클리닉 시간 변경 승인 요청 생성
export async function POST(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  try {
    const body = await req.json();
    const {
      scheduleId,
      ranges: inputRanges,
      selectedBlocks,
      subject = '',
      reason = '',
    } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: '일정 ID가 필요합니다.' }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: '시간 변경 사유를 반드시 입력해 주세요.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);

    // 1. 해당 클리닉 일정 조회
    const { data: schedule, error: schedErr } = await db
      .from('clinic_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (schedErr || !schedule) {
      return NextResponse.json({ error: '존재하지 않는 클리닉 일정입니다.' }, { status: 404 });
    }

    // 2. 학생의 기존 유효 예약 조회
    const { data: currentBookings } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('student_id', user.id)
      .neq('status', 'CANCELLED');

    const currentRanges = (currentBookings || []).map((b) => ({
      startTime: b.start_time,
      endTime: b.end_time,
      durationMinutes: timeToMinutes(b.end_time) - timeToMinutes(b.start_time),
      subject: b.subject,
    }));

    // 3. 변경 희망 구간 정규화
    let targetRanges = [];
    if (inputRanges && Array.isArray(inputRanges) && inputRanges.length > 0) {
      targetRanges = inputRanges.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        durationMinutes: timeToMinutes(r.endTime) - timeToMinutes(r.startTime),
        subject: r.subject || subject.trim() || null,
      }));
    } else if (selectedBlocks && Array.isArray(selectedBlocks) && selectedBlocks.length > 0) {
      targetRanges = blocksToRanges(selectedBlocks).map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        durationMinutes: r.durationMinutes,
        subject: subject.trim() || null,
      }));
    }

    if (targetRanges.length === 0) {
      return NextResponse.json({ error: '변경할 시간 블록을 1개 이상 선택해 주세요.' }, { status: 400 });
    }

    // 4. 기존 PENDING 상태인 요청이 있다면 취소 처리
    await db
      .from('clinic_reschedule_requests')
      .update({ status: 'CANCELLED' })
      .eq('schedule_id', scheduleId)
      .eq('student_id', user.id)
      .eq('status', 'PENDING');

    // 5. 새 변경 요청 레코드 생성
    const { data: requestRow, error: insertErr } = await db
      .from('clinic_reschedule_requests')
      .insert({
        schedule_id: scheduleId,
        student_id: user.id,
        current_ranges: currentRanges,
        requested_ranges: targetRanges,
        requested_blocks: selectedBlocks || [],
        subject: subject.trim() || null,
        reason: reason.trim(),
        status: 'PENDING',
      })
      .select()
      .single();

    if (insertErr) {
      // 테이블이 아직 없는 경우 친절한 에러 처리
      if (insertErr.code === 'PGRST205' || insertErr.message?.includes('schema cache')) {
        return NextResponse.json({
          error: 'DB에 clinic_reschedule_requests 테이블이 생성되지 않았습니다. scripts/clinic_reschedule_schema.sql을 실행해 주세요.',
          tableNotCreated: true,
        }, { status: 500 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 6. 담당 선생님 또는 관리자에게 푸시 알림 발송
    try {
      let targetTeacherIds = [];
      if (schedule.teacher_id) {
        targetTeacherIds.push(schedule.teacher_id);
      } else {
        // 학원 전체 일정인 경우 교사/관리자 전원에게 발송
        const { data: teachers } = await db
          .from('users')
          .select('id')
          .in('role', ['TEACHER', 'ADMIN']);
        targetTeacherIds = (teachers || []).map((t) => t.id);
      }

      if (targetTeacherIds.length > 0) {
        const reqSummary = formatRangesSummary(targetRanges);
        await sendPushToUsers(
          targetTeacherIds,
          `🚨 [클리닉 시간 변경 요청] ${user.name} 학생`,
          `[${schedule.date}] ${user.name} 학생이 시간 변경을 요청했습니다.\n사유: ${reason.trim()}\n희망 시간: ${reqSummary}`,
          `/teacher/dashboard`,
          {
            tag: `clinic-reschedule-${requestRow.id}`,
            renotify: true,
          }
        );
      }
    } catch (pushErr) {
      console.error('Teacher reschedule push notification error:', pushErr);
    }

    return NextResponse.json({
      success: true,
      request: requestRow,
      message: '클리닉 시간 변경 승인 요청이 선생님께 전송되었습니다. 선생님 승인 후 시간이 변경됩니다.',
    });
  } catch (err) {
    console.error('Reschedule request POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/clinic/reschedule — 변경 요청 목록 조회
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const db = getSupabaseAdmin(req);
  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get('scheduleId');

  try {
    let query = db
      .from('clinic_reschedule_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (scheduleId) {
      query = query.eq('schedule_id', scheduleId);
    }

    if (user.role === 'STUDENT') {
      query = query.eq('student_id', user.id);
    } else {
      // 선생님은 PENDING 상태 우선 조회
      query = query.eq('status', 'PENDING');
    }

    const { data: requests, error: reqErr } = await query;
    if (reqErr) {
      if (reqErr.code === 'PGRST205' || reqErr.message?.includes('schema cache')) {
        return NextResponse.json({ requests: [], tableNotCreated: true });
      }
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }

    // 학생 정보 매핑
    const sIds = [...new Set((requests || []).map((r) => r.student_id))];
    let userMap = {};
    if (sIds.length > 0) {
      const { data: userData } = await db
        .from('users')
        .select('id, name, parent_phone, class_name')
        .in('id', sIds);
      (userData || []).forEach((u) => {
        userMap[u.id] = u;
      });
    }

    const enriched = (requests || []).map((r) => ({
      ...r,
      user: userMap[r.student_id] || { name: '학생' },
    }));

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/clinic/reschedule — 학생이 자신의 변경 요청 취소
export async function DELETE(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const db = getSupabaseAdmin(req);
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');

  if (!requestId) {
    return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const { error: delErr } = await db
      .from('clinic_reschedule_requests')
      .update({ status: 'CANCELLED' })
      .eq('id', requestId)
      .eq('student_id', user.id);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true, message: '시간 변경 요청이 취소되었습니다.' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

