import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH /api/clinic/bookings/[id] — 클리닉 예약 상태 변경(출석/결석/취소) 또는 정보 수정 (교사/관리자 전용)
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    const db = getSupabaseAdmin(req);

    // 해당 예약 조회
    const { data: booking, error: fetchErr } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: '존재하지 않는 예약입니다.' }, { status: 404 });
    }

    const updateData = {};
    if (body.status !== undefined) {
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
      .select('*')
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

// DELETE /api/clinic/bookings/[id] — 클리닉 예약 취소/삭제 (교사/관리자 전용)
export async function DELETE(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const db = getSupabaseAdmin(req);

    const { data: booking, error: fetchErr } = await db
      .from('clinic_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: '존재하지 않는 예약입니다.' }, { status: 404 });
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


