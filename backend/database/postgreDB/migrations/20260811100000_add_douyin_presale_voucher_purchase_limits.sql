ALTER TABLE douyin_presale_vouchers
  ADD COLUMN IF NOT EXISTS each_person_max INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS each_person_each_order_max INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'douyin_presale_vouchers_each_person_max_check'
      AND conrelid = 'douyin_presale_vouchers'::regclass
  ) THEN
    ALTER TABLE douyin_presale_vouchers
      ADD CONSTRAINT douyin_presale_vouchers_each_person_max_check CHECK (each_person_max > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'douyin_presale_vouchers_each_person_each_order_max_check'
      AND conrelid = 'douyin_presale_vouchers'::regclass
  ) THEN
    ALTER TABLE douyin_presale_vouchers
      ADD CONSTRAINT douyin_presale_vouchers_each_person_each_order_max_check CHECK (each_person_each_order_max > 0);
  END IF;
END $$;

COMMENT ON COLUMN douyin_presale_vouchers.each_person_max IS '单个抖音用户在本券售卖期内累计可购买的最大张数，必须大于0';
COMMENT ON COLUMN douyin_presale_vouchers.each_person_each_order_max IS '单个抖音用户每笔订单可购买的最大张数，必须大于0';
