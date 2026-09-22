import { getSupabaseAdmin } from './supabaseAdmin';
import { sendPushToUsers } from './pushService';
import { getBugById, BUG_CATALOG } from './bugCatalog';
import { getKSTDateString } from './dateUtils';

/**
 * 🐛 돌발 벌레 & 보스 레이드 이벤트 서비스
 * (DB Check Constraint 'NOTICE' 준수 및 isLuckyEvent 메타데이터 저장)
 * 서버 라우트(app/api/lucky-bug/**)에서만 호출 — 모든 함수가 req를 받아 service_role 클라이언트로 동작한다.
 */

// 👥 장영배 선생님 담당 학생들의 User ID 목록 추출 헬퍼 (푸시 알림 대상 지정용 - 선생님 제외)
export async function getJangStudentUserIds(req, teacherId = null) {
  const db = getSupabaseAdmin(req);
  try {
    let targetTeacherId = teacherId;
    if (!targetTeacherId) {
      const { data: jangTeacher } = await db
        .from('users')
        .select('id')
        .eq('role', 'HEAD_TEACHER')
        .eq('name', '장영배')
        .maybeSingle();
      targetTeacherId = jangTeacher?.id;
    }

    if (!targetTeacherId) return [];

    // 1. 직속 학생 (role === 'STUDENT'만)
    const { data: directStudents } = await db
      .from('users')
      .select('id')
      .eq('role', 'STUDENT')
      .eq('teacher_id', targetTeacherId);

    // 2. 선생님 담당 반의 학생
    const { data: teacherClasses } = await db
      .from('classes')
      .select('id')
      .eq('teacher_id', targetTeacherId);

    const classIds = (teacherClasses || []).map((c) => c.id);
    let classStudentIds = [];
    if (classIds.length > 0) {
      const { data: csData } = await db
        .from('class_students')
        .select('student_id, users!class_students_student_id_fkey(role)')
        .in('class_id', classIds);

      classStudentIds = (csData || [])
        .filter((cs) => cs.users?.role === 'STUDENT' || !cs.users)
        .map((cs) => cs.student_id);
    }

    const allIds = new Set([
      ...(directStudents || []).map((s) => s.id),
      ...classStudentIds,
    ]);

    // 🛑 절대 전체 학생/선생님 fallback을 하지 않음! (타 선생님 학생 및 교사 유출 방지)
    if (allIds.size === 0) {
      return [];
    }

    return Array.from(allIds);
  } catch (e) {
    console.error('getJangStudentUserIds error:', e);
    return [];
  }
}

// 💨 선착순/레이드 마감 푸시 알림 발송 (기존 상단바 알림을 '마감'으로 자동 교체)
async function notifyFinishPush(req, post, eventId, summaryText) {
  const db = getSupabaseAdmin(req);
  try {
    let targetUserIds = [];
    if (post && post.class_id) {
      const { data: csData } = await db
        .from('class_students')
        .select('student_id, users!class_students_student_id_fkey(role)')
        .eq('class_id', post.class_id);
      targetUserIds = (csData || [])
        .filter((cs) => cs.users?.role === 'STUDENT' || !cs.users)
        .map((cs) => cs.student_id);
    } else if (post && post.author_id) {
      targetUserIds = await getJangStudentUserIds(req, post.author_id);
    }

    if (!targetUserIds || targetUserIds.length === 0) return; // 선생님 등 무관한 대상에게 발송 방지

    sendPushToUsers(req, targetUserIds, {
      title: '💨 [황금 벌레 마감] 이벤트 종료 ⚡',
      message: summaryText || '벌레 이벤트가 종료되었습니다. 다음 돌발 이벤트를 기대하세요!',
      url: '/student/dashboard',
      tag: `lucky-bug-${eventId}`,
      renotify: false,
    }).catch((e) => console.warn('Finish push warning:', e));
  } catch (err) {
    console.warn('notifyFinishPush error:', err);
  }
}

