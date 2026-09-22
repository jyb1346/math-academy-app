import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';

// POST /api/qna/[id]/answer — 교사/원장의 1차 답변 등록/수정 (담당 여부 무관, 기존 의도된 정책)
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: qna, error: loadErr } = await db.from('qna').select('*').eq('id', id).maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!qna) return NextResponse.json({ error: '질문을 찾을 수 없습니다.' }, { status: 404 });

  const body = await req.json();
  const { text, imageUrls } = body;
  if (!text || !text.trim()) {
    return NextResponse.json({ error: '답변 내용을 입력해 주세요.' }, { status: 400 });
  }

  let existingUrls = [];
  if (qna.answer_image_url) {
    try {
      existingUrls = JSON.parse(qna.answer_image_url);
    } catch {
      existingUrls = [qna.answer_image_url];
    }
  }
  const combinedUrls = [...existingUrls, ...(Array.isArray(imageUrls) ? imageUrls : [])];

  const payload = {
    answer: text.trim(),
    answer_image_url: combinedUrls.length > 0 ? JSON.stringify(combinedUrls) : null,
    status: 'ANSWERED',
    answered_at: new Date().toISOString(),
  };

  const { error: updateErr } = await db.from('qna').update(payload).eq('id', id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (qna.student_id) {
    sendPushToUsers(req, [qna.student_id], {
      title: `[1:1 답변 등록] ${user.name} 선생님의 풀이`,
      message: `'${qna.title}' 질문에 대한 풀이 답변이 등록되었습니다.`,
      url: '/qna',
    }).catch((err) => console.warn('QnA answer push warning:', err));
  }

  return NextResponse.json({ ok: true });
}
