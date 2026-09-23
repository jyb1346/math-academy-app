-- 클리닉 시간 변경 승인/반려 요청 테이블 스키마
-- Supabase SQL Editor에서 실행 (테스트 DB 및 운영 DB)

CREATE TABLE IF NOT EXISTS public.clinic_reschedule_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL,
    student_id TEXT NOT NULL,
    current_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject TEXT DEFAULT NULL,
    reason TEXT NOT NULL, -- 학생의 변경 사유 (필수)
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
    reject_reason TEXT DEFAULT NULL, -- 선생님의 반려 사유
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_clinic_reschedule_schedule ON public.clinic_reschedule_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_clinic_reschedule_student ON public.clinic_reschedule_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_reschedule_status ON public.clinic_reschedule_requests(status);

-- RLS 권한 설정
ALTER TABLE public.clinic_reschedule_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select clinic_reschedule_requests" ON public.clinic_reschedule_requests FOR ALL USING (true);