// 🔍 장영배 원장님 및 담당 학생 식별 헬퍼 (다른 선생님 및 타 학생 노출 방지)
export async function checkIfUserIsJangTeacherOrStudent(req, user) {
  if (!user) return false;
  const db = getSupabaseAdmin(req);

  // 1. 선생님 본인인 경우: 오직 장영배 원장님 계정만 허용
  if (user.role === 'TEACHER' || user.role === 'HEAD_TEACHER') {
    return user.role === 'HEAD_TEACHER' && user.name === '장영배';
  }

  // 2. 학생인 경우: 담당 선생님이 장영배 원장님인지 확인 (장영배2 등 제외)
  if (user.role === 'STUDENT') {
    try {
      // 장영배 원장님 계정 ID 목록 조회 (정확히 role: 'HEAD_TEACHER', name: '장영배')
      const { data: jangTeachers } = await db
        .from('users')
        .select('id')
        .eq('role', 'HEAD_TEACHER')
        .eq('name', '장영배');

      const jangTeacherIds = (jangTeachers || []).map((t) => t.id);
      if (jangTeacherIds.length === 0) return false;

      // 1) 학생의 직속 teacher_id 확인
      if (user.teacher_id && jangTeacherIds.includes(user.teacher_id)) {
        return true;
      }

      // 2) 학생의 소속 반의 담임 선생님 확인
      const { data: csData } = await db
        .from('class_students')
        .select('class_id, classes(teacher_id)')
        .eq('student_id', user.id);

      const hasJangClass = (csData || []).some((cs) =>
        jangTeacherIds.includes(cs.classes?.teacher_id)
      );

      return hasJangClass;
    } catch (e) {
      console.error('checkIfUserIsJangTeacherOrStudent error:', e);
      return false;
    }
  }

  return false;
}

// 1. 활성화된 이벤트 조회 (대상 반 or 전체)
export async function getActiveLuckyEvent(req, studentClassIds = [], studentId = null) {
  const db = getSupabaseAdmin(req);
  try {
    const { data: posts, error } = await db
      .from('posts')
      .select('*')
      .eq('category', 'NOTICE')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !posts) return null;

    for (const post of posts) {
      try {
        const meta = JSON.parse(post.content || '{}');
        if (meta.isLuckyEvent && meta.status === 'ACTIVE') {
          // 대상 반 확인
          let isEligible = false;
          if (post.class_id) {
            isEligible = studentClassIds.includes(String(post.class_id));
          } else if (post.author_id) {
            // post.class_id가 null(모든반)인 경우: 해당 작성자(선생님)의 학생인지 확인
            const jangStudentIds = await getJangStudentUserIds(req, post.author_id);
            isEligible = Boolean(studentId && jangStudentIds.includes(studentId));
          }

          if (isEligible) {
            // 🛑 이미 내가 포획 완료한 일반 벌레인지 확인 (또는 보스전 최대 타격 완료 여부)
            if (studentId) {
              if (!meta.isBossRaid) {
                const { data: myCatch } = await db
                  .from('post_confirmations')
                  .select('id')
                  .eq('post_id', post.id)
                  .eq('student_id', studentId)
                  .maybeSingle();

                if (myCatch) continue; // 내가 이미 잡은 벌레면 다시 화면에 띄우지 않음!
              } else {
                const myHits = meta.hitsByUser?.[studentId] || 0;
                const myLimit = Number(meta.perUserHitLimit) || 5;
                if (myHits >= myLimit) {
                  continue; // 보스전 최대 타격을 이미 완료한 학생은 화면을 방해하지 않음!
                }
              }
            }

            const bugInfo = getBugById(meta.bugId || 'gold_beetle');
            return {
              id: post.id,
              title: post.title,
              classId: post.class_id,
              bugId: meta.bugId || 'gold_beetle',
              bugInfo,
              isBossRaid: Boolean(meta.isBossRaid),
              maxHp: Number(meta.maxHp) || 30,
              currentHp: meta.currentHp !== undefined ? Number(meta.currentHp) : Number(meta.maxHp) || 30,
              hitDamage: Number(meta.hitDamage) || 5,
              perUserHitLimit: Number(meta.perUserHitLimit) || 5,
              targetCount: meta.targetCount || 2,
              rewardText: meta.rewardText || '선생님의 깜짝 선물',
              speedMode: meta.speedMode || bugInfo.defaultSpeed || 'FAST',
              customSpeedSec: meta.customSpeedSec !== undefined ? Number(meta.customSpeedSec) : undefined,
              escapeGimmick: meta.escapeGimmick !== undefined ? meta.escapeGimmick : bugInfo.escapeGimmick,
              hitsByUser: meta.hitsByUser || {},
              damageByUser: meta.damageByUser || {},
              combatLogs: meta.combatLogs || [],
              createdAt: post.created_at,
            };
          }
        }
      } catch (e) {}
    }
    return null;
  } catch (err) {
    console.error('getActiveLuckyEvent error:', err);
    return null;
  }
}

