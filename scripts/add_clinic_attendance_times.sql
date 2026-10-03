-- 클리닉 실시간 출석 시각(attended_at) 및 퇴실 시각(departed_at) 컬럼 추가
ALTER TABLE public.clinic_bookings
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.clinic_bookings.attended_at IS '학생이 학원에 실제 도착하여 출석 버튼을 누른 시각';
COMMENT ON COLUMN public.clinic_bookings.departed_at IS '학생이 클리닉 학습을 마치고 실제 퇴실/귀가한 시각';
