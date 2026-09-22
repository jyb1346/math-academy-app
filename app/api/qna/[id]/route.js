import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function loadQna(db, id) {
  const { data, error } = await db.from('qna').select('*').eq('id', id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!data) return { error: NextResponse.json({ error: '질문을 찾을 수 없습니다.' }, { status: 404 }) };
  return { qna: data };
}

// PATCH /api/qna/[id] — 학생 본인의 최초 질문 수정
export async function PATCH(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { qna, error: loadErr } = await loadQna(db, id);
  if (loadErr) return loadErr;

  if (user.role !== 'STUDENT' || qna.student_id !== user.id) {
    return NextResponse.json({ error: '본인이 작성한 질문만 수정할 수 있습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { title, question } = body;
  if (!title || !title.trim() || !question || !question.trim()) {
    return NextResponse.json({ error: '제목과 질문 내용을 입력해 주세요.' }, { status: 400 });
  }

  const { error: updateErr } = await db
    .from('qna')
    .update({ title: title.trim(), question: question.trim() })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/qna/[id] — 학생 본인(미답변 시) 또는 담당 강사 본인 또는 원장님
export async function DELETE(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { qna, error: loadErr } = await loadQna(db, id);
  if (loadErr) return loadErr;

  const isOwnerStudent = user.role === 'STUDENT' && qna.student_id === user.id && !qna.answer;
  const isOwnerTeacher = (user.role === 'TEACHER' && qna.teacher_id === user.id) || user.role === 'HEAD_TEACHER';

  if (!isOwnerStudent && !isOwnerTeacher) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
  }

  const { error: deleteErr } = await db.from('qna').delete().eq('id', id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
