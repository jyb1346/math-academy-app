import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import { timeToMinutes, minutesToTime } from '@/lib/clinicUtils';

// POST /api/clinic/bookings — 클리닉 시간 예약 신청
export async function POST(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { scheduleId, studentId, startTime, endTime, subject = '', memo = '' } = body;

    if (!scheduleId || !startTime) {
      return NextResponse.json({ error: '필수 예약 정보(일정 ID, 시작 시간)가 누락되었습니다.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);
    const isStudent = user.role === 'STUDENT';
    const targetStudentId = isStudent ? user.id : (studentId || user.id);

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

    // 2. 시간 범위 계산 (기본 2시간)
    const duration = schedule.duration_minutes || 120;
    const startMins = timeToMinutes(startTime);
    const endMins = endTime ? timeToMinutes(endTime) : startMins + duration;
    const calcEndTime = minutesToTime(endMins);

    const schedStartMins = timeToMinutes(schedule.start_time);
    const schedEndMins = timeToMinutes(schedule.end_time);

    if (startMins < schedStartMins || endMins > schedEndMins) {
      return NextResponse.json({
        error: `클리닉 운영 시간(${schedule.start_time} ~ ${schedule.end_time}) 내에서만 예약 가능합니다.`,
      }, { status: 400 });
    }

    // 3. 기존 예약 목록 조회 및 정원/중복 체크
    const { data: existingBookings, error: bookErr } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('schedule_id', scheduleId);

    if (bookErr) {
      return NextResponse.json({ error: bookErr.message }, { status: 500 });
    }

    const allBookings = existingBookings || [];

    // 같은 학생의 기존 활성 예약 확인
    const myExistingBooking = allBookings.find(
      (b) => b.student_id === targetStudentId && (b.status === 'BOOKED' || b.status === 'ATTENDED')
    );

    // 정원 제한 체크 (max_capacity가 설정되어 있을 때)
    if (schedule.max_capacity && schedule.max_capacity > 0) {
      const otherActiveBookings = allBookings.filter(
        (b) => (b.status === 'BOOKED' || b.status === 'ATTENDED') &&
               (!myExistingBooking || b.id !== myExistingBooking.id)
      );

      // 30분 단위 세그먼트 중 하나라도 정원을 초과하는지 검증
      for (let t = startMins; t < endMins; t += 30) {
        const segStart = t;
        const segEnd = t + 30;

        const countInSeg = otherActiveBookings.filter((b) => {
          const bStart = timeToMinutes(b.start_time);
          const bEnd = timeToMinutes(b.end_time);
          return bStart < segEnd && bEnd > segStart;
        }).length;

        if (countInSeg >= schedule.max_capacity) {
          return NextResponse.json({
            error: `선택하신 시간대(${startTime} ~ ${calcEndTime})는 이미 최대 정원(${schedule.max_capacity}명)이 마감되었습니다. 다른 시간대를 선택해 주세요.`,
          }, { status: 400 });
        }
      }
    }

    // 4. 예약 생성 또는 업데이트
    let savedBooking = null;

    if (myExistingBooking) {
      // 기존 예약이 있으면 시간대 업데이트
      const { data: updated, error: updateErr } = await db
        .from('clinic_bookings')
        .update({
          start_time: startTime,
          end_time: calcEndTime,
          status: 'BOOKED',
          subject: subject ? subject.trim() : myExistingBooking.subject,
          memo: memo ? memo.trim() : myExistingBooking.memo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', myExistingBooking.id)
        .select('*, users!clinic_bookings_student_id_fkey(id, name, email, parent_phone)')
        .single();

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      savedBooking = updated;
    } else {
      // 신규 예약 삽입
      const { data: inserted, error: insertErr } = await db
        .from('clinic_bookings')
        .insert([{
          schedule_id: scheduleId,
          student_id: targetStudentId,
          start_time: startTime,
          end_time: calcEndTime,
          status: 'BOOKED',
          subject: subject ? subject.trim() : null,
          memo: memo ? memo.trim() : null,
        }])
        .select('*, users!clinic_bookings_student_id_fkey(id, name, email, parent_phone)')
        .single();

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      savedBooking = inserted;
    }

    // 5. 푸시 알림 발송
    try {
      const studentName = savedBooking?.users?.name || user.name || '학생';

      if (isStudent && schedule.teacher_id) {
        // 학생이 예약했을 때 -> 담당 선생님께 알림
        sendPushToUsers(req, [schedule.teacher_id], {
          title: `[품수학 클리닉] ⏰ ${studentName} 예약 완료`,
          message: `${studentName} 학생이 ${schedule.date} ${startTime}~${calcEndTime} 클리닉을 예약했습니다.`,
          url: '/teacher/dashboard',
        }).catch((e) => console.warn('clinic booking teacher push warn:', e));
      } else if (!isStudent && targetStudentId !== user.id) {
        // 선생님이 대리 예약했을 때 -> 학생에게 알림
        sendPushToUsers(req, [targetStudentId], {
          title: `[품수학 클리닉] ⏰ 예약 완료 안내`,
          message: `${schedule.date} (${startTime}~${calcEndTime}) 주말 클리닉이 배정되었습니다.`,
          url: '/student/dashboard',
        }).catch((e) => console.warn('clinic booking student push warn:', e));
      }
    } catch (pushErr) {
      console.warn('clinic booking push failed:', pushErr);
    }

    return NextResponse.json({ booking: savedBooking, schedule });
  } catch (err) {
    console.error('clinic booking POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
