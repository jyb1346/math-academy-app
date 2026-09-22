import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createLuckyEvent, getJangStudentUserIds, checkIfUserIsJangTeacherOrStudent } from '@/lib/luckyBugService';
import { sendPushToUsers } from '@/lib/pushService';

// POST /api/lucky-bug/create — 장영배 원장님 전용, 돌발 벌레/보스 레이드 소환 + 대상 학생 푸시 발송
export async function POST(req) {
  const { user, error } = requireSession(req);
  if (error) return error;
  if (!(await checkIfUserIsJangTeacherOrStudent(req, user))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    classId, bugId, isBossRaid, bossHp, hitDamage, perUserHitLimit,
    targetCount, rewardText, speedMode, customSpeedSec, escapeGimmick,
    pushTitle, pushMessage,
  } = body;

  const result = await createLuckyEvent(req, {
    teacherId: user.id,
    classId: classId || null,
    bugId,
    isBossRaid,
    bossHp,
    hitDamage,
    perUserHitLimit,
    targetCount,
    rewardText,
    speedMode,
    customSpeedSec,
    escapeGimmick,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // 대상 학생 산출: 특정 반이면 그 반 학생만, 아니면 담당 학생 전체
  let targetUserIds = [];
  if (classId) {
    const db = getSupabaseAdmin(req);
    const { data: csData } = await db
      .from('class_students')
      .select('student_id, users!class_students_student_id_fkey(role)')
      .eq('class_id', classId);
    targetUserIds = (csData || [])
      .filter((cs) => cs.users?.role === 'STUDENT' || !cs.users)
      .map((cs) => cs.student_id);
  } else {
    targetUserIds = await getJangStudentUserIds(req, user.id);
  }

  if (targetUserIds.length > 0 && pushTitle) {
    sendPushToUsers(req, targetUserIds, {
      title: pushTitle,
      message: pushMessage,
      url: '/student/dashboard',
      tag: `lucky-bug-${result.event.id}`,
      renotify: true,
    }).catch((err) => console.warn('lucky-bug create push warning:', err));
  }

  return NextResponse.json({ event: result.event, bugInfo: result.bugInfo });
}
