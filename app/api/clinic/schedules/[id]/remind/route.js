import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';

// POST /api/clinic/schedules/[id]/remind — 클리닉 미신청 학생들에게 푸시 알림 수동 재전송
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { id: scheduleId } = await params;
    const db = getSupabaseAdmin(req);

    // 1. 클리닉 일정 조회
    const { data: schedule, error: schedErr } = await db
      .from('clinic_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (schedErr || !schedule) {
      return NextResponse.json({ error: '클리닉 일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 대상 학생 목록 계산
    let targetStudentIds = [];
    const targetType = schedule.target_type || 'TEACHER_STUDENTS';

    if (targetType === 'STUDENTS') {
      if (Array.isArray(schedule.target_student_ids)) {
        targetStudentIds = schedule.target_student_ids;
      } else if (typeof schedule.target_student_ids === 'string') {
        try {
          targetStudentIds = JSON.parse(schedule.target_student_ids);
        } catch {
          targetStudentIds = [schedule.target_student_ids];
        }
      }
    } else if (targetType === 'CLASS') {
      let classIds = [];
      if (Array.isArray(schedule.target_class_ids)) {
        classIds = schedule.target_class_ids;
      } else if (typeof schedule.target_class_ids === 'string') {
        try {
          classIds = JSON.parse(schedule.target_class_ids);
        } catch {
          classIds = [schedule.target_class_ids];
        }
      }
      if (schedule.target_class_id && !classIds.includes(schedule.target_class_id)) {
        classIds.push(schedule.target_class_id);
      }

      if (classIds.length > 0) {
        const { data: cs } = await db
          .from('class_students')
          .select('student_id')
          .in('class_id', classIds);
        targetStudentIds = (cs || []).map((c) => c.student_id);
      }
    } else if (targetType === 'TEACHER_STUDENTS') {
      // 내 배정 학생 (users.teacher_id = schedule.teacher_id) + 내 반 학생들
      const { data: directStudents } = await db
        .from('users')
        .select('id')
        .eq('role', 'STUDENT')
        .eq('teacher_id', schedule.teacher_id || user.id);
      const directIds = (directStudents || []).map((s) => s.id);

      const { data: myClasses } = await db
        .from('classes')
        .select('id')
        .eq('teacher_id', schedule.teacher_id || user.id);
      const classIds = (myClasses || []).map((c) => c.id);

      let classStudentIds = [];
      if (classIds.length > 0) {
        const { data: csRows } = await db
          .from('class_students')
          .select('student_id')
          .in('class_id', classIds);
        classStudentIds = (csRows || []).map((c) => c.student_id);
      }

      targetStudentIds = [...new Set([...directIds, ...classStudentIds])];
    } else {
      // ALL
      const { data: allStudents } = await db
        .from('users')
        .select('id')
        .eq('role', 'STUDENT');
      targetStudentIds = (allStudents || []).map((s) => s.id);
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0, message: '대상 학생이 없습니다.' });
    }

    // 3. 이미 예약 신청한 학생 목록 조회
    const { data: activeBookings } = await db
      .from('clinic_bookings')
      .select('student_id')
      .eq('schedule_id', scheduleId)
      .neq('status', 'CANCELLED');

    const bookedSet = new Set((activeBookings || []).map((b) => b.student_id));
    const unbookedStudentIds = targetStudentIds.filter((sId) => !bookedSet.has(sId));

    if (unbookedStudentIds.length === 0) {
      return NextResponse.json({
        ok: true,
        sentCount: 0,
        message: '모든 대상 학생이 클리닉 신청을 완료했습니다.',
      });
    }

    // 4. 미신청 학생들에게 덮어쓰기(tag) 푸시 알림 전송
    await sendPushToUsers(req, unbookedStudentIds, {
      title: `⏰ [품수학] 클리닉 시간 선택 안내`,
      message: `[${schedule.date}] 클리닉 일정이 열려있습니다. 원하는 시간대를 선택해 주세요!`,
      url: `/student/dashboard`,
      tag: `clinic-schedule-${schedule.id}`,
      renotify: true,
    });

    return NextResponse.json({
      ok: true,
      sentCount: unbookedStudentIds.length,
      unbookedCount: unbookedStudentIds.length,
    });
  } catch (err) {
    console.error('clinic schedule remind error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

