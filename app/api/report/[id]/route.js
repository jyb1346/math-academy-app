import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyReportToken } from '@/lib/securityUtils';
import { sendPushToUsers } from '@/lib/pushService';

// GET /api/report/[id]?t=<토큰> — 학부모 리포트 열람 (로그인 없이 서명 토큰으로만 접근)
export async function GET(req, { params }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('t');

  if (!verifyReportToken(id, token)) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 링크입니다.' }, { status: 403 });
  }

  const db = getSupabaseAdmin(req);

  const { data: evalData, error } = await db
    .from('daily_evaluations')
    .select('*, users!daily_evaluations_student_id_fkey(name)')
    .eq('id', id)
    .single();

  if (error || !evalData) {
    return NextResponse.json({ error: '등록된 피드백 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: tData } = await db
    .from('users')
    .select('id, name')
    .in('role', ['TEACHER', 'HEAD_TEACHER', 'ADMIN']);
  const teacherMap = (tData || []).reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});

  let studentAllEvals = [];
  if (evalData.student_id) {
    const { data: allEvals } = await db
      .from('daily_evaluations')
      .select('*')
      .eq('student_id', evalData.student_id)
      .order('eval_date', { ascending: true });

    studentAllEvals = (allEvals || []).map((ev) => ({
      ...ev,
      teacher_name: teacherMap[ev.teacher_id] || '',
    }));
  }

  return NextResponse.json({
    evalData,
    authorTeacherName: teacherMap[evalData.teacher_id] || '',
    studentAllEvals,
  });
}

// POST /api/report/[id]?t=<토큰> — 학부모 답장 등록
export async function POST(req, { params }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('t');

  if (!verifyReportToken(id, token)) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 링크입니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { replyText } = body;
  if (!replyText || !replyText.trim()) {
    return NextResponse.json({ error: '답장 내용을 입력해 주세요.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  const { data: evalData, error: fetchErr } = await db
    .from('daily_evaluations')
    .select('id, teacher_id, student_id, users!daily_evaluations_student_id_fkey(name)')
    .eq('id', id)
    .single();

  if (fetchErr || !evalData) {
    return NextResponse.json({ error: '등록된 피드백 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error: updateError } = await db
    .from('daily_evaluations')
    .update({ parent_reply: replyText, parent_reply_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 🔔 담당 선생님께 실시간 웹 푸시 알림 발송 (서버 내부 호출 — 공개 push/send 엔드포인트를 거치지 않음)
  if (evalData.teacher_id) {
    const studentName = evalData.users?.name || '학생';
    const trimmedReply = replyText.trim();
    const preview = trimmedReply.length > 50 ? `${trimmedReply.slice(0, 50)}...` : trimmedReply;

    sendPushToUsers(req, [evalData.teacher_id], {
      title: `💌 [학부모 답장] ${studentName} 학생 학부모님`,
      message: `"${preview}"`,
      url: '/teacher/eval/history',
    }).catch((err) => console.warn('Parent reply push send warning:', err));
  }

  return NextResponse.json({ ok: true });
}