// 1-2. 최근 마감된 이벤트 조회 (최근 3시간 이내 안내용)
export async function getRecentFinishedLuckyEvent(req, studentClassIds = [], studentId = null) {
  const db = getSupabaseAdmin(req);
  try {
    const { data: posts, error } = await db
      .from('posts')
      .select('*')
      .eq('category', 'NOTICE')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !posts) return null;

    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);

    for (const post of posts) {
      try {
        const meta = JSON.parse(post.content || '{}');
        const postTime = new Date(post.created_at).getTime();

        if (meta.isLuckyEvent && postTime >= threeHoursAgo) {
          let isEligible = false;
          if (post.class_id) {
            isEligible = studentClassIds.includes(String(post.class_id));
          } else if (post.author_id) {
            const jangStudentIds = await getJangStudentUserIds(req, post.author_id);
            isEligible = Boolean(studentId && jangStudentIds.includes(studentId));
          }

          if (isEligible) {
            if (studentId) {
              const { data: myCatch } = await db
                .from('post_confirmations')
                .select('id')
                .eq('post_id', post.id)
                .eq('student_id', studentId)
                .maybeSingle();

              if (myCatch) continue; // 내가 이미 잡았으면 마감 알림 불필요
            }

            const { data: catches } = await db
              .from('post_confirmations')
              .select('id')
              .eq('post_id', post.id);

            const isFinished = meta.status === 'FINISHED' || (!meta.isBossRaid && catches && catches.length >= (meta.targetCount || 2));
            if (isFinished) {
              const bugInfo = getBugById(meta.bugId || 'gold_beetle');
              return {
                id: post.id,
                title: post.title,
                bugName: bugInfo.name,
                bugEmoji: bugInfo.emoji,
                isBossRaid: Boolean(meta.isBossRaid),
                rewardText: meta.rewardText || '선생님의 깜짝 선물',
                targetCount: meta.targetCount || 2,
                winnerCount: catches?.length || (meta.targetCount || 2),
                createdAt: post.created_at,
              };
            }
          }
        }
      } catch (e) {}
    }
    return null;
  } catch (err) {
    console.error('getRecentFinishedLuckyEvent error:', err);
    return null;
  }
}

