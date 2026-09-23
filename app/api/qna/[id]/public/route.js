import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  const id = params.id;
  const body = await req.json();
  const { is_public } = body;

  if (typeof is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public 값은 boolean이어야 합니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  // 본인 담당 질문인지 확인 (원장님은 패스)
  if (user.role === 'TEACHER') {
    const { data: qInfo } = await db.from('qna').select('teacher_id').eq('id', id).single();
    if (!qInfo || qInfo.teacher_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
  }

  const { error: updateErr } = await db.from('qna').update({ is_public }).eq('id', id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true, is_public });
}

