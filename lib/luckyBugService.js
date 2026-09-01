import { supabase } from './supabase';

/**
 * 🐛 돌발 황금 벌레 이벤트 서비스
 * (DB Check Constraint 'NOTICE' 준수 및 isLuckyEvent 메타데이터 저장)
 */

// 1. 활성화된 이벤트 조회 (대상 반 or 전체)
export async function getActiveLuckyEvent(studentClassIds = []) {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('category', 'NOTICE')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !posts) return null;

    // ACTIVE 상태인 최신 이벤트 찾기
    for (const post of posts) {
      try {
        const meta = JSON.parse(post.content || '{}');
        if (meta.isLuckyEvent && meta.status === 'ACTIVE') {
          // 대상 반 확인 (class_id가 없으면 전체 대상, 있으면 학생의 반 목록에 포함되는지 확인)
          if (!post.class_id || studentClassIds.includes(String(post.class_id))) {
            return {
              id: post.id,
              title: post.title,
              classId: post.class_id,
              targetCount: meta.targetCount || 2,
              rewardText: meta.rewardText || '선생님의 깜짝 선물',
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

// 1-2. 최근 마감된 이벤트 조회 (최근 3시간 이내, 학생이 당첨자가 아닌 경우 마감 알림 안내용)
export async function getRecentFinishedLuckyEvent(studentClassIds = [], studentId = null) {
  try {
    const { data: posts, error } = await supabase
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
          // 대상 반 확인
          if (!post.class_id || studentClassIds.includes(String(post.class_id))) {
            // 내가 이미 당첨되었는지 확인
            if (studentId) {
              const { data: myCatch } = await supabase
                .from('post_confirmations')
                .select('id')
                .eq('post_id', post.id)
                .eq('student_id', studentId)
                .maybeSingle();

              if (myCatch) continue; // 내가 이미 잡았으면 마감 알림 불필요
            }

            // 정원 및 실제 당첨자 수 확인
            const { data: catches } = await supabase
              .from('post_confirmations')
              .select('id')
              .eq('post_id', post.id);

            const isFinished = meta.status === 'FINISHED' || (catches && catches.length >= (meta.targetCount || 2));
            if (isFinished) {
              return {
                id: post.id,
                title: post.title,
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

// 2. 벌레 포획 시도 (선착순 판별)
export async function catchLuckyBug(eventId, studentId, studentName) {
  try {
    // 1) 이벤트 정보 확인
    const { data: post, error: postErr } = await supabase
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

    const targetCount = meta.targetCount || 2;

    // 2) 기존 포획자 수 확인
    const { data: existingCatches, error: catchErr } = await supabase
      .from('post_confirmations')
      .select('*')
      .eq('post_id', eventId)
      .order('created_at', { ascending: true });

    if (catchErr) {
      return { success: false, reason: 'ERROR', message: catchErr.message };
    }

    // 이미 잡았는지 확인
    const alreadyCaught = existingCatches?.some((c) => c.student_id === studentId);
    if (alreadyCaught) {
      const myRank = existingCatches.findIndex((c) => c.student_id === studentId) + 1;
      return { success: true, rank: myRank, rewardText: meta.rewardText, message: '이미 포획 성공하셨습니다!' };
    }

    // 정원 초과 확인
    if (existingCatches && existingCatches.length >= targetCount) {
      // 마감 상태로 업데이트
      await supabase
        .from('posts')
        .update({
          content: JSON.stringify({ ...meta, status: 'FINISHED' }),
        })
        .eq('id', eventId);

      return { success: false, reason: 'FULL', message: '아쉽게도 선착순 마감되었습니다!' };
    }

    // 3) 포획 등록
    const { data: inserted, error: insertErr } = await supabase
      .from('post_confirmations')
      .insert([
        {
          post_id: eventId,
          student_id: studentId,
        },
      ])
      .select()
      .single();

    if (insertErr) {
      return { success: false, reason: 'ERROR', message: '포획 등록 중 오류가 발생했습니다.' };
    }

    const currentRank = (existingCatches?.length || 0) + 1;

    // 만약 정원이 다 찼으면 이벤트 종료 처리
    if (currentRank >= targetCount) {
      await supabase
        .from('posts')
        .update({
          content: JSON.stringify({ ...meta, status: 'FINISHED' }),
        })
        .eq('id', eventId);
    }

    return {
      success: true,
      rank: currentRank,
      rewardText: meta.rewardText,
      message: `축하합니다! ${currentRank}등으로 황금 벌레를 잡았습니다!`,
    };
  } catch (err) {
    console.error('catchLuckyBug error:', err);
    return { success: false, reason: 'ERROR', message: err.message };
  }
}

// 3. 선생님: 신규 돌발 벌레 이벤트 생성 및 소환
export async function createLuckyEvent({ teacherId, classId = null, targetCount = 2, rewardText = '선생님의 깜짝 선물 🎁' }) {
  try {
    const payload = {
      title: '🚨 [돌발] 황금 벌레가 나타났다! 🐛',
      content: JSON.stringify({
        isLuckyEvent: true,
        targetCount: Number(targetCount) || 2,
        rewardText: rewardText.trim() || '선생님의 깜짝 선물 🎁',
        status: 'ACTIVE',
      }),
      category: 'NOTICE',
      author_id: teacherId,
      class_id: classId || null,
      due_date: new Date().toISOString().split('T')[0],
    };

    const { data, error } = await supabase
      .from('posts')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return { success: true, event: data };
  } catch (err) {
    console.error('createLuckyEvent error:', err);
    return { success: false, error: err.message };
  }
}

// 4. 이벤트 당첨자 명단 및 최근 이벤트 조회
export async function getLuckyEventHistory(teacherId = null) {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*, classes(name), users!posts_author_id_fkey(name)')
      .eq('category', 'NOTICE')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !posts) return [];

    // isLuckyEvent인 게시글만 필터링
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

    // 포획자 목록 조회
    const { data: catches } = await supabase
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

      return {
        id: ev.id,
        title: ev.title,
        className: ev.classes?.name || '학원 전체',
        classId: ev.class_id,
        authorName: ev.users?.name || '선생님',
        targetCount: meta.targetCount || 2,
        rewardText: meta.rewardText || '선생님의 깜짝 선물',
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
