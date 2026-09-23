import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import {
  generateCandidateSlots,
  calculateSlotAvailability,
  generateTeacherTimetableGrid,
} from '@/lib/clinicUtils';

// GET /api/clinic/schedules — 클리닉 일정 및 예약 현황 조회
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const db = getSupabaseAdmin(req);
  const isStudent = user.role === 'STUDENT';

  try {
    // 1. 활성 클리닉 일정 조회 (최근 및 향후 일정 중심)
    let query = db
      .from('clinic_schedules')
      .select('*, users!clinic_schedules_teacher_id_fkey(name)')
      .order('date', { ascending: false })
      .order('start_time', { ascending: true });

    // 학생인 경우 활성화된 일정만 노출
    if (isStudent) {
      query = query.eq('is_active', true);
    }

    const { data: schedules, error: schedErr } = await query;
    if (schedErr) {
      // 테이블이 아직 없는 경우를 위해 친절한 에러 처리
      if (schedErr.code === 'PGRST205' || schedErr.message?.includes('schema cache')) {
        return NextResponse.json({
          schedules: [],
          bookings: [],
          myBookings: [],
          tableNotCreated: true,
        });
      }
      return NextResponse.json({ error: schedErr.message }, { status: 500 });
    }

    const scheduleList = schedules || [];
    const scheduleIds = scheduleList.map((s) => s.id);

    if (scheduleIds.length === 0) {
      return NextResponse.json({
        schedules: [],
        bookings: [],
        myBookings: [],
      });
    }

    // 2. 예약 데이터 조회
    const { data: bookings, error: bookErr } = await db
      .from('clinic_bookings')
      .select('*, users!clinic_bookings_student_id_fkey(id, name, email, parent_phone)')
      .in('schedule_id', scheduleIds)
      .order('start_time', { ascending: true });

    if (bookErr) {
      return NextResponse.json({ error: bookErr.message }, { status: 500 });
    }

    const bookingList = bookings || [];

    // 3. 학생 뷰 가공
    if (isStudent) {
      const enrichedSchedules = scheduleList.map((sched) => {
        const schedBookings = bookingList.filter((b) => b.schedule_id === sched.id);
        const myBooking = schedBookings.find(
          (b) => b.student_id === user.id && b.status !== 'CANCELLED'
        ) || null;

        const candidateSlots = generateCandidateSlots(
          sched.start_time,
          sched.end_time,
          sched.slot_interval_minutes || 30,
          sched.duration_minutes || 120
        );

        const availability = calculateSlotAvailability(
          candidateSlots,
          schedBookings,
          sched.max_capacity
        );

        return {
          ...sched,
          myBooking,
          slots: availability,
          totalBookingsCount: schedBookings.filter((b) => b.status !== 'CANCELLED').length,
        };
      });

      return NextResponse.json({
        schedules: enrichedSchedules,
        myBookings: bookingList.filter((b) => b.student_id === user.id),
      });
    }

    // 4. 교사 / 관리자 뷰 가공
    const enrichedSchedules = scheduleList.map((sched) => {
      const schedBookings = bookingList.filter((b) => b.schedule_id === sched.id);
      const timetableGrid = generateTeacherTimetableGrid(
        sched.start_time,
        sched.end_time,
        schedBookings
      );

      return {
        ...sched,
        bookings: schedBookings,
        timetableGrid,
        stats: {
          total: schedBookings.length,
          booked: schedBookings.filter((b) => b.status === 'BOOKED').length,
          attended: schedBookings.filter((b) => b.status === 'ATTENDED').length,
          absent: schedBookings.filter((b) => b.status === 'ABSENT').length,
          cancelled: schedBookings.filter((b) => b.status === 'CANCELLED').length,
        },
      };
    });

    return NextResponse.json({
      schedules: enrichedSchedules,
      bookings: bookingList,
    });
  } catch (err) {
    console.error('clinic schedules GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/clinic/schedules — 신규 클리닉 일정 개설 (교사/원장)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const {
      date,
      title = '주말 클리닉',
      startTime = '10:00',
      endTime = '18:00',
      slotIntervalMinutes = 30,
      durationMinutes = 120,
      maxCapacity = null, // null: 무제한
      targetClassId = null,
      notice = '',
      sendPush = false,
    } = body;

    if (!date) {
      return NextResponse.json({ error: '날짜를 선택해 주세요.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(req);

    const scheduleData = {
      teacher_id: user.id,
      date,
      title: title.trim(),
      start_time: startTime,
      end_time: endTime,
      slot_interval_minutes: Number(slotIntervalMinutes) || 30,
      duration_minutes: Number(durationMinutes) || 120,
      max_capacity: maxCapacity && Number(maxCapacity) > 0 ? Number(maxCapacity) : null,
      target_class_id: targetClassId || null,
      notice: notice ? notice.trim() : null,
      is_active: true,
    };

    const { data: inserted, error: insertErr } = await db
      .from('clinic_schedules')
      .insert([scheduleData])
      .select('*, users!clinic_schedules_teacher_id_fkey(name)')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 푸시 알림 전송 옵션이 켜진 경우
    if (sendPush) {
      try {
        let targetStudentIds = [];
        if (targetClassId) {
          const { data: cs } = await db
            .from('class_students')
            .select('student_id')
            .eq('class_id', targetClassId);
          targetStudentIds = (cs || []).map((c) => c.student_id);
        } else {
          const { data: st } = await db
            .from('users')
            .select('id')
            .eq('role', 'STUDENT');
          targetStudentIds = (st || []).map((s) => s.id);
        }

        if (targetStudentIds.length > 0) {
          sendPushToUsers(req, targetStudentIds, {
            title: `[품수학] ⏰ ${date} 클리닉 시간 선택 오픈!`,
            message: `${date} (${startTime}~${endTime}) 2시간 클리닉 일정이 열렸습니다. 원하는 시간을 선택하세요!`,
            url: '/student/dashboard',
          }).catch((e) => console.warn('clinic open push warn:', e));
        }
      } catch (pushErr) {
        console.warn('clinic push dispatch failed:', pushErr);
      }
    }

    return NextResponse.json({ schedule: inserted });
  } catch (err) {
    console.error('clinic schedules POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

