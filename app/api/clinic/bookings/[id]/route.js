import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH /api/clinic/bookings/[id] — 클리닉 예약 상태 변경(출석/결석/취소) 또는 정보 수정
export async function PATCH(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    const db = getSupabaseAdmin(req);
    const isStudent = user.role === 'STUDENT';

    // 해당 예약 조회
    const { data: booking, error: fetchErr } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: '존재하지 않는 예약입니다.' }, { status: 404 });
    }

    // 학생은 본인의 예약만 취소/수정 가능
    if (isStudent && booking.student_id !== user.id) {
      return NextResponse.json({ error: '본인의 예약만 변경할 수 있습니다.' }, { status: 403 });
    }

    const updateData = {};
    if (body.status !== undefined) {
      // 학생은 CANCELLED만 변경 가능, 교사는 ATTENDED, ABSENT, BOOKED, CANCELLED 모두 가능
      if (isStudent && body.status !== 'CANCELLED') {
        return NextResponse.json({ error: '학생은 예약 취소만 가능합니다.' }, { status: 403 });
      }
      updateData.status = body.status;
    }
    if (body.startTime !== undefined) updateData.start_time = body.startTime;
    if (body.endTime !== undefined) updateData.end_time = body.endTime;
    if (body.subject !== undefined) updateData.subject = body.subject ? body.subject.trim() : null;
    if (body.memo !== undefined) updateData.memo = body.memo ? body.memo.trim() : null;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await db
      .from('clinic_bookings')
      .update(updateData)
      .eq('id', id)
      .select('*, users!clinic_bookings_student_id_fkey(id, name, email, parent_phone)')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ booking: updated });
  } catch (err) {
    console.error('clinic booking PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/clinic/bookings/[id] — 클리닉 예약 취소/삭제
export async function DELETE(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;

  try {
    const { id } = await params;
    const db = getSupabaseAdmin(req);
    const isStudent = user.role === 'STUDENT';

    const { data: booking, error: fetchErr } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: '존재하지 않는 예약입니다.' }, { status: 404 });
    }

    if (isStudent && booking.student_id !== user.id) {
      return NextResponse.json({ error: '본인의 예약만 취소할 수 있습니다.' }, { status: 403 });
    }

    const { error: delErr } = await db
      .from('clinic_bookings')
      .delete()
      .eq('id', id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('clinic booking DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