// 2. 일반 벌레 포획 시도 (선착순 판별)
export async function catchLuckyBug(req, eventId, studentId, studentName) {
  const db = getSupabaseAdmin(req);
  try {
    const { data: post, error: postErr } = await db
      .from('posts')
      .select('*')
      .eq('id', eventId)
      .single();

    if (postErr || !post) {
      return { success: false, reason: 'NOT_FOUND', message: '이벤트를 찾을 수 없습니다.' };
    }

    const meta = JSON.parse(post.content || '{}');
    if (!meta.isLuckyEvent || meta.status !== 'ACTIVE') {
      return { success: false, reason: 'ALREADY_FINISHED', message: '이미 마감된 이벤트입니다.' };
    }

    const bugInfo = getBugById(meta.bugId || 'gold_beetle');
    const targetCount = meta.targetCount || 2;

    const { data: existingCatches, error: catchErr } = await db
      .from('post_confirmations')
      .select('*')
      .eq('post_id', eventId)
      .order('created_at', { ascending: true });

    if (catchErr) {
      return { success: false, reason: 'ERROR', message: catchErr.message };
    }

    const alreadyCaught = existingCatches?.some((c) => c.student_id === studentId);
    if (alreadyCaught) {
      const myRank = existingCatches.findIndex((c) => c.student_id === studentId) + 1;
      return {
        success: true,
        rank: myRank,
        bugInfo,
        rewardText: meta.rewardText,
        message: '이미 포획 성공하셨습니다!',
      };
    }

    if (existingCatches && existingCatches.length >= targetCount) {
      await db
        .from('posts')
        .update({
          content: JSON.stringify({ ...meta, status: 'FINISHED' }),
        })
        .eq('id', eventId);

      notifyFinishPush(req, post, eventId, `선착순 ${targetCount}명이 ${bugInfo.name}을(를) 모두 잡았습니다!`);
      return { success: false, reason: 'FULL', message: '아쉽게도 선착순 마감되었습니다!' };
    }

    // 포획 등록
    const { error: insertErr } = await db
      .from('post_confirmations')
      .insert([
        {
          post_id: eventId,
          student_id: studentId,
        },
      ]);

    if (insertErr) {
      return { success: false, reason: 'ERROR', message: '포획 등록 중 오류가 발생했습니다.' };
    }

    const currentRank = (existingCatches?.length || 0) + 1;

    if (currentRank >= targetCount) {
      await db
        .from('posts')
        .update({
          content: JSON.stringify({ ...meta, status: 'FINISHED' }),
        })
        .eq('id', eventId);

      notifyFinishPush(req, post, eventId, `선착순 ${targetCount}명이 ${bugInfo.name}을(를) 모두 잡았습니다!`);
    }

    return {
      success: true,
      rank: currentRank,
      bugInfo,
      rewardText: meta.rewardText,
      message: `축하합니다! ${currentRank}등으로 ${bugInfo.name}을(를) 잡았습니다!`,
    };
  } catch (err) {
    console.error('catchLuckyBug error:', err);
    return { success: false, reason: 'ERROR', message: err.message };
  }
}

