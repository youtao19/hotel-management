ALTER TABLE douyin_presale_vouchers
  ADD COLUMN IF NOT EXISTS cancel_booking_offset_days INTEGER,
  ADD COLUMN IF NOT EXISTS cancel_booking_offset_hours INTEGER;

ALTER TABLE douyin_presale_vouchers
  DROP CONSTRAINT IF EXISTS douyin_presale_vouchers_cancel_booking_type_check,
  ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_type_check
    CHECK (cancel_booking_type IN (1, 2, 3)),
  ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_offset_days_check
    CHECK (cancel_booking_offset_days IS NULL OR cancel_booking_offset_days >= 1),
  ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_offset_hours_check
    CHECK (cancel_booking_offset_hours IS NULL OR cancel_booking_offset_hours BETWEEN 0 AND 23),
  ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_offset_required_check
    CHECK (cancel_booking_type <> 2 OR (cancel_booking_offset_days IS NOT NULL AND cancel_booking_offset_hours IS NOT NULL));

COMMENT ON COLUMN douyin_presale_vouchers.cancel_booking_type IS '抖音取消预约类型：2限时取消，必须配置入住前免费取消截止时间；3不可取消；历史值1仅为待运营重新选择的旧数据';
COMMENT ON COLUMN douyin_presale_vouchers.cancel_booking_offset_days IS '限时取消距入住时间的提前天数；cancel_booking_type=2时必填，必须至少1天';
COMMENT ON COLUMN douyin_presale_vouchers.cancel_booking_offset_hours IS '限时取消距入住时间的提前小时数；cancel_booking_type=2时必填，范围0至23';
