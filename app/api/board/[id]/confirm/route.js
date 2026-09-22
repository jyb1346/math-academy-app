import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/board/[id]/confirm — 학생 본인의 "확인했습니다" 토글
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: existing } = await db
    .from('post_confirmations')
    .select('id')
    .eq('post_id', id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await db
      .from('post_confirmations')
      .delete()
      .eq('post_id', id)
      .eq('student_id', user.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ confirmed: false });
  }

  const { data: inserted, error: insErr } = await db
    .from('post_confirmations')
    .insert([{ post_id: id, student_id: user.id }])
    .select('created_at')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ confirmed: true, createdAt: inserted.created_at });
}