// 2-2. 👑 보스 레이드 타격 핸들러 (실시간 협동)
export async function hitBossRaid(req, eventId, studentId, studentName, damage = null) {
  const db = getSupabaseAdmin(req);
  try {
    const { data: post, error: postErr } = await db
      .from('posts')
      .select('*')
      .eq('id', eventId)
      .single();

    if (postErr || !post) {
      return { success: false, reason: 'NOT_FOUND', message: '보스를 찾을 수 없습니다.' };
    }

    const meta = JSON.parse(post.content || '{}');
    if (!meta.isLuckyEvent || meta.status !== 'ACTIVE' || !meta.isBossRaid) {
      return { success: false, reason: 'ALREADY_FINISHED', message: '이미 쓰러진 보스입니다!' };
    }

    const bugInfo = getBugById(meta.bugId || 'boss_stag_beetle');
    const actualDamage = damage !== null && damage !== undefined ? Number(damage) : (Number(meta.hitDamage) || 5);
    const perUserHitLimit = Number(meta.perUserHitLimit) || 5;
    const hitsByUser = meta.hitsByUser || {};
    const damageByUser = meta.damageByUser || {};
    const studentNames = meta.studentNames || {};
    const combatLogs = meta.combatLogs || [];

    const myCurrentHits = hitsByUser[studentId] || 0;
    if (myCurrentHits >= perUserHitLimit) {
      return {
        success: false,
        reason: 'HIT_LIMIT',
        message: `이 보스에게 가할 수 있는 최대 타격 수(${perUserHitLimit}타)를 모두 사용했습니다! 친구들의 공격을 응원하세요!`,
      };
    }

    // 타격 계산
    const newHits = myCurrentHits + 1;
    hitsByUser[studentId] = newHits;
    damageByUser[studentId] = (damageByUser[studentId] || 0) + actualDamage;
    if (studentName) {
      studentNames[studentId] = studentName;
    }

    const newCurrentHp = Math.max(0, (meta.currentHp !== undefined ? meta.currentHp : meta.maxHp || 30) - actualDamage);

    // 로그 추가 (최신 6개 유지)
    combatLogs.unshift({
      id: Date.now() + Math.random(),
      studentId,
      studentName,
      damage: actualDamage,
      text: `${studentName} 학생이 보스에게 일격! (-${actualDamage} HP)`,
      timestamp: new Date().toISOString(),
    });
    if (combatLogs.length > 6) combatLogs.pop();

    const isCleared = newCurrentHp <= 0;

    const updatedMeta = {
      ...meta,
      currentHp: newCurrentHp,
      hitsByUser,
      damageByUser,
      studentNames,
      combatLogs,
      status: isCleared ? 'FINISHED' : 'ACTIVE',
    };

    // 보스 격파 시 MVP & 피니셔 계산
    let mvp = null;
    let finisher = null;
    if (isCleared) {
      let maxDmg = 0;
      let mvpId = studentId;
      for (const [sId, dmg] of Object.entries(damageByUser)) {
        if (dmg > maxDmg) {
          maxDmg = dmg;
          mvpId = sId;
        }
      }
      mvp = { studentId: mvpId, damage: maxDmg };
      finisher = { studentId, studentName };
      updatedMeta.mvp = mvp;
      updatedMeta.finisher = finisher;

      // 참여한 모든 학생에게 post_confirmations 등록 (도감 획득)
      const participantIds = Object.keys(hitsByUser);
      if (participantIds.length > 0) {
        const rows = participantIds.map((pId) => ({
          post_id: eventId,
          student_id: pId,
        }));
        await db.from('post_confirmations').upsert(rows, { onConflict: 'post_id,student_id' });
      }

      notifyFinishPush(req, post, eventId, `👑 [보스 격파] ${bugInfo.name} 레이드에 성공했습니다! 참여한 모두 축하합니다!`);
    }

    await db
      .from('posts')
      .update({
        content: JSON.stringify(updatedMeta),
      })
      .eq('id', eventId);

    return {
      success: true,
      isCleared,
      currentHp: newCurrentHp,
      maxHp: meta.maxHp || 30,
      hitDamage: actualDamage,
      myHits: newHits,
      myLimit: perUserHitLimit,
      bugInfo,
      combatLogs,
      mvp,
      finisher,
      rewardText: meta.rewardText,
    };
  } catch (err) {
    console.error('hitBossRaid error:', err);
    return { success: false, reason: 'ERROR', message: err.message };
  }
}

// 3. 선생님: 신규 돌발 벌레 / 보스 레이드 생성 및 소환
export async function createLuckyEvent(req, {
  teacherId,
  classId = null,
  bugId = 'gold_beetle',
  isBossRaid = false,
  bossHp = 30,
  hitDamage = 5,
  perUserHitLimit = 5,
  targetCount = 2,
  rewardText = '선생님의 깜짝 선물 🎁',
  speedMode = 'FAST',
  customSpeedSec = null,
  escapeGimmick = true,
}) {
  const db = getSupabaseAdmin(req);
  try {
    const bugInfo = getBugById(bugId);
    const title = isBossRaid
      ? `👑 [보스 출현] ${bugInfo.name} (HP: ${bossHp}) 레이드가 시작되었습니다!`
      : `🚨 [돌발] ${bugInfo.name} (${bugInfo.emoji}) 출현!`;

    const payload = {
      title,
      content: JSON.stringify({
        isLuckyEvent: true,
        bugId,
        isBossRaid: Boolean(isBossRaid),
        maxHp: isBossRaid ? Number(bossHp) || 30 : undefined,
        currentHp: isBossRaid ? Number(bossHp) || 30 : undefined,
        hitDamage: isBossRaid ? Number(hitDamage) || 5 : undefined,
        perUserHitLimit: isBossRaid ? Number(perUserHitLimit) || 5 : undefined,
        hitsByUser: {},
        damageByUser: {},
        combatLogs: [],
        targetCount: isBossRaid ? 999 : Number(targetCount) || 2,
        rewardText: rewardText.trim() || '선생님의 깜짝 선물 🎁',
        status: 'ACTIVE',
        speedMode: speedMode || bugInfo.defaultSpeed || 'FAST',
        customSpeedSec: customSpeedSec !== null && customSpeedSec !== undefined ? Number(customSpeedSec) : undefined,
        escapeGimmick: isBossRaid ? false : Boolean(escapeGimmick),
      }),
      category: 'NOTICE',
      author_id: teacherId,
      class_id: classId || null,
      due_date: getKSTDateString(),
    };

    const { data, error } = await db
      .from('posts')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return { success: true, event: data, bugInfo };
  } catch (err) {
    console.error('createLuckyEvent error:', err);
    return { success: false, error: err.message };
  }
}

