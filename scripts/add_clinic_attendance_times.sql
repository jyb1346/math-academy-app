-- 클리닉 실시간 출석 시각(attended_at), 퇴실 시각(departed_at), 외출/일시정지 시각(paused_at), 외출 누적 분(total_pause_minutes) 컬럼 추가
ALTER TABLE public.clinic_bookings
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_pause_minutes INTEGER DEFAULT 0;

COMMENT ON COLUMN public.clinic_bookings.attended_at IS '학생이 학원에 실제 도착하여 출석 버튼을 누른 시각';
COMMENT ON COLUMN public.clinic_bookings.departed_at IS '학생이 클리닉 학습을 마치고 실제 퇴실/귀가한 시각';
COMMENT ON COLUMN public.clinic_bookings.paused_at IS '학생이 중간에 외출/타학원 등으로 카운트다운을 일시정지한 시각';
COMMENT ON COLUMN public.clinic_bookings.total_pause_minutes IS '외출로 인해 일시정지되었던 총 누적 시간(분)';

