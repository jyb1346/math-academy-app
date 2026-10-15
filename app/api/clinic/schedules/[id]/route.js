import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeClinicSchedule, serializeTargetMeta } from '@/lib/clinicUtils';

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
    if (body.isActive !== undefined) updateData.is_active = Boolean(body.isActive);

    // 공지사항 또는 대상 변경 시 기존 메타데이터 보존 처리
    if (body.notice !== undefined || body.targetType !== undefined) {
      const { data: cur } = await db.from('clinic_schedules').select('notice').eq('id', id).single();
      let metaStr = '';
      if (body.targetType !== undefined) {
        metaStr = serializeTargetMeta(body.targetType, body.targetClassIds || [], body.targetStudentIds || []);
      } else if (cur?.notice && cur.notice.includes('[TARGET_META:')) {
        const match = cur.notice.match(/\[TARGET_META:.*?\]/s);
        if (match) metaStr = match[0];
      }

      const inputNotice = body.notice !== undefined ? (body.notice ? body.notice.trim() : '') : (cur?.notice?.replace(/\[TARGET_META:.*?\]/s, '').trim() || '');
      if (metaStr) {
        updateData.notice = inputNotice ? `${inputNotice}\n${metaStr}` : metaStr;
      } else {
        updateData.notice = inputNotice || null;
      }
    }

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

    return NextResponse.json({ schedule: normalizeClinicSchedule(updated) });
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