// 4. 이벤트 당첨자 명단 및 최근 이벤트 조회
export async function getLuckyEventHistory(req, teacherId = null) {
  const db = getSupabaseAdmin(req);
  try {
    const { data: posts, error } = await db
      .from('posts')
      .select('*, classes(name), users!posts_author_id_fkey(name)')
      .eq('category', 'NOTICE')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !posts) return [];

    const luckyPosts = posts.filter((p) => {
      try {
        const meta = JSON.parse(p.content || '{}');
        return meta.isLuckyEvent === true;
      } catch (e) {
        return false;
      }
    });

    const eventIds = luckyPosts.map((e) => e.id);
    if (eventIds.length === 0) return [];

    const { data: catches } = await db
      .from('post_confirmations')
      .select('*, users!post_confirmations_student_id_fkey(name, email)')
      .in('post_id', eventIds)
      .order('created_at', { ascending: true });

    const catchMap = {};
    (catches || []).forEach((c) => {
      if (!catchMap[c.post_id]) catchMap[c.post_id] = [];
      catchMap[c.post_id].push({
        id: c.id,
        studentId: c.student_id,
        studentName: c.users?.name || '학생',
        studentEmail: c.users?.email || '',
        caughtAt: c.created_at,
      });
    });

    return luckyPosts.map((ev) => {
      let meta = {};
      try {
        meta = JSON.parse(ev.content || '{}');
      } catch (e) {}

      const winnerList = catchMap[ev.id] || [];
      const bugInfo = getBugById(meta.bugId || 'gold_beetle');

      return {
        id: ev.id,
        title: ev.title,
        bugId: meta.bugId || 'gold_beetle',
        bugInfo,
        isBossRaid: Boolean(meta.isBossRaid),
        maxHp: meta.maxHp,
        currentHp: meta.currentHp,
        hitDamage: Number(meta.hitDamage) || 5,
        perUserHitLimit: Number(meta.perUserHitLimit) || 5,
        hitsByUser: meta.hitsByUser || {},
        damageByUser: meta.damageByUser || {},
        studentNames: meta.studentNames || {},
        combatLogs: meta.combatLogs || [],
        mvp: meta.mvp,
        finisher: meta.finisher,
        className: ev.classes?.name || '학원 전체',
        classId: ev.class_id,
        authorName: ev.users?.name || '선생님',
        targetCount: meta.targetCount || 2,
        rewardText: meta.rewardText || '선생님의 깜짝 선물',
        speedMode: meta.speedMode || 'FAST',
        escapeGimmick: meta.escapeGimmick !== false,
        status: meta.status || 'FINISHED',
        createdAt: ev.created_at,
        winners: winnerList,
      };
    });
  } catch (err) {
    console.error('getLuckyEventHistory error:', err);
    return [];
  }
}

