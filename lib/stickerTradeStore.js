const BUCKET_NAME = 'attachments';
const STORE_PATH = 'system_store/sticker_trades_v1.json';

/**
 * 🎁 품수학 공식 띠부띠부씰 25종 도감 목록
 */
export const STICKER_CATALOG = [
  { id: '01', number: '01', name: '천사 나라T', fullName: '01 천사 나라T', character: '나라T', series: '천사', emoji: '👼' },
  { id: '02', number: '02', name: '천사 성우T', fullName: '02 천사 성우T', character: '성우T', series: '천사', emoji: '👼' },
  { id: '03', number: '03', name: '천사 영배T', fullName: '03 천사 영배T', character: '영배T', series: '천사', emoji: '👼' },
  { id: '04', number: '04', name: '천사 동희T', fullName: '04 천사 동희T', character: '동희T', series: '천사', emoji: '👼' },
  { id: '05', number: '05', name: '미묘 몽돌', fullName: '05 미묘 몽돌', character: '몽돌', series: '천사', emoji: '🐱' },
  { id: '06', number: '06', name: '악마 나라T', fullName: '06 악마 나라T', character: '나라T', series: '악마', emoji: '😈' },
  { id: '07', number: '07', name: '악마 성우T', fullName: '07 악마 성우T', character: '성우T', series: '악마', emoji: '😈' },
  { id: '08', number: '08', name: '악마 영배T', fullName: '08 악마 영배T', character: '영배T', series: '악마', emoji: '😈' },
  { id: '09', number: '09', name: '악마 동희T', fullName: '09 악마 동희T', character: '동희T', series: '악마', emoji: '😈' },
  { id: '10', number: '10', name: '새초롬 몽돌', fullName: '10 새초롬 몽돌', character: '몽돌', series: '악마', emoji: '😼' },
  { id: '11', number: '11', name: '본업 나라T', fullName: '11 본업 나라T', character: '나라T', series: '본업', emoji: '👩‍🏫' },
  { id: '12', number: '12', name: '디테일 성우T', fullName: '12 디테일 성우T', character: '성우T', series: '본업', emoji: '👨‍🏫' },
  { id: '13', number: '13', name: '강사 영배T', fullName: '13 강사 영배T', character: '영배T', series: '본업', emoji: '👨‍🏫' },
  { id: '14', number: '14', name: '열정 동희T', fullName: '14 열정 동희T', character: '동희T', series: '본업', emoji: '🔥' },
  { id: '15', number: '15', name: '뀨 몽돌', fullName: '15 뀨 몽돌', character: '몽돌', series: '본업', emoji: '🐾' },
  { id: '16', number: '16', name: '랫서판다 나라T', fullName: '16 랫서판다 나라T', character: '나라T', series: '동물', emoji: '🐼' },
  { id: '17', number: '17', name: '미어캣 성우T', fullName: '17 미어캣 성우T', character: '성우T', series: '동물', emoji: '🦦' },
  { id: '18', number: '18', name: '공룡 영배T', fullName: '18 공룡 영배T', character: '영배T', series: '동물', emoji: '🦖' },
  { id: '19', number: '19', name: '어흥 동희T', fullName: '19 어흥 동희T', character: '동희T', series: '동물', emoji: '🐯' },
  { id: '20', number: '20', name: '방해 몽돌', fullName: '20 방해 몽돌', character: '몽돌', series: '동물', emoji: '🐈' },
  { id: '21', number: '21', name: '도닦는 나라T', fullName: '21 도닦는 나라T', character: '나라T', series: '스페셜', emoji: '🧘‍♀️' },
  { id: '22', number: '22', name: '으랏차차 성우T', fullName: '22 으랏차차 성우T', character: '성우T', series: '스페셜', emoji: '💪' },
  { id: '23', number: '23', name: '야뵤~ 영배T', fullName: '23 야뵤~ 영배T', character: '영배T', series: '스페셜', emoji: '🥋' },
  { id: '24', number: '24', name: '덩크슛 동희T', fullName: '24 덩크슛 동희T', character: '동희T', series: '스페셜', emoji: '🏀' },
  { id: '25', number: '25', name: '뒹굴 몽돌', fullName: '25 뒹굴 몽돌', character: '몽돌', series: '스페셜', emoji: '🧶' },
];

export const STICKER_MAP = STICKER_CATALOG.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

export function getStickerById(id) {
  return STICKER_MAP[id] || null;
}

export function getStickerFullName(id) {
  const found = STICKER_MAP[id];
  return found ? found.fullName : String(id || '');
}

/**
 * 요일 및 시간 옵션 (장소: 학원 로비 고정)
 */
export const MEET_DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

export const MEET_TIME_OPTIONS = (() => {
  const times = [];
  for (let h = 15; h <= 22; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 22 && m > 30) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      times.push(`${hh}:${mm}`);
    }
  }
  return times;
})();

export const FIXED_MEET_PLACE = '학원 로비';

/**
 * 이름 마스킹 헬퍼 ('김도윤' -> '김O윤', '이산' -> '이O')
 */
export function maskStudentName(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return '익명 학생';
  if (name.length === 1) return `${name}O`;
  if (name.length === 2) return `${name[0]}O`;
  const middleMask = 'O'.repeat(name.length - 2);
  return `${name[0]}${middleMask}${name[name.length - 1]}`;
}

