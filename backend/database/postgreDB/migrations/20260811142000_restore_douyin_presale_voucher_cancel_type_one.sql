ALTER TABLE douyin_presale_vouchers
  DROP CONSTRAINT IF EXISTS douyin_presale_vouchers_cancel_booking_type_check,
  ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_type_check
    CHECK (cancel_booking_type IN (1, 2, 3));

COMMENT ON COLUMN douyin_presale_vouchers.cancel_booking_type IS '抖音取消预约类型：1未使用自动退，2限时取消且必须配置入住前免费取消截止时间，3不可取消';
