-- Q&A 기능 고도화 스키마 마이그레이션 (공개 질문방 기능 추가)
-- Supabase SQL Editor에서 실행 (테스트 DB 및 운영 DB)

ALTER TABLE public.qna ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- 기존 레코드 기본값 설정 (만약 NULL이 생긴 경우 방지)
UPDATE public.qna SET is_public = false WHERE is_public IS NULL;

-- 인덱스 추가 (공개 질문 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_qna_is_public ON public.qna(is_public);
