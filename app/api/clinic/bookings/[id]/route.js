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
      // 출석 처리 시 attended_at 자동 기록
      if (body.status === 'ATTENDED' && !booking.attended_at && !body.attended_at) {
        updateData.attended_at = new Date().toISOString();
      } else if (body.status === 'BOOKED') {
        // 출석 취소 시 시간 초기화
        updateData.attended_at = null;
        updateData.departed_at = null;
        updateData.paused_at = null;
        updateData.total_pause_minutes = 0;
      }
    }
    if (body.attended_at !== undefined) updateData.attended_at = body.attended_at;
    if (body.departed_at !== undefined) updateData.departed_at = body.departed_at;
    if (body.paused_at !== undefined) updateData.paused_at = body.paused_at;
    if (body.total_pause_minutes !== undefined) updateData.total_pause_minutes = body.total_pause_minutes;
    if (body.startTime !== undefined) updateData.start_time = body.startTime;
    if (body.endTime !== undefined) updateData.end_time = body.endTime;
    if (body.subject !== undefined) updateData.subject = body.subject ? body.subject.trim() : null;
    if (body.memo !== undefined) updateData.memo = body.memo ? body.memo.trim() : null;
    updateData.updated_at = new Date().toISOString();

    let { data: updated, error: updateErr } = await db
      .from('clinic_bookings')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (
      updateErr &&
      (updateErr.code === '42703' ||
        updateErr.message?.includes('attended_at') ||
        updateErr.message?.includes('departed_at') ||
        updateErr.message?.includes('paused_at') ||
        updateErr.message?.includes('total_pause_minutes'))
    ) {
      // DB 컬럼이 아직 없는 경우 memo JSON fallback
      const fallbackData = { ...updateData };
      delete fallbackData.attended_at;
      delete fallbackData.departed_at;
      delete fallbackData.paused_at;
      delete fallbackData.total_pause_minutes;

      let meta = {};
      try {
        if (booking.memo && booking.memo.startsWith('{')) meta = JSON.parse(booking.memo);
      } catch {}

      if (updateData.attended_at !== undefined) {
        if (updateData.attended_at === null) delete meta.attended_at;
        else meta.attended_at = updateData.attended_at;
      }
      if (updateData.departed_at !== undefined) {
        if (updateData.departed_at === null) delete meta.departed_at;
        else meta.departed_at = updateData.departed_at;
      }
      if (updateData.paused_at !== undefined) {
        if (updateData.paused_at === null) delete meta.paused_at;
        else meta.paused_at = updateData.paused_at;
      }
      if (updateData.total_pause_minutes !== undefined) {
        if (updateData.total_pause_minutes === null) delete meta.total_pause_minutes;
        else meta.total_pause_minutes = updateData.total_pause_minutes;
      }

      fallbackData.memo = JSON.stringify(meta);

      const retryRes = await db
        .from('clinic_bookings')
        .update(fallbackData)
        .eq('id', id)
        .select('*')
        .single();

      if (retryRes.data) {
        updated = {
          ...retryRes.data,
          attended_at: meta.attended_at || null,
          departed_at: meta.departed_at || null,
          paused_at: meta.paused_at || null,
          total_pause_minutes: meta.total_pause_minutes || 0,
        };
        updateErr = null;
      } else {
        updateErr = retryRes.error;
      }
    }

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (updated && updated.memo?.startsWith('{')) {
      try {
        const m = JSON.parse(updated.memo);
        if (!updated.attended_at && m.attended_at) updated.attended_at = m.attended_at;
        if (!updated.departed_at && m.departed_at) updated.departed_at = m.departed_at;
        if (!updated.paused_at && m.paused_at) updated.paused_at = m.paused_at;
        if (updated.total_pause_minutes === undefined && m.total_pause_minutes !== undefined) {
          updated.total_pause_minutes = m.total_pause_minutes;
        }
      } catch {}
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


