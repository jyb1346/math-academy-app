import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkIfUserIsJangTeacherOrStudent, getJangStudentUserIds } from '@/lib/luckyBugService';
import { sendPushToUsers } from '@/lib/pushService';

// POST /api/lucky-bug/[eventId]/end — 장영배 원장님 전용, 진행 중인 이벤트 강제 종료
export async function POST(req, { params }) {
  const { user, error } = requireSession(req);
  if (error) return error;
  if (!(await checkIfUserIsJangTeacherOrStudent(req, user))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { eventId } = await params;
  const db = getSupabaseAdmin(req);

  const { data: post, error: findErr } = await db.from('posts').select('*').eq('id', eventId).maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: '이벤트를 찾을 수 없습니다.' }, { status: 404 });

  let meta = {};
  try {
    meta = JSON.parse(post.content || '{}');
  } catch (e) {}

  const { error: updateErr } = await db
    .from('posts')
    .update({ content: JSON.stringify({ ...meta, status: 'FINISHED' }) })
    .eq('id', eventId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  let targetUserIds = [];
  if (post.class_id) {
    const { data: csData } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', post.class_id);
    targetUserIds = (csData || []).map((cs) => cs.student_id);
  } else {
    targetUserIds = await getJangStudentUserIds(req, user.id);
  }

  if (targetUserIds.length > 0) {
    sendPushToUsers(req, targetUserIds, {
      title: '💨 [황금 벌레 마감] 이벤트 종료 ⚡',
      message: '이벤트가 종료되었습니다. 다음 돌발 이벤트를 기대하세요!',
      url: '/student/dashboard',
      tag: `lucky-bug-${eventId}`,
      renotify: false,
    }).catch((err) => console.warn('lucky-bug end push warning:', err));
  }

  return NextResponse.json({ ok: true, isBossRaid: Boolean(meta.isBossRaid) });
}
