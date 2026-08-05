"use strict";

const tableName = 'douyin_calendar_room_rules';

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id SERIAL PRIMARY KEY,
  rate_plan_id INTEGER NOT NULL UNIQUE REFERENCES rate_plans(id) ON DELETE CASCADE,
  validity_start DATE NOT NULL,
  validity_end DATE NOT NULL,
  cancel_rule INTEGER NOT NULL CHECK (cancel_rule IN (1, 2, 3)),
  breakfast_number INTEGER NOT NULL DEFAULT 0 CHECK (breakfast_number BETWEEN 0 AND 99),
  refund_type INTEGER NOT NULL CHECK (refund_type IN (1, 2)),
  status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT douyin_calendar_room_rules_date_check CHECK (validity_start <= validity_end)
)`;

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音日历房售卖房型静态规则；每个本地套餐最多一条，不能复用预售券字段';`,
  `COMMENT ON COLUMN ${tableName}.rate_plan_id IS '关联本地售卖套餐 rate_plans.id，一对一且删除套餐时级联删除';`,
  `COMMENT ON COLUMN ${tableName}.validity_start IS '日历房规则生效开始日期，DATE 按 YYYY-MM-DD 字符串传递给抖音';`,
  `COMMENT ON COLUMN ${tableName}.validity_end IS '日历房规则生效结束日期，必须不早于开始日期';`,
  `COMMENT ON COLUMN ${tableName}.cancel_rule IS '取消规则：1 免费取消，2 限时取消，3 不可取消';`,
  `COMMENT ON COLUMN ${tableName}.breakfast_number IS '每间夜提供的早餐份数，0 表示不含早餐';`,
  `COMMENT ON COLUMN ${tableName}.refund_type IS '退款规则：1 可退款，2 不可退款；对应抖音 refund_rule.refundType';`,
  `COMMENT ON COLUMN ${tableName}.status IS '日历房售卖状态：1 上架，0 下架';`
];

module.exports = { tableName, createQuery, createCommentQueryStrings, dropQuery: `DROP TABLE IF EXISTS ${tableName}` };
