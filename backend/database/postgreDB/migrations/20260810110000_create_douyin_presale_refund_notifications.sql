ALTER TABLE douyin_presale_orders
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS refund_log_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS refund_received_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS douyin_presale_refund_notifications (
  id BIGSERIAL PRIMARY KEY,
  presale_order_id INTEGER REFERENCES douyin_presale_orders(id) ON DELETE SET NULL,
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
);

CREATE INDEX IF NOT EXISTS idx_douyin_presale_refund_notifications_order
  ON douyin_presale_refund_notifications(presale_order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_refund_notifications_ota_order
  ON douyin_presale_refund_notifications(ota_order_id);

COMMENT ON COLUMN douyin_presale_orders.refund_status IS '退款状态：PENDING 等待抖音退款结果通知，COMPLETED 表示抖音已完成退款';
COMMENT ON COLUMN douyin_presale_orders.refund_log_id IS '最新退款结果通知的 X-Bytedance-Logid';
COMMENT ON COLUMN douyin_presale_orders.refund_received_at IS '最新退款结果通知接收时间，由数据库时区处理';
COMMENT ON TABLE douyin_presale_refund_notifications IS '抖音预售券退款结果通知明细；一笔订单可有多次部分退款，原始通知不可覆盖';
COMMENT ON COLUMN douyin_presale_refund_notifications.presale_order_id IS '匹配到的 douyin_presale_orders.id；未匹配通知允许为空，便于后续排查';
COMMENT ON COLUMN douyin_presale_refund_notifications.ota_order_id IS '抖音订单号 order_id';
COMMENT ON COLUMN douyin_presale_refund_notifications.order_out_id IS '第三方订单号 order_out_id';
COMMENT ON COLUMN douyin_presale_refund_notifications.refund_total_amount IS '售后总额，单位分，包含营销优惠和罚金';
COMMENT ON COLUMN douyin_presale_refund_notifications.refund_amount IS '售后退款金额，单位分，不等同于用户实退金额';
COMMENT ON COLUMN douyin_presale_refund_notifications.user_refund_amount IS '用户实际退款金额，单位分';
COMMENT ON COLUMN douyin_presale_refund_notifications.refund_time_unix IS '抖音退款完成时间戳，单位秒';
COMMENT ON COLUMN douyin_presale_refund_notifications.refund_type IS '退款类型：11规则内整单、12规则内部分、21规则外整单、22规则外部分';
COMMENT ON COLUMN douyin_presale_refund_notifications.payload_hash IS '规范化请求体 SHA-256，用于抖音重复通知幂等';
COMMENT ON COLUMN douyin_presale_refund_notifications.douyin_log_id IS '抖音请求头 X-Bytedance-Logid，用于排障';
COMMENT ON COLUMN douyin_presale_refund_notifications.match_status IS '订单匹配状态：MATCHED、ORDER_NOT_FOUND 或 ORDER_CONFLICT';
COMMENT ON COLUMN douyin_presale_refund_notifications.raw_payload IS '抖音退款结果 SPI 原始请求体';
COMMENT ON COLUMN douyin_presale_refund_notifications.received_at IS '本系统接收通知时间，由数据库时区处理';
