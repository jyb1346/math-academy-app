import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import {
  timeToMinutes,
  minutesToTime,
  blocksToRanges,
  formatRangesSummary,
  checkMultipleRangesCapacity,
} from '@/lib/clinicUtils';

// POST /api/clinic/bookings — 클리닉 시간 예약 신청 (다중 분리 구간 일괄 지원)
export async function POST(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  try {
    const body = await req.json();
    const {
      scheduleId,
      studentId,
      ranges: inputRanges,
      selectedBlocks,
      startTime,
      endTime,
      subject = '',
      memo = '',
    } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: '필수 예약 정보(일정 ID)가 누락되었습니다.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);
    const isStudent = user.role === 'STUDENT';
    const targetStudentId = isStudent ? user.id : studentId || user.id;

    // 1. 해당 클리닉 일정 조회
    const { data: schedule, error: schedErr } = await db
      .from('clinic_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (schedErr || !schedule) {
      return NextResponse.json({ error: '존재하지 않는 클리닉 일정입니다.' }, { status: 404 });
    }

    if (isStudent && !schedule.is_active) {
      return NextResponse.json({ error: '현재 마감되었거나 비활성화된 클리닉 일정입니다.' }, { status: 400 });
    }

    // 2. 예약 구간(ranges) 정규화
    let targetRanges = [];

    if (inputRanges && Array.isArray(inputRanges) && inputRanges.length > 0) {
      targetRanges = inputRanges.map((r) => {
        const startM = timeToMinutes(r.startTime);
        const endM = timeToMinutes(r.endTime);
        return {
          startTime: r.startTime,
          endTime: r.endTime,
          startMins: startM,
          endMins: endM,
          durationMinutes: endM - startM,
          subject: r.subject || subject || null,
          memo: r.memo || memo || null,
        };
      });
    } else if (selectedBlocks && Array.isArray(selectedBlocks) && selectedBlocks.length > 0) {
      targetRanges = blocksToRanges(selectedBlocks).map((r) => ({
        ...r,
        subject: subject || null,
        memo: memo || null,
      }));
    } else if (startTime) {
      const duration = schedule.duration_minutes || 120;
      const startMins = timeToMinutes(startTime);
      const endMins = endTime ? timeToMinutes(endTime) : startMins + duration;
      targetRanges = [
        {
          startTime,
          endTime: minutesToTime(endMins),
          startMins,
          endMins,
          durationMinutes: endMins - startMins,
          subject: subject || null,
          memo: memo || null,
        },
      ];
    }

    if (targetRanges.length === 0) {
      return NextResponse.json({ error: '예약할 시간 블록을 1개 이상 선택해 주세요.' }, { status: 400 });
    }

    // 운영 시간 범위 검증
    const schedStartMins = timeToMinutes(schedule.start_time);
    const schedEndMins = timeToMinutes(schedule.end_time);

    for (const r of targetRanges) {
      if (r.endMins <= r.startMins) {
        return NextResponse.json({ error: `종료 시간(${r.endTime})은 시작 시간(${r.startTime})보다 늦어야 합니다.` }, { status: 400 });
      }
      if (r.startMins < schedStartMins || r.endMins > schedEndMins) {
        return NextResponse.json({
          error: `클리닉 운영 시간(${schedule.start_time} ~ ${schedule.end_time}) 내에서만 예약 가능합니다.`,
        }, { status: 400 });
      }
    }

    // 3. 기존 예약 목록 조회 및 정원/중복 체크 (본인 기존 예약은 제외하고 계산)
    const { data: existingBookings, error: bookErr } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('schedule_id', scheduleId);

    if (bookErr) {
      return NextResponse.json({ error: bookErr.message }, { status: 500 });
    }

    const allBookings = existingBookings || [];

    // 대상 학생의 기존 활성 예약 확인
    const targetStudentBookings = allBookings.filter(
      (b) => b.student_id === targetStudentId && b.status !== 'CANCELLED'
    );
    const hasExisting = targetStudentBookings.length > 0;

    // [보안/규칙] 학생 본인의 직접 예약인 경우: 이미 활성 예약이 있다면 신규 예약(덮어쓰기) 차단!
    if (isStudent && hasExisting) {
      return NextResponse.json(
        {
          error:
            '이미 예약된 클리닉 내역이 있습니다. 시간 변경이 필요한 경우 [시간 변경 요청] 기능을 이용해 주세요.',
        },
        { status: 400 }
      );
    }

    // 다중 구간 전체 정원 체크
    if (schedule.max_capacity && schedule.max_capacity > 0) {
      const capacityValidation = checkMultipleRangesCapacity(
        targetRanges,
        allBookings,
        schedule.max_capacity,
        targetStudentId
      );

      if (capacityValidation.isFull) {
        return NextResponse.json({
          error: `선택하신 시간대 중 일부가 이미 최대 정원(${schedule.max_capacity}명)으로 마감되었습니다. 다른 시간대를 선택해 주세요.`,
        }, { status: 400 });
      }
    }

    // 4. 기존 예약 교체 (기존 학생 예약 삭제 후 신규 구간들 일괄 생성)
    // 기존 활성 예약 삭제
    await db
      .from('clinic_bookings')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('student_id', targetStudentId);

    // 선생님이 학생 예약을 직접 재배정/수정하는 경우, 해당 일정의 대기 중인 변경 요청 자동 취소(해소)
    if (!isStudent) {
      await db
        .from('clinic_reschedule_requests')
        .update({
          status: 'CANCELLED',
          reject_reason: '선생님이 일정을 직접 변경/재배정하여 자동 취소되었습니다.',
          updated_at: new Date().toISOString(),
        })
        .eq('schedule_id', scheduleId)
        .eq('student_id', targetStudentId)
        .eq('status', 'PENDING');
    }

    // 신규 구간들 삽입
    const insertRows = targetRanges.map((r) => ({
      schedule_id: scheduleId,
      student_id: targetStudentId,
      start_time: r.startTime,
      end_time: r.endTime,
      status: 'BOOKED',
      subject: r.subject ? r.subject.trim() : subject ? subject.trim() : null,
      memo: r.memo ? r.memo.trim() : memo ? memo.trim() : null,
    }));

    const { data: insertedList, error: insertErr } = await db
      .from('clinic_bookings')
      .insert(insertRows)
      .select('*');

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 5. 푸시 알림 발송
    try {
      const rangesSummary = formatRangesSummary(targetRanges);
      let studentName = user.name || '학생';
      if (!isStudent && targetStudentId !== user.id) {
        const { data: sUser } = await db
          .from('users')
          .select('name')
          .eq('id', targetStudentId)
          .single();
        if (sUser?.name) studentName = sUser.name;
      }

      if (isStudent && schedule.teacher_id) {
        // 학생이 예약했을 때 -> 담당 선생님께 알림
        sendPushToUsers(req, [schedule.teacher_id], {
          title: `[품수학 클리닉] ⏰ ${studentName} 예약 완료`,
          message: `${studentName} 학생이 ${schedule.date} ${rangesSummary} 클리닉을 예약했습니다.`,
          url: '/teacher/dashboard',
        }).catch((e) => console.warn('clinic booking teacher push warn:', e));
      } else if (!isStudent && targetStudentId !== user.id) {
        // 선생님이 대리 예약/수정했을 때 -> 학생에게 알림
        const actionTitle = hasExisting
          ? `[품수학 클리닉] ⏰ 예약 시간 변경 안내`
          : `[품수학 클리닉] ⏰ 예약 완료 안내`;
        const actionMessage = hasExisting
          ? `${schedule.date} ${rangesSummary} 주말 클리닉 시간이 변경/조정되었습니다.`
          : `${schedule.date} ${rangesSummary} 주말 클리닉이 배정되었습니다.`;

        sendPushToUsers(req, [targetStudentId], {
          title: actionTitle,
          message: actionMessage,
          url: '/student/dashboard',
        }).catch((e) => console.warn('clinic booking student push warn:', e));
      }
    } catch (pushErr) {
      console.warn('clinic booking push failed:', pushErr);
    }

    return NextResponse.json({
      bookings: insertedList,
      booking: insertedList[0] || null,
      ranges: targetRanges,
      schedule,
    });
  } catch (err) {
    console.error('clinic booking POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

