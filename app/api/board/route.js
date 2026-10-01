import { NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUsers } from '@/lib/pushService';

function filterVisiblePosts(posts, user, myClassIds) {
  return posts.filter((p) => {
    try {
      const m = JSON.parse(p.content || '{}');
      if (m.isLuckyEvent) return false;
    } catch (e) {
      // ignore parse error, treat as normal post
    }
    if (p.class_id !== null && !myClassIds.includes(p.class_id)) return false;
    return true;
  });
}

// GET /api/board — 게시글 + 반/학생/읽음확인 초기 데이터 일괄 조회 (역할별로 범위 제한)
export async function GET(req) {
  const { user, error } = requireSession(req);
  if (error) return error;

  const db = getSupabaseAdmin(req);
  const isStudent = user.role === 'STUDENT';

  // 서로 의존관계가 없는 조회는 병렬로 실행하고 필요한 컬럼만 한정하여 지연을 대폭 단축
  const [classesRes, csRes, postsRes, confirmRes, studentsRes] = await Promise.all([
    db.from('classes').select('id, name, teacher_id'),
    db.from('class_students').select('class_id, student_id'),
    db
      .from('posts')
      .select('id, title, content, category, author_id, class_id, due_date, created_at, users!posts_author_id_fkey(name), classes(name, teacher_id)')
      .order('created_at', { ascending: false })
      .limit(80),
    db.from('post_confirmations').select('post_id, student_id, created_at'),
    isStudent ? Promise.resolve({ data: [] }) : db.from('users').select('id, name, email').eq('role', 'STUDENT'),
  ]);

  if (postsRes.error) return NextResponse.json({ error: postsRes.error.message }, { status: 500 });

  const allClasses = classesRes.data || [];
  const classStudents = csRes.data || [];

  let myClasses = [];
  let myClassIds = [];
  let allStudents = [];

  if (isStudent) {
    myClassIds = classStudents.filter((cs) => cs.student_id === user.id).map((cs) => cs.class_id);
    myClasses = allClasses.filter((c) => myClassIds.includes(c.id));
  } else {
    myClasses = allClasses.filter((c) => c.teacher_id === user.id);
    myClassIds = myClasses.map((c) => c.id);
    allStudents = (studentsRes.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }

  const visiblePosts = filterVisiblePosts(postsRes.data || [], user, myClassIds);
  const visiblePostIds = new Set(visiblePosts.map((p) => p.id));
  const confirmations = (confirmRes.data || []).filter((c) => visiblePostIds.has(c.post_id));

  return NextResponse.json({
    posts: visiblePosts,
    classes: isStudent ? myClasses : allClasses,
    myClasses,
    myClassIds,
    classStudents: isStudent ? classStudents.filter((cs) => myClassIds.includes(cs.class_id)) : classStudents,
    allStudents,
    confirmations,
  });
}

// POST /api/board — 게시글 생성 (교사/원장만 가능)
export async function POST(req) {
  const { user, error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const body = await req.json();
  const { title, content, category, classId, dueDate, pushTargetUserIds, pushTitle, pushMessage } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);

  const postData = {
    title: title.trim(),
    content: content || '',
    category,
    author_id: user.id,
    class_id: classId || null,
    due_date: category === 'HOMEWORK' ? dueDate || null : null,
  };

  const { data: inserted, error: insertErr } = await db.from('posts').insert([postData]).select('id').single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  if (Array.isArray(pushTargetUserIds) && pushTargetUserIds.length > 0) {
    sendPushToUsers(req, pushTargetUserIds, {
      title: pushTitle || `[품수학] ${title.trim()}`,
      message: pushMessage || '새로운 게시글이 등록되었습니다.',
      url: '/board',
    }).catch((err) => console.warn('board create push warning:', err));
  }

  return NextResponse.json({ id: inserted.id });
}
