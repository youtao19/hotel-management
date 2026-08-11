UPDATE douyin_presale_vouchers
SET cancel_booking_type = 3,
    cancel_booking_offset_days = NULL,
    cancel_booking_offset_hours = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE cancel_booking_type = 1;

ALTER TABLE douyin_presale_vouchers
  DROP CONSTRAINT IF EXISTS douyin_presale_vouchers_cancel_booking_type_check,
  ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_type_check
    CHECK (cancel_booking_type IN (2, 3));

COMMENT ON COLUMN douyin_presale_vouchers.cancel_booking_type IS '抖音取消预约类型：2限时取消，必须配置入住前免费取消截止时间；3不可取消';
