-- ==============================================================================
-- 📋 기존 게시글(공지/숙제) 대상 학생 일괄 '확인 완료' 백필 스크립트
-- ==============================================================================
-- 목적: 기존에 작성된 게시글에 대해 '미확인' 알림이 불필요하게 발송되지 않도록,
--       현재 DB에 존재하는 모든 게시글에 대해 대상 학생들의 확인(post_confirmations) 레코드를 일괄 등록합니다.
--
-- ⚠️ 실행 방법: Supabase SQL Editor에서 실행
-- ⚠️ 테스트 서버 DB에 먼저 실행하여 테스트 후, 추후 운영 DB 배포 시 운영 DB에서도 실행하세요.
-- ==============================================================================

DO $$
BEGIN
    -- 1. 특정 반에 등록된 게시글에 대해 해당 반 학생들의 확인 레코드 일괄 생성
    INSERT INTO public.post_confirmations (post_id, student_id, created_at)
    SELECT 
        p.id AS post_id,
        cs.student_id AS student_id,
        COALESCE(p.created_at, now()) AS created_at
    FROM public.posts p
    JOIN public.class_students cs ON cs.class_id = p.class_id
    JOIN public.users u ON u.id = cs.student_id AND u.role = 'STUDENT'
    WHERE p.class_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM public.post_confirmations pc 
          WHERE pc.post_id = p.id AND pc.student_id = cs.student_id
      );

    -- 2. 전체 공지(class_id IS NULL) 게시글에 대해 모든 학생의 확인 레코드 일괄 생성
    INSERT INTO public.post_confirmations (post_id, student_id, created_at)
    SELECT 
        p.id AS post_id,
        u.id AS student_id,
        COALESCE(p.created_at, now()) AS created_at
    FROM public.posts p
    CROSS JOIN public.users u
    WHERE p.class_id IS NULL
      AND u.role = 'STUDENT'
      AND NOT EXISTS (
          SELECT 1 
          FROM public.post_confirmations pc 
          WHERE pc.post_id = p.id AND pc.student_id = u.id
      );

    RAISE NOTICE '✅ 기존 모든 게시글에 대한 학생 확인 완료(post_confirmations) 백필이 완료되었습니다.';
END $$;
