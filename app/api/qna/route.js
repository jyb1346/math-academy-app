import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { computeAvailableTargets } from '@/lib/qnaTargets';
import { sendPushToUsers } from '@/lib/pushService';

// GET /api/qna — 역할별 범위로 질문 목록 + 표시용 이름 매핑 조회
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const db = getSupabaseAdmin(req);

  let query = db.from('qna').select('*');
  if (user.role === 'STUDENT') {
    // 학생은 내 질문이거나, 공개된 질문(is_public=true)을 조회 가능
    query = query.or(`student_id.eq.${user.id},is_public.eq.true`);
  } else if (user.role === 'TEACHER') {
    query = query.eq('teacher_id', user.id);
  }
  // HEAD_TEACHER는 전체 조회 (기존 의도된 정책)

  const { data: qData, error: qErr } = await query.order('created_at', { ascending: false });
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const questions = qData || [];

  // 목록에 등장하는 학생/강사 이름 조회와 대상 목록 조회는 서로 무관하므로 병렬 실행
  const relevantIds = [...new Set(questions.flatMap((q) => [q.student_id, q.teacher_id]).filter(Boolean))];

  const [usersRes, secondaryRes] = await Promise.all([
    relevantIds.length > 0
      ? db.from('users').select('id, name').in('id', relevantIds)
      : Promise.resolve({ data: [] }),
    user.role === 'STUDENT'
      ? computeAvailableTargets(db, user)
      : db.from('users').select('id, name').in('role', ['TEACHER', 'HEAD_TEACHER']),
  ]);

  const usersMap = {};
  (usersRes.data || []).forEach((u) => { usersMap[u.id] = { name: u.name }; });

  const teachersList = user.role === 'STUDENT' ? [] : (secondaryRes.data || []);
  const availableTargets = user.role === 'STUDENT' ? secondaryRes.targets : [];

  return NextResponse.json({ questions, usersMap, teachersList, availableTargets });
}

// POST /api/qna — 학생의 1:1 최초 질문 등록
export async function POST(req) {
  const { user, error } = requireRole(req, ['STUDENT']);
  if (error) return error;

  const body = await req.json();
  const { title, question, targetTeacherId, targetClassName, imageUrls } = body;

  if (!title || !title.trim() || !question || !question.trim()) {
    return NextResponse.json({ error: '제목과 질문 내용을 입력해 주세요.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  // 🛑 학생 본인에게 실제로 배정된 선생님에게만 질문 전달 가능 (임의 teacher_id 지정 방지)
  const { targets } = await computeAvailableTargets(db, user);
  const matchedTarget = targets.find((t) => t.teacherId === targetTeacherId);
  if (!matchedTarget) {
    return NextResponse.json({ error: '유효하지 않은 담당 선생님입니다.' }, { status: 403 });
  }

  let finalTitle = title.trim();
  if (targetClassName && !finalTitle.startsWith(`[${targetClassName}]`)) {
    finalTitle = `[${targetClassName}] ${finalTitle}`;
  }

  const payload = {
    student_id: user.id,
    teacher_id: matchedTarget.teacherId,
    title: finalTitle,
    question: question.trim(),
    question_image_url: Array.isArray(imageUrls) && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
    status: 'PENDING',
    replies: [],
  };

  const { data: inserted, error: insertErr } = await db.from('qna').insert([payload]).select('id').single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  sendPushToUsers(req, [matchedTarget.teacherId], {
    title: `[1:1 질문] ${user.name} 학생의 새 질문`,
    message: finalTitle,
    url: '/qna',
  }).catch((err) => console.warn('QnA create push warning:', err));

  return NextResponse.json({ id: inserted.id });
}
