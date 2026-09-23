-- 주말 클리닉 예약 및 관리 시스템 테이블 스키마
-- Supabase SQL Editor에서 실행 (테스트 DB 및 운영 DB)

-- 1. 클리닉 개설 일정 테이블
CREATE TABLE IF NOT EXISTS public.clinic_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    title TEXT NOT NULL DEFAULT '주말 클리닉',
    start_time VARCHAR(10) NOT NULL DEFAULT '10:00',
    end_time VARCHAR(10) NOT NULL DEFAULT '18:00',
    slot_interval_minutes INT NOT NULL DEFAULT 30,
    duration_minutes INT NOT NULL DEFAULT 120,
    max_capacity INT DEFAULT NULL, -- NULL 또는 0: 인원 제한 없음 (무제한)
    target_class_id TEXT REFERENCES public.classes(id) ON DELETE SET NULL,
    notice TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 학생 클리닉 예약 신청 테이블
CREATE TABLE IF NOT EXISTS public.clinic_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.clinic_schedules(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'BOOKED', -- 'BOOKED', 'ATTENDED', 'ABSENT', 'CANCELLED'
    subject TEXT DEFAULT NULL,
    memo TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 검색 성능 향상을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_clinic_schedules_date ON public.clinic_schedules(date);
CREATE INDEX IF NOT EXISTS idx_clinic_bookings_schedule ON public.clinic_bookings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_clinic_bookings_student ON public.clinic_bookings(student_id);

-- 4. RLS 활성화
ALTER TABLE public.clinic_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select clinic_schedules" ON public.clinic_schedules FOR ALL USING (true);
CREATE POLICY "Allow public select clinic_bookings" ON public.clinic_bookings FOR ALL USING (true);
