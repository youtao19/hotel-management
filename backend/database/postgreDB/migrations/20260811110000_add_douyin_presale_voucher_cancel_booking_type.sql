ALTER TABLE douyin_presale_vouchers
  ADD COLUMN IF NOT EXISTS cancel_booking_type INTEGER NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'douyin_presale_vouchers_cancel_booking_type_check'
      AND conrelid = 'douyin_presale_vouchers'::regclass
  ) THEN
    ALTER TABLE douyin_presale_vouchers
      ADD CONSTRAINT douyin_presale_vouchers_cancel_booking_type_check
      CHECK (cancel_booking_type IN (1, 3));
  END IF;
END $$;

COMMENT ON COLUMN douyin_presale_vouchers.cancel_booking_type IS '抖音取消预约类型：1可取消即未使用自动退，3不可取消；当前不支持需额外时间或扣费规则的2和4';