/**
 * 현재 조회하는 학생(viewerId) 기준으로 게시글 및 댓글의 실명/마스킹 처리
 * - 본인 이름: 언제나 실명 표시
 * - 채택 완료(status === 'COMPLETED')된 글에서:
 *   게시글 작성자(post.authorId)와 채택된 댓글 작성자(acceptedComment.authorId) 두 사람에게만 서로의 실명을 공개!
 * - 그 외 제3자 또는 채택 전: '김O윤' 형태로 마스킹
 */
export function sanitizeTradePostForViewer(post, viewerId) {
  const acceptedComment = (post.comments || []).find(
    (c) => c.id === post.acceptedCommentId
  );
  const acceptedAuthorId = acceptedComment ? acceptedComment.authorId : null;

  const isViewerPostAuthor = String(post.authorId) === String(viewerId);
  const isViewerAcceptedPartner =
    post.status === 'COMPLETED' &&
    acceptedAuthorId &&
    String(acceptedAuthorId) === String(viewerId);

  const isMatchedParty = isViewerPostAuthor || isViewerAcceptedPartner;

  const showPostAuthorRealName =
    isViewerPostAuthor || (post.status === 'COMPLETED' && isViewerAcceptedPartner);

  const sanitizedComments = (post.comments || []).map((c) => {
    const isCommentOwner = String(c.authorId) === String(viewerId);
    const isThisAcceptedComment =
      post.status === 'COMPLETED' && String(c.id) === String(post.acceptedCommentId);

    // 채택된 댓글 작성자의 실명은 게시글 작성자(또는 댓글 본인)에게만 공개
    const showCommentAuthorRealName =
      isCommentOwner || (isThisAcceptedComment && isViewerPostAuthor);

    return {
      ...c,
      displayAuthorName: showCommentAuthorRealName
        ? c.authorName
        : maskStudentName(c.authorName),
      isRealNameRevealed: Boolean(
        !isCommentOwner && isThisAcceptedComment && isViewerPostAuthor
      ),
      isMine: isCommentOwner,
      authorName: undefined, // 원본 실명 필드 노출 방지
    };
  });

  const sanitizedAcceptedPartnerName =
    post.status === 'COMPLETED' && acceptedComment
      ? isMatchedParty
        ? isViewerPostAuthor
          ? acceptedComment.authorName
          : post.authorName
        : null
      : null;

  return {
    ...post,
    displayAuthorName: showPostAuthorRealName
      ? post.authorName
      : maskStudentName(post.authorName),
    isAuthorRealNameRevealed: Boolean(
      !isViewerPostAuthor && post.status === 'COMPLETED' && isViewerAcceptedPartner
    ),
    isMine: isViewerPostAuthor,
    isMatchedParty,
    matchedPartnerRealName: sanitizedAcceptedPartnerName,
    authorName: undefined, // 원본 실명 노출 방지
    comments: sanitizedComments,
  };
}

/**
 * 📦 Supabase Storage에서 띠부씰 교환 장터 데이터 로드
 */
export async function loadStickerTradeStore(db) {
  try {
    const { data, error } = await db.storage.from(BUCKET_NAME).download(STORE_PATH);
    if (error || !data) {
      return { posts: [] };
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
    };
  } catch {
    return { posts: [] };
  }
}

/**
 * 📦 Supabase Storage에 띠부씰 교환 장터 데이터 저장
 */
export async function saveStickerTradeStore(db, storeData) {
  const payload = JSON.stringify(
    {
      posts: Array.isArray(storeData.posts) ? storeData.posts : [],
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );
  const buffer = Buffer.from(payload, 'utf-8');

  let { error } = await db.storage.from(BUCKET_NAME).upload(STORE_PATH, buffer, {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  });

  if (
    error &&
    (error.message?.includes('Bucket not found') ||
      error.statusCode === '404' ||
      error.status === 404)
  ) {
    await db.storage.createBucket(BUCKET_NAME, { public: true }).catch(() => {});
    const retry = await db.storage.from(BUCKET_NAME).upload(STORE_PATH, buffer, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '0',
    });
    error = retry.error;
  }

  if (error) {
    throw new Error(`띠부씰 장터 저장 오류: ${error.message}`);
  }
}

/**
 * 두 학생(교환 성사 당사자)의 담당 선생님 ID 목록 조회 (중복 제거)
 * - 1) 학생 users.teacher_id (직속 담당 강사)
 * - 2) 학생이 소속된 반(class_students -> classes.teacher_id)의 담당 강사
 */
export async function findAssignedTeacherIdsForStudents(db, studentIds = []) {
  const validIds = [...new Set((studentIds || []).filter(Boolean))];
  if (validIds.length === 0) return [];

  try {
    const [{ data: stRows }, { data: csRows }] = await Promise.all([
      db.from('users').select('id, teacher_id').in('id', validIds),
      db.from('class_students').select('student_id, class_id').in('student_id', validIds),
    ]);

    const teacherIds = new Set();
    (stRows || []).forEach((s) => {
      if (s.teacher_id) teacherIds.add(s.teacher_id);
    });

    const classIds = [...new Set((csRows || []).map((r) => r.class_id).filter(Boolean))];
    if (classIds.length > 0) {
      const { data: clsRows } = await db
        .from('classes')
        .select('id, teacher_id')
        .in('id', classIds);
      (clsRows || []).forEach((c) => {
        if (c.teacher_id) teacherIds.add(c.teacher_id);
      });
    }

    return Array.from(teacherIds);
  } catch (err) {
    console.warn('findAssignedTeacherIdsForStudents warning:', err);
    return [];
  }
}

