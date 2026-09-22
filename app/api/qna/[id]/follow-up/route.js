import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';

// POST /api/qna/[id]/follow-up — 대화형 추가 질문(학생 본인) / 추가 답변(담당 강사 또는 원장님)
export async function POST(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: qna, error: loadErr } = await db.from('qna').select('*').eq('id', id).maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!qna) return NextResponse.json({ error: '질문을 찾을 수 없습니다.' }, { status: 404 });

  const isStudent = user.role === 'STUDENT';
  const isOwnerStudent = isStudent && qna.student_id === user.id;
  const isOwnerTeacher = !isStudent && (user.role === 'HEAD_TEACHER' || qna.teacher_id === user.id);

  if (!isOwnerStudent && !isOwnerTeacher) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { text, imageUrls } = body;
  const trimmedText = (text || '').trim();
  const images = Array.isArray(imageUrls) ? imageUrls : [];

  if (!trimmedText && images.length === 0) {
    return NextResponse.json({ error: '추가 질문이나 답변 내용을 입력해 주세요.' }, { status: 400 });
  }

  const newReply = {
    id: `reply_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sender_id: user.id,
    sender_name: user.name || (isStudent ? '학생' : '선생님'),
    sender_role: user.role,
    content: trimmedText,
    images,
    created_at: new Date().toISOString(),
  };

  let existingReplies = [];
  if (Array.isArray(qna.replies)) {
    existingReplies = qna.replies;
  } else if (typeof qna.replies === 'string') {
    try {
      existingReplies = JSON.parse(qna.replies) || [];
    } catch {
      existingReplies = [];
    }
  }

  const updatedReplies = [...existingReplies, newReply];
  const nextStatus = isStudent ? 'PENDING' : 'ANSWERED';

  const { error: updateErr } = await db
    .from('qna')
    .update({
      replies: updatedReplies,
      status: nextStatus,
      answered_at: isStudent ? qna.answered_at : new Date().toISOString(),
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const targetUserId = isStudent ? qna.teacher_id : qna.student_id;
  if (targetUserId) {
    sendPushToUsers(req, [targetUserId], {
      title: isStudent
        ? `[1:1 추가 질문] ${user.name} 학생의 재질문`
        : `[1:1 추가 답변] ${user.name} 선생님의 추가 풀이`,
      message: trimmedText ? (trimmedText.length > 40 ? trimmedText.substring(0, 40) + '...' : trimmedText) : '사진이 첨부되었습니다.',
      url: '/qna',
    }).catch((err) => console.warn('QnA follow-up push warning:', err));
  }

  return NextResponse.json({ ok: true });
}
