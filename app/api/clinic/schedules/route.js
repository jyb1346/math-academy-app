import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';
import {
  generateIntervalsWithAvailability,
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
      .select('*')
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

    let rawSchedules = schedules || [];

    // 🎯 학생인 경우: 대상(내 담당 교사 / 소속 반 / 지정 학생 / 전체)에 맞는 일정만 필터링
    if (isStudent) {
      const directTeacherId = user.teacher_id || null;

      // 학생의 소속 반 조회
      const { data: myClasses } = await db
        .from('class_students')
        .select('class_id')
        .eq('student_id', user.id);
      const myClassIds = (myClasses || []).map((c) => c.class_id);

      // 소속 반의 담당 교사 목록 조회
      let classTeacherIds = [];
      if (myClassIds.length > 0) {
        const { data: cRows } = await db
          .from('classes')
          .select('teacher_id')
          .in('id', myClassIds);
        classTeacherIds = (cRows || []).map((c) => c.teacher_id).filter(Boolean);
      }

      const allMyTeacherIds = new Set([directTeacherId, ...classTeacherIds].filter(Boolean));

      rawSchedules = rawSchedules.filter((sched) => {
        if (!sched.is_active) return false;

        const targetType = sched.target_type || (sched.target_class_id ? 'CLASS' : 'TEACHER_STUDENTS');

        if (targetType === 'ALL') {
          return true;
        }
        if (targetType === 'CLASS') {
          return myClassIds.includes(sched.target_class_id);
        }
        if (targetType === 'STUDENTS') {
          let targetIds = [];
          if (Array.isArray(sched.target_student_ids)) {
            targetIds = sched.target_student_ids;
          } else if (typeof sched.target_student_ids === 'string') {
            try {
              targetIds = JSON.parse(sched.target_student_ids);
            } catch {
              targetIds = [sched.target_student_ids];
            }
          }
          return targetIds.includes(user.id);
        }
        if (targetType === 'TEACHER_STUDENTS') {
          // 내 담당 교사가 개설했거나, 교사 미지정(학원 전체) 일정인 경우
          return !sched.teacher_id || allMyTeacherIds.has(sched.teacher_id);
        }

        return true;
      });
    }

    const scheduleList = rawSchedules;
    const scheduleIds = scheduleList.map((s) => s.id);

    if (scheduleIds.length === 0) {
      return NextResponse.json({
        schedules: [],
        bookings: [],
        myBookings: [],
      });
    }

    // 2. 예약 데이터 조회
    const { data: rawBookings, error: bookErr } = await db
      .from('clinic_bookings')
      .select('*')
      .in('schedule_id', scheduleIds)
      .order('start_time', { ascending: true });

    if (bookErr) {
      return NextResponse.json({ error: bookErr.message }, { status: 500 });
    }

    const initialBookings = rawBookings || [];
    const studentIds = [...new Set(initialBookings.map((b) => b.student_id).filter(Boolean))];

    let userMap = {};
    if (studentIds.length > 0) {
      const { data: userData } = await db
        .from('users')
        .select('id, name, email, parent_phone')
        .in('id', studentIds);
      (userData || []).forEach((u) => {
        userMap[u.id] = u;
      });
    }

    const bookingList = initialBookings.map((b) => ({
      ...b,
      users: userMap[b.student_id] || { id: b.student_id, name: '학생' },
    }));

    // 3. 학생 뷰 가공
    if (isStudent) {
      const enrichedSchedules = scheduleList.map((sched) => {
        const schedBookings = bookingList.filter((b) => b.schedule_id === sched.id);
        const myBookings = schedBookings.filter(
          (b) => b.student_id === user.id && b.status !== 'CANCELLED'
        );
        const myBooking = myBookings[0] || null;

        const intervals = generateIntervalsWithAvailability(
          sched.start_time,
          sched.end_time,
          schedBookings,
          sched.max_capacity,
          user.id
        );

        return {
          ...sched,
          myBooking,
          myBookings,
          intervals,
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
      targetType = 'TEACHER_STUDENTS', // 'TEACHER_STUDENTS' | 'CLASS' | 'STUDENTS' | 'ALL'
      targetClassId = null,
      targetStudentIds = [],
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
      target_type: targetType || 'TEACHER_STUDENTS',
      target_class_id: targetType === 'CLASS' ? targetClassId || null : null,
      target_student_ids: targetType === 'STUDENTS' ? targetStudentIds || [] : [],
      notice: notice ? notice.trim() : null,
      is_active: true,
    };

    let { data: inserted, error: insertErr } = await db
      .from('clinic_schedules')
      .insert([scheduleData])
      .select('*')
      .single();

    if (
      insertErr &&
      (insertErr.message?.includes('target_type') ||
        insertErr.message?.includes('target_student_ids') ||
        insertErr.code === '42703')
    ) {
      // DB에 컬럼이 아직 없는 경우 호환 fallback
      const fallbackData = { ...scheduleData };
      delete fallbackData.target_type;
      delete fallbackData.target_student_ids;
      const fallbackRes = await db
        .from('clinic_schedules')
        .insert([fallbackData])
        .select('*')
        .single();
      inserted = fallbackRes.data;
      insertErr = fallbackRes.error;
    }

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 푸시 알림 전송 옵션이 켜진 경우
    if (sendPush) {
      try {
        let targetIdsToSend = [];

        if (targetType === 'CLASS' && targetClassId) {
          const { data: cs } = await db
            .from('class_students')
            .select('student_id')
            .eq('class_id', targetClassId);
          targetIdsToSend = (cs || []).map((c) => c.student_id);
        } else if (targetType === 'STUDENTS' && Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
          targetIdsToSend = targetStudentIds;
        } else if (targetType === 'TEACHER_STUDENTS') {
          // 내 담당 학생 (users.teacher_id = user.id) + 내 반 학생들
          const { data: directStudents } = await db
            .from('users')
            .select('id')
            .eq('role', 'STUDENT')
            .eq('teacher_id', user.id);
          const directIds = (directStudents || []).map((s) => s.id);

          const { data: myClasses } = await db
            .from('classes')
            .select('id')
            .eq('teacher_id', user.id);
          const classIds = (myClasses || []).map((c) => c.id);

          let classStudentIds = [];
          if (classIds.length > 0) {
            const { data: csRows } = await db
              .from('class_students')
              .select('student_id')
              .in('class_id', classIds);
            classStudentIds = (csRows || []).map((c) => c.student_id);
          }

          targetIdsToSend = [...new Set([...directIds, ...classStudentIds])];
        } else {
          // ALL
          const { data: allSt } = await db
            .from('users')
            .select('id')
            .eq('role', 'STUDENT');
          targetIdsToSend = (allSt || []).map((s) => s.id);
        }

        if (targetIdsToSend.length > 0) {
          sendPushToUsers(req, targetIdsToSend, {
            title: `[품수학] ⏰ ${date} 클리닉 시간 선택 오픈!`,
            message: `${date} (${startTime}~${endTime}) 클리닉 일정이 열렸습니다. 원하는 시간을 선택하세요!`,
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
