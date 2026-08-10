"use strict";

/** 抖音预售券预约履约同步记录表名。 */
const tableName = 'douyin_presale_booking_accommodation_syncs';

/** 创建抖音预售券预约履约同步记录表。 */
const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id BIGSERIAL PRIMARY KEY,
  booking_order_id INTEGER NOT NULL REFERENCES douyin_presale_booking_orders(id) ON DELETE CASCADE,
  accommodation_status INTEGER NOT NULL CHECK (accommodation_status IN (1, 2, 3)),
  sync_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  douyin_log_id VARCHAR(128),
  error_code BIGINT,
  error_description TEXT,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_order_id, accommodation_status)
)`;

/** 删除抖音预售券预约履约同步记录表。 */
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

/** 创建履约同步查询索引。 */
const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_accommodation_syncs_status ON ${tableName}(sync_status, updated_at DESC)`
];

/** 创建履约同步记录字段注释。 */
const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音预售券预约单入住、未入住和离店状态的出站同步记录；一笔预约单每种履约状态只保留一条可重试记录';`,
  `COMMENT ON COLUMN ${tableName}.booking_order_id IS '关联 douyin_presale_booking_orders.id，仅对应 biz_type=2012 预约订单';`,
  `COMMENT ON COLUMN ${tableName}.accommodation_status IS '通知抖音的住宿状态：1已入住，2未入住，3已离店';`,
  `COMMENT ON COLUMN ${tableName}.sync_status IS '同步状态：PENDING待发送、SUCCEEDED成功、FAILED失败';`,
  `COMMENT ON COLUMN ${tableName}.attempt_count IS '向抖音实际发起请求的累计次数，首次发送为 1';`,
  `COMMENT ON COLUMN ${tableName}.last_attempt_at IS '最近一次向抖音发送履约通知的时间，由数据库时区处理';`,
  `COMMENT ON COLUMN ${tableName}.synced_at IS '抖音确认接收履约通知的时间，由数据库时区处理';`,
  `COMMENT ON COLUMN ${tableName}.douyin_log_id IS '抖音履约接口响应 extra.logid，用于平台排查';`,
  `COMMENT ON COLUMN ${tableName}.error_code IS '抖音响应 extra.error_code；网络异常为空';`,
  `COMMENT ON COLUMN ${tableName}.error_description IS '抖音业务失败描述或网络异常原因';`,
  `COMMENT ON COLUMN ${tableName}.response IS '抖音履约接口最近一次原始 JSON 响应；网络异常为空';`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
  createCommentQueryStrings
};
