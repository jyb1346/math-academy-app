-- ==============================================================================
-- 🚀 본서버(운영 DB) 일괄 통합 마이그레이션 & 백필 SQL 스크립트
-- ==============================================================================
-- 대상: Supabase 운영 데이터베이스 (SQL Editor에서 1회 복사/붙여넣기 후 Run)
-- 포함 항목:
--   1. 클리닉 일정(clinic_schedules) 및 예약(clinic_bookings) 테이블 생성
--   2. 클리닉 시간 변경 승인/반려(clinic_reschedule_requests) 테이블 생성
--   3. 게시판 확인(post_confirmations) 테이블 생성 및 인덱스 설정
--   4. 기존 작성된 모든 게시글 대상 학생 일괄 '확인 완료' 백필
-- ==============================================================================

-- 1. 클리닉 일정 테이블
CREATE TABLE IF NOT EXISTS public.clinic_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id TEXT,
    date DATE NOT NULL,
    title TEXT NOT NULL DEFAULT '주말 클리닉',
    start_time VARCHAR(10) NOT NULL DEFAULT '10:00',
    end_time VARCHAR(10) NOT NULL DEFAULT '18:00',
    slot_interval_minutes INT NOT NULL DEFAULT 30,
    duration_minutes INT NOT NULL DEFAULT 120,
    max_capacity INT DEFAULT NULL,
    target_type TEXT NOT NULL DEFAULT 'TEACHER_STUDENTS',
    target_class_id TEXT DEFAULT NULL,
    target_class_ids JSONB DEFAULT '[]'::jsonb,
    target_student_ids JSONB DEFAULT '[]'::jsonb,
    notice TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기존 테이블이 있을 경우 신규 컬럼 안전 추가
ALTER TABLE public.clinic_schedules ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'TEACHER_STUDENTS';
ALTER TABLE public.clinic_schedules ADD COLUMN IF NOT EXISTS target_class_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.clinic_schedules ADD COLUMN IF NOT EXISTS target_student_ids JSONB DEFAULT '[]'::jsonb;

-- 2. 클리닉 예약 테이블
CREATE TABLE IF NOT EXISTS public.clinic_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL,
    student_id TEXT NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'BOOKED',
    subject TEXT DEFAULT NULL,
    memo TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 클리닉 시간 변경 요청 테이블
CREATE TABLE IF NOT EXISTS public.clinic_reschedule_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL,
    student_id TEXT NOT NULL,
    current_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject TEXT DEFAULT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reject_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 게시판 확인 테이블
CREATE TABLE IF NOT EXISTS public.post_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL,
    student_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_clinic_schedules_date ON public.clinic_schedules(date);
CREATE INDEX IF NOT EXISTS idx_clinic_bookings_schedule ON public.clinic_bookings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_clinic_bookings_student ON public.clinic_bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_reschedule_schedule ON public.clinic_reschedule_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_clinic_reschedule_student ON public.clinic_reschedule_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_reschedule_status ON public.clinic_reschedule_requests(status);
CREATE INDEX IF NOT EXISTS idx_post_confirmations_lookup ON public.post_confirmations(post_id, student_id);

-- 6. RLS 활성화 및 권한 설정
ALTER TABLE public.clinic_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_confirmations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinic_schedules' AND policyname = 'Allow public select clinic_schedules') THEN
        CREATE POLICY "Allow public select clinic_schedules" ON public.clinic_schedules FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinic_bookings' AND policyname = 'Allow public select clinic_bookings') THEN
        CREATE POLICY "Allow public select clinic_bookings" ON public.clinic_bookings FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinic_reschedule_requests' AND policyname = 'Allow public select clinic_reschedule_requests') THEN
        CREATE POLICY "Allow public select clinic_reschedule_requests" ON public.clinic_reschedule_requests FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_confirmations' AND policyname = 'Allow public select post_confirmations') THEN
        CREATE POLICY "Allow public select post_confirmations" ON public.post_confirmations FOR ALL USING (true);
    END IF;
END $$;

-- 7. 📋 기존 작성된 모든 게시글 대상 학생 일괄 '확인 완료' 백필 실행
DO $$
BEGIN
    -- 7-1. 반별 지정 게시글 확인 처리
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

    -- 7-2. 전체 공지(class_id IS NULL) 게시글 확인 처리
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

    RAISE NOTICE '✅ 본서버 DB 마이그레이션 및 기존 모든 게시글 읽음 처리(백필)가 성공적으로 완료되었습니다.';
END $$;
