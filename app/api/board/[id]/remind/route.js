import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';

// POST /api/board/[id]/remind — 미확인 학생들에게 '확인 요청' 푸시 알림 수동 재전송
export async function POST(req, { params }) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  if (error) return error;

  try {
    const { id: postId } = await params;
    const db = getSupabaseAdmin(req);

    // 1. 게시글 정보 조회
    const { data: post, error: postErr } = await db
      .from('posts')
      .select('*, classes(name)')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 대상 학생 목록 조회
    let targetStudentIds = [];
    if (post.class_id) {
      const { data: csRows } = await db
        .from('class_students')
        .select('student_id')
        .eq('class_id', post.class_id);
      targetStudentIds = (csRows || []).map((c) => c.student_id);
    } else {
      const { data: allStudents } = await db
        .from('users')
        .select('id')
        .eq('role', 'STUDENT');
      targetStudentIds = (allStudents || []).map((s) => s.id);
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0, message: '대상 학생이 없습니다.' });
    }

    // 3. 이미 확인한 학생 목록 조회
    const { data: confirmedRows } = await db
      .from('post_confirmations')
      .select('student_id')
      .eq('post_id', postId);

    const confirmedSet = new Set((confirmedRows || []).map((c) => c.student_id));
    const unconfirmedStudentIds = targetStudentIds.filter((sId) => !confirmedSet.has(sId));

    if (unconfirmedStudentIds.length === 0) {
      return NextResponse.json({
        ok: true,
        sentCount: 0,
        message: '모든 대상 학생이 이미 확인을 완료했습니다.',
      });
    }

    // 4. 미확인 학생들에게 덮어쓰기(tag) 푸시 알림 전송
    const isHomework = post.category === 'NOTICE_HOMEWORK';
    const postTypeLabel = isHomework ? '숙제/공지' : '공지글';

    await sendPushToUsers(req, unconfirmedStudentIds, {
      title: `📢 [품수학] 확인 필요: ${post.title}`,
      message: `선생님이 등록한 [${postTypeLabel}]을 아직 확인하지 않았습니다. 터치하여 확인해 주세요!`,
      url: `/board?category=${post.category || 'NOTICE_HOMEWORK'}`,
      tag: `board-post-${post.id}`,
      renotify: true,
    });

    return NextResponse.json({
      ok: true,
      sentCount: unconfirmedStudentIds.length,
      unconfirmedCount: unconfirmedStudentIds.length,
    });
  } catch (err) {
    console.error('board post remind error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

