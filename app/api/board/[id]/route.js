import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH /api/board/[id] — 게시글 수정 (교사/원장 누구나 가능, 작성자 무관 — 기존 의도된 정책)
export async function PATCH(req, { params }) {
  const { error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { title, content, category, classId, dueDate } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);
  const updateData = {
    title: title.trim(),
    content: content || '',
    category,
    class_id: classId || null,
    due_date: category === 'HOMEWORK' ? dueDate || null : null,
  };

  const { error: updateErr } = await db.from('posts').update(updateData).eq('id', id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/board/[id]
export async function DELETE(req, { params }) {
  const { error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { error: deleteErr } = await db.from('posts').delete().eq('id', id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
