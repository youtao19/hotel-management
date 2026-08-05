ALTER TABLE rate_plans
  ADD COLUMN IF NOT EXISTS douyin_business_type VARCHAR(20) NOT NULL DEFAULT 'PRESALE';

UPDATE rate_plans
SET douyin_business_type = 'PRESALE'
WHERE douyin_business_type IS NULL;

ALTER TABLE rate_plans
  DROP CONSTRAINT IF EXISTS rate_plans_douyin_business_type_check;

ALTER TABLE rate_plans
  ADD CONSTRAINT rate_plans_douyin_business_type_check
  CHECK (douyin_business_type IN ('CALENDAR_ROOM', 'PRESALE'));

COMMENT ON COLUMN rate_plans.douyin_business_type IS '抖音发布业务类型：CALENDAR_ROOM 日历房，PRESALE 预售券；已有套餐迁移为 PRESALE 以保持原同步含义';

CREATE TABLE IF NOT EXISTS douyin_calendar_room_rules (
  id SERIAL PRIMARY KEY,
  rate_plan_id INTEGER NOT NULL UNIQUE REFERENCES rate_plans(id) ON DELETE CASCADE,
  validity_start DATE NOT NULL,
  validity_end DATE NOT NULL,
  cancel_rule INTEGER NOT NULL,
  breakfast_number INTEGER NOT NULL DEFAULT 0,
  refund_type INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT douyin_calendar_room_rules_date_check CHECK (validity_start <= validity_end),
  CONSTRAINT douyin_calendar_room_rules_cancel_rule_check CHECK (cancel_rule IN (1, 2, 3)),
  CONSTRAINT douyin_calendar_room_rules_breakfast_number_check CHECK (breakfast_number BETWEEN 0 AND 99),
  CONSTRAINT douyin_calendar_room_rules_refund_type_check CHECK (refund_type IN (1, 2)),
  CONSTRAINT douyin_calendar_room_rules_status_check CHECK (status IN (0, 1))
);

COMMENT ON TABLE douyin_calendar_room_rules IS '抖音日历房售卖房型静态规则；每个本地套餐最多一条，不能复用预售券字段';
COMMENT ON COLUMN douyin_calendar_room_rules.rate_plan_id IS '关联本地售卖套餐 rate_plans.id，一对一且删除套餐时级联删除';
COMMENT ON COLUMN douyin_calendar_room_rules.validity_start IS '日历房规则生效开始日期，DATE 按 YYYY-MM-DD 字符串传递给抖音';
COMMENT ON COLUMN douyin_calendar_room_rules.validity_end IS '日历房规则生效结束日期，必须不早于开始日期';
COMMENT ON COLUMN douyin_calendar_room_rules.cancel_rule IS '取消规则：1 免费取消，2 限时取消，3 不可取消';
COMMENT ON COLUMN douyin_calendar_room_rules.breakfast_number IS '每间夜提供的早餐份数，0 表示不含早餐';
COMMENT ON COLUMN douyin_calendar_room_rules.refund_type IS '退款规则：1 可退款，2 不可退款；对应抖音 refund_rule.refundType';
COMMENT ON COLUMN douyin_calendar_room_rules.status IS '日历房售卖状态：1 上架，0 下架';
COMMENT ON COLUMN douyin_calendar_room_rules.created_at IS '本地规则首次创建时间';
COMMENT ON COLUMN douyin_calendar_room_rules.updated_at IS '本地规则最后修改时间';