// 4-2. 🗑️ 벌레 이벤트 히스토리 삭제 (선생님 테스트/정리용)
export async function deleteLuckyEvent(req, eventId) {
  const db = getSupabaseAdmin(req);
  try {
    await db.from('post_confirmations').delete().eq('post_id', eventId);
    const { error } = await db.from('posts').delete().eq('id', eventId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('deleteLuckyEvent error:', err);
    return { success: false, error: err.message };
  }
}

// 5. 📖 학생별 [20종 벌레 도감] 수집 현황 조회
export async function getStudentBugDex(req, studentId) {
  const db = getSupabaseAdmin(req);
  try {
    // 1) 학생이 잡은 post_confirmations 목록 조회
    const { data: myCatches, error } = await db
      .from('post_confirmations')
      .select('post_id, created_at, posts!inner(content)')
      .eq('student_id', studentId);

    if (error) throw error;

    const catchStats = {}; // { bugId: { count, firstCaughtAt } }

    (myCatches || []).forEach((c) => {
      try {
        const meta = JSON.parse(c.posts?.content || '{}');
        if (meta.isLuckyEvent) {
          const bugId = meta.bugId || 'gold_beetle';
          if (!catchStats[bugId]) {
            catchStats[bugId] = { count: 0, firstCaughtAt: c.created_at };
          }
          catchStats[bugId].count += 1;
        }
      } catch (e) {}
    });

    const inventoryByTier = {
      COMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
      BOSS: 0,
    };

    const terrariumBugs = [];

    const bugList = BUG_CATALOG.map((bug) => {
      const stats = catchStats[bug.id];
      const isCaught = Boolean(stats && stats.count > 0);
      const count = stats?.count || 0;

      if (isCaught && count > 0) {
        if (inventoryByTier[bug.tier] !== undefined) {
          inventoryByTier[bug.tier] += count;
        }
        for (let i = 0; i < Math.min(count, 3); i++) {
          terrariumBugs.push({
            instanceId: `${bug.id}_${i}`,
            ...bug,
          });
        }
      }

      return {
        ...bug,
        isCaught,
        count,
        firstCaughtAt: stats?.firstCaughtAt || null,
      };
    });

    const totalKinds = BUG_CATALOG.length;
    const caughtKindsCount = bugList.filter((b) => b.isCaught).length;
    const progressPercent = totalKinds > 0 ? Math.round((caughtKindsCount / totalKinds) * 100) : 0;

    return {
      totalKinds,
      caughtKindsCount,
      progressPercent,
      bugList,
      inventoryByTier,
      terrariumBugs,
      milestones: {
        bronze: caughtKindsCount >= 5, // 5종
        silver: caughtKindsCount >= 10, // 10종
        gold: caughtKindsCount >= 15, // 15종
        master: caughtKindsCount >= 20, // 20종 올클리어
      },
    };
  } catch (err) {
    console.error('getStudentBugDex error:', err);
    return null;
  }
}

// 7. ⚗️ 벌레 3마리 합성 & 알 부화 함수
export async function synthesizeBugs(req, studentId, tier) {
  const db = getSupabaseAdmin(req);
  try {
    const validTiers = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
    if (!validTiers.includes(tier)) {
      return { success: false, error: '합성 가능한 등급이 아닙니다.' };
    }

    // 1. 해당 학생의 모든 포획 기록 조회
    const { data: myCatches, error: fetchErr } = await db
      .from('post_confirmations')
      .select('id, created_at, posts!inner(id, content)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (fetchErr || !myCatches) {
      return { success: false, error: '포획 기록을 조회할 수 없습니다.' };
    }

    // 2. 해당 티어에 속하는 confirmation 추출
    const targetCatches = [];
    const ownedBugIds = new Set();

    myCatches.forEach((c) => {
      try {
        const meta = JSON.parse(c.posts?.content || '{}');
        if (meta.isLuckyEvent) {
          const bugId = meta.bugId || 'gold_beetle';
          ownedBugIds.add(bugId);
          const bugInfo = getBugById(bugId);
          if (bugInfo.tier === tier) {
            targetCatches.push(c);
          }
        }
      } catch (e) {}
    });

    if (targetCatches.length < 3) {
      return {
        success: false,
        error: `${tier} 등급의 벌레가 최소 3마리 필요합니다. (현재: ${targetCatches.length}마리)`,
      };
    }

    // 3. 재료 3마리 소비 (삭제)
    const toConsume = targetCatches.slice(0, 3);
    const consumeIds = toConsume.map((c) => c.id);

    const { error: deleteErr } = await db
      .from('post_confirmations')
      .delete()
      .in('id', consumeIds);

    if (deleteErr) {
      return { success: false, error: '재료 소비 중 오류가 발생했습니다: ' + deleteErr.message };
    }

    // 4. 승급 확률 롤링 (사용자 지정 하향 확률)
    // COMMON: 85% COMMON, 15% RARE
    // RARE: 92% RARE, 8% EPIC
    // EPIC: 97% EPIC, 3% LEGENDARY
    // LEGENDARY: 99.5% LEGENDARY, 0.5% BOSS
    const roll = Math.random() * 100;
    let targetTier = tier;
    let isUpgrade = false;

    if (tier === 'COMMON') {
      if (roll < 15) {
        targetTier = 'RARE';
        isUpgrade = true;
      }
    } else if (tier === 'RARE') {
      if (roll < 8) {
        targetTier = 'EPIC';
        isUpgrade = true;
      }
    } else if (tier === 'EPIC') {
      if (roll < 3) {
        targetTier = 'LEGENDARY';
        isUpgrade = true;
      }
    } else if (tier === 'LEGENDARY') {
      if (roll < 0.5) {
        targetTier = 'BOSS';
        isUpgrade = true;
      }
    }

    // 5. 결과 티어에서 미보유 벌레 우선 선출
    const tierBugs = BUG_CATALOG.filter((b) => b.tier === targetTier);
    const unownedBugs = tierBugs.filter((b) => !ownedBugIds.has(b.id));

    let hatchedBug;
    if (unownedBugs.length > 0) {
      hatchedBug = unownedBugs[Math.floor(Math.random() * unownedBugs.length)];
    } else {
      hatchedBug = tierBugs[Math.floor(Math.random() * tierBugs.length)];
    }

    // 6. 새로운 벌레 도감 등록 (합성 포스트 생성 및 confirmation 추가)
    const synthTitle = `⚗️ [벌레 연구소] ${hatchedBug.name} 부화 알`;
    const { data: synthPost } = await db
      .from('posts')
      .insert([
        {
          title: synthTitle,
          content: JSON.stringify({
            isLuckyEvent: true,
            bugId: hatchedBug.id,
            isBossRaid: hatchedBug.tier === 'BOSS',
            status: 'FINISHED',
            synthesizedBy: studentId,
          }),
          category: 'NOTICE',
          author_id: studentId,
          due_date: getKSTDateString(),
        },
      ])
      .select()
      .single();

    if (synthPost) {
      await db.from('post_confirmations').insert([
        {
          post_id: synthPost.id,
          student_id: studentId,
        },
      ]);
    }

    return {
      success: true,
      isUpgrade,
      consumedTier: tier,
      targetTier,
      hatchedBug,
    };
  } catch (err) {
    console.error('synthesizeBugs error:', err);
    return { success: false, error: err.message };
  }
}

// 6. 🏆 [월간 명예의 전당] 랭킹 리더보드 조회
export async function getMonthlyBugLeaderboard(req) {
  const db = getSupabaseAdmin(req);
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: catches, error } = await db
      .from('post_confirmations')
      .select('student_id, created_at, users!post_confirmations_student_id_fkey(name, email), posts!inner(content)')
      .gte('created_at', firstDayOfMonth);

    if (error) throw error;

    const studentScoreMap = {};

    (catches || []).forEach((c) => {
      try {
        const meta = JSON.parse(c.posts?.content || '{}');
        if (meta.isLuckyEvent) {
          const sId = c.student_id;
          if (!studentScoreMap[sId]) {
            studentScoreMap[sId] = {
              studentId: sId,
              studentName: c.users?.name || '학생',
              studentEmail: c.users?.email || '',
              totalCaught: 0,
            };
          }
          studentScoreMap[sId].totalCaught += 1;
        }
      } catch (e) {}
    });

    const rankedList = Object.values(studentScoreMap)
      .sort((a, b) => b.totalCaught - a.totalCaught)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

    return rankedList;
  } catch (err) {
    console.error('getMonthlyBugLeaderboard error:', err);
    return [];
  }
}
