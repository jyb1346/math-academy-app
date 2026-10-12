import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// DELETE /api/admin/teachers/[id] — 강사 계정 삭제 (원장 전용, 본인/다른 원장 계정은 삭제 불가)
export async function DELETE(req, { params }) {
  const { user, error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: target, error: findErr } = await db.from('users').select('id, role').eq('id', id).maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });

  if (target.id === user.id || target.role === 'HEAD_TEACHER') {
    return NextResponse.json({ error: '원장님 본인 계정은 삭제할 수 없습니다.' }, { status: 403 });
  }

  const { error: deleteErr } = await db.from('users').delete().eq('id', id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/teachers/[id] — 강사 계정 수정 (권한, 이름 등)
export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const body = await req.json();
  const updates = {};
  if (body.role && ['TEACHER', 'HEAD_TEACHER', 'ADMIN'].includes(body.role)) {
    updates.role = body.role;
  }
  if (body.name && typeof body.name === 'string') {
    updates.name = body.name.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '수정할 데이터가 없습니다.' }, { status: 400 });
  }

  const { error: updateErr } = await db.from('users').update(updates).eq('id', id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

