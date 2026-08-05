CREATE TABLE IF NOT EXISTS douyin_calendar_room_prices (
  id BIGSERIAL PRIMARY KEY,
  rate_plan_id INTEGER NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  stay_date DATE NOT NULL,
  original_amount NUMERIC(10, 2) NOT NULL,
  retail_amount NUMERIC(10, 2),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT douyin_calendar_room_prices_unique UNIQUE (rate_plan_id, stay_date),
  CONSTRAINT douyin_calendar_room_prices_original_amount_check CHECK (original_amount >= 0),
  CONSTRAINT douyin_calendar_room_prices_retail_amount_check CHECK (retail_amount IS NULL OR retail_amount >= original_amount)
);

CREATE INDEX IF NOT EXISTS idx_douyin_calendar_room_prices_rate_plan_date
  ON douyin_calendar_room_prices (rate_plan_id, stay_date);

COMMENT ON TABLE douyin_calendar_room_prices IS '抖音日历房按日价格表；每个套餐每天只有一条价格，不能复用预售券价格';
COMMENT ON COLUMN douyin_calendar_room_prices.rate_plan_id IS '关联本地售卖套餐 rate_plans.id；仅 CALENDAR_ROOM 套餐允许维护';
COMMENT ON COLUMN douyin_calendar_room_prices.stay_date IS '房晚日期；DATE 按 YYYY-MM-DD 自然日使用';
COMMENT ON COLUMN douyin_calendar_room_prices.original_amount IS '日历房实际售价，单位元；调用抖音房价接口时转换为分';
COMMENT ON COLUMN douyin_calendar_room_prices.retail_amount IS '日历房划线价，单位元；为空时不传给抖音，存在时不得低于实际售价';
COMMENT ON COLUMN douyin_calendar_room_prices.last_synced_at IS '该日期价格最近一次成功推送到抖音的时间';
