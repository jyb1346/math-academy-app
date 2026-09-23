import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH /api/clinic/schedules/[id] — 클리닉 일정 수정 / 마감 토글
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    const db = getSupabaseAdmin(req);

    const updateData = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.date !== undefined) updateData.date = body.date;
    if (body.startTime !== undefined) updateData.start_time = body.startTime;
    if (body.endTime !== undefined) updateData.end_time = body.endTime;
    if (body.maxCapacity !== undefined) {
      updateData.max_capacity = body.maxCapacity && Number(body.maxCapacity) > 0 ? Number(body.maxCapacity) : null;
    }
    if (body.notice !== undefined) updateData.notice = body.notice ? body.notice.trim() : null;
    if (body.isActive !== undefined) updateData.is_active = Boolean(body.isActive);
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await db
      .from('clinic_schedules')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: updated });
  } catch (err) {
    console.error('clinic schedule PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/clinic/schedules/[id] — 클리닉 일정 삭제
export async function DELETE(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const db = getSupabaseAdmin(req);

    const { error: delErr } = await db
      .from('clinic_schedules')
      .delete()
      .eq('id', id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('clinic schedule DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

