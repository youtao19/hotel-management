COMMENT ON TABLE douyin_calendar_room_prices IS '抖音套餐按日价格表；日历房和预售券各自通过独立接口维护，每个套餐每天只有一条价格';
COMMENT ON COLUMN douyin_calendar_room_prices.rate_plan_id IS '关联本地售卖套餐 rate_plans.id；仅 CALENDAR_ROOM 或 PRESALE 套餐可由各自接口维护';
COMMENT ON COLUMN douyin_calendar_room_prices.stay_date IS '房晚日期；DATE 按 YYYY-MM-DD 自然日使用';
COMMENT ON COLUMN douyin_calendar_room_prices.original_amount IS '套餐实际售价，单位元；调用抖音房价接口时转换为分';
COMMENT ON COLUMN douyin_calendar_room_prices.retail_amount IS '套餐划线价，单位元；为空时不传给抖音，存在时不得低于实际售价';
COMMENT ON COLUMN douyin_calendar_room_prices.last_synced_at IS '该日期价格最近一次成功推送到抖音的时间';
