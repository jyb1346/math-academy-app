import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';

function parseReplies(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || [];
    } catch {
      return [];
    }
  }
  return [];
}

// POST /api/qna/[id]/resolve — 학생 본인이 "완전히 이해했어요" 처리
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  const { id } = await params;
  const db = getSupabaseAdmin(req);

  const { data: qna, error: loadErr } = await db.from('qna').select('*').eq('id', id).maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!qna) return NextResponse.json({ error: '질문을 찾을 수 없습니다.' }, { status: 404 });

  if (qna.student_id !== user.id) {
    return NextResponse.json({ error: '본인의 질문만 완료 처리할 수 있습니다.' }, { status: 403 });
  }

  const existingReplies = parseReplies(qna.replies);
  const resolveEvent = {
    id: `resolve_${Date.now()}`,
    type: 'RESOLVED',
    sender_id: user.id,
    sender_name: user.name || '학생',
    sender_role: 'STUDENT',
    content: '💡 학생이 풀이를 완전히 이해하여 해결 완료되었습니다.',
    created_at: new Date().toISOString(),
  };
  const updatedReplies = [...existingReplies, resolveEvent];

  const { error: updateErr } = await db
    .from('qna')
    .update({ status: 'ANSWERED', replies: updatedReplies })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (qna.teacher_id) {
    sendPushToUsers(req, [qna.teacher_id], {
      title: `[질문 해결] ${user.name || '학생'} 학생이 풀이를 완전히 이해했습니다! 💡`,
      message: `'${qna.title}' 질문이 해결 완료되었습니다.`,
      url: '/qna',
    }).catch((err) => console.warn('QnA resolve push warning:', err));
  }

  return NextResponse.json({ ok: true });
}
