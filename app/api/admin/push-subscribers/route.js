import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req) {
  try {
    const { user, error } = requireSession(req);
    if (error) return error;

    if (user.role !== 'HEAD_TEACHER') {
      return NextResponse.json({ error: '원장님만 접근할 수 있습니다.' }, { status: 403 });
    }

    const db = getSupabaseAdmin(req);

    // 1. 모든 학생 정보 및 선생님 정보 가져오기
    const [studentsRes, teachersRes, subsRes] = await Promise.all([
      db
        .from('users')
        .select('id, name, email, parent_phone, teacher_id, created_at')
        .eq('role', 'STUDENT')
        .order('name'),
      db
        .from('users')
        .select('id, name')
        .in('role', ['TEACHER', 'HEAD_TEACHER']),
      db
        .from('push_subscriptions')
        .select('user_id, created_at'),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (teachersRes.error) throw teachersRes.error;
    if (subsRes.error) throw subsRes.error;

    const students = studentsRes.data || [];
    const subs = subsRes.data || [];
    const teacherMap = Object.fromEntries((teachersRes.data || []).map((t) => [t.id, t.name]));

    // 2. 푸시 알림 구독자 ID Set 생성
    const subUserIds = new Set(subs.map((s) => s.user_id));

    // 3. 알림 켠 학생 목록 (가장 최근 구독 일시 매핑)
    const subscribedList = students
      .filter((s) => subUserIds.has(s.id))
      .map((s) => {
        const userSubs = subs.filter((sub) => sub.user_id === s.id);
        const latestSub = userSubs.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        return {
          ...s,
          teacherName: teacherMap[s.teacher_id] || '미배정',
          subscribedAt: latestSub?.created_at,
        };
      });

    // 4. 알림 아직 안 켠 학생 목록
    const unsubscribedList = students
      .filter((s) => !subUserIds.has(s.id))
      .map((s) => ({
        ...s,
        teacherName: teacherMap[s.teacher_id] || '미배정',
      }));

    return NextResponse.json({
      totalStudents: students.length,
      subscribedCount: subscribedList.length,
      unsubscribedCount: unsubscribedList.length,
      subscribedList,
      unsubscribedList,
      list: subscribedList, // 기존 호환성 유지
    });
  } catch (err) {
    console.error('Push subscribers fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

