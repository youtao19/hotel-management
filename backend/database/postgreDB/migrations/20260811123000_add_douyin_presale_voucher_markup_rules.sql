ALTER TABLE douyin_presale_vouchers
  ADD COLUMN IF NOT EXISTS markup_rules JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN douyin_presale_vouchers.markup_rules IS '预约加价规则数组：每项包含指定日期或节假日、适用范围、星期和每晚加价金额（元）；同步抖音时转换为分';
