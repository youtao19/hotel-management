"use strict";

/**
 * 抖音预售券退款结果通知明细表。
 */
const tableName = 'douyin_presale_refund_notifications';

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id BIGSERIAL PRIMARY KEY,
  presale_order_id INTEGER REFERENCES douyin_presale_orders(id) ON DELETE SET NULL,
  booking_order_id INTEGER REFERENCES douyin_presale_booking_orders(id) ON DELETE SET NULL,
  ota_order_id VARCHAR(64),
  order_out_id VARCHAR(64),
  refund_total_amount INTEGER,
  refund_amount INTEGER,
  user_refund_amount INTEGER,
  refund_time_unix BIGINT,
  currency VARCHAR(16),
  refund_type INTEGER NOT NULL,
  audit_user_type INTEGER,
  applicant_type INTEGER,
  need_third_cancel BOOLEAN,
  refund_reason TEXT,
  refund_order_detail JSONB,
  payload_hash CHAR(64) NOT NULL UNIQUE,
  douyin_log_id VARCHAR(128),
  match_status VARCHAR(32) NOT NULL,
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

/** 为已存在的退款通知表补齐预约单退款关联字段。 */
const schemaUpdateQueryStrings = [
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS booking_order_id INTEGER REFERENCES douyin_presale_booking_orders(id) ON DELETE SET NULL;`
];

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_refund_notifications_order ON ${tableName}(presale_order_id, received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_refund_notifications_booking_order ON ${tableName}(booking_order_id, received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_refund_notifications_ota_order ON ${tableName}(ota_order_id)`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音预售券及预约单退款结果通知明细；一笔订单可有多次部分退款，原始通知不可覆盖';`,
  `COMMENT ON COLUMN ${tableName}.id IS '退款通知明细主键';`,
  `COMMENT ON COLUMN ${tableName}.presale_order_id IS '匹配到的 douyin_presale_orders.id；未匹配通知允许为空，便于后续排查';`,
  `COMMENT ON COLUMN ${tableName}.booking_order_id IS '匹配到的 douyin_presale_booking_orders.id；仅 biz_type=2012 使用';`,
  `COMMENT ON COLUMN ${tableName}.ota_order_id IS '抖音订单号 order_id';`,
  `COMMENT ON COLUMN ${tableName}.order_out_id IS '第三方订单号 order_out_id';`,
  `COMMENT ON COLUMN ${tableName}.refund_total_amount IS '售后总额，单位分，包含营销优惠和罚金';`,
  `COMMENT ON COLUMN ${tableName}.refund_amount IS '售后退款金额，单位分，不等同于用户实退金额';`,
  `COMMENT ON COLUMN ${tableName}.user_refund_amount IS '用户实际退款金额，单位分';`,
  `COMMENT ON COLUMN ${tableName}.refund_time_unix IS '抖音退款完成时间戳，单位秒';`,
  `COMMENT ON COLUMN ${tableName}.currency IS '退款金额币种；境内商家通常为 CNY';`,
  `COMMENT ON COLUMN ${tableName}.refund_type IS '退款类型：11规则内整单、12规则内部分、21规则外整单、22规则外部分';`,
  `COMMENT ON COLUMN ${tableName}.audit_user_type IS '退款审核人类型：1平台、2系统超时、3商家、4其他、5商家来客';`,
  `COMMENT ON COLUMN ${tableName}.applicant_type IS '退款申请人类型：0未知、1用户、2客服运营、4商家、99系统';`,
  `COMMENT ON COLUMN ${tableName}.need_third_cancel IS '退款后是否还需要第三方取消订单；仅抖音加白场景可能下发';`,
  `COMMENT ON COLUMN ${tableName}.refund_reason IS '面向用户展示的退款申请原因';`,
  `COMMENT ON COLUMN ${tableName}.refund_order_detail IS '退款涉及的抖音售卖房型和间夜金额明细';`,
  `COMMENT ON COLUMN ${tableName}.payload_hash IS '规范化请求体 SHA-256，用于抖音重复通知幂等';`,
  `COMMENT ON COLUMN ${tableName}.douyin_log_id IS '抖音请求头 X-Bytedance-Logid，用于排障';`,
  `COMMENT ON COLUMN ${tableName}.match_status IS '订单匹配状态：MATCHED、ORDER_NOT_FOUND 或 ORDER_CONFLICT';`,
  `COMMENT ON COLUMN ${tableName}.raw_payload IS '抖音退款结果 SPI 原始请求体';`,
  `COMMENT ON COLUMN ${tableName}.received_at IS '本系统接收通知时间，由数据库时区处理';`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  schemaUpdateQueryStrings,
  createIndexQueryStrings,
  createCommentQueryStrings
};
