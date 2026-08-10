CREATE TABLE IF NOT EXISTS douyin_rate_plan_closures (
  rate_plan_id INTEGER NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  stay_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_plan_id, stay_date)
);

COMMENT ON TABLE douyin_rate_plan_closures IS '抖音套餐按房晚主动关房记录；仅关闭指定自然日，不改变套餐整体状态';
COMMENT ON COLUMN douyin_rate_plan_closures.rate_plan_id IS '关联本地售卖套餐；套餐停用仍由 rate_plans.status 表示';
COMMENT ON COLUMN douyin_rate_plan_closures.stay_date IS '主动关房的入住自然日；可订检查命中时返回错误码18和 available=false';
