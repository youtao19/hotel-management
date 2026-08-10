ALTER TABLE douyin_presale_booking_orders
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS refund_log_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS refund_received_at TIMESTAMPTZ;

ALTER TABLE douyin_presale_refund_notifications
  ADD COLUMN IF NOT EXISTS booking_order_id INTEGER REFERENCES douyin_presale_booking_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_douyin_presale_refund_notifications_booking_order
  ON douyin_presale_refund_notifications(booking_order_id, received_at DESC);

COMMENT ON COLUMN douyin_presale_booking_orders.booking_status IS '本地预约状态：CREATED、CONFIRMED、CONFIRM_FAILED 或 REFUNDED';
COMMENT ON COLUMN douyin_presale_booking_orders.refund_status IS '退款状态：COMPLETED 表示抖音已完成预约单退款';
COMMENT ON COLUMN douyin_presale_booking_orders.refund_log_id IS '预约单退款结果通知的 X-Bytedance-Logid';
COMMENT ON COLUMN douyin_presale_booking_orders.refund_received_at IS '预约单退款结果通知接收时间，由数据库时区处理';
COMMENT ON TABLE douyin_presale_refund_notifications IS '抖音预售券及预约单退款结果通知明细；一笔订单可有多次部分退款，原始通知不可覆盖';
COMMENT ON COLUMN douyin_presale_refund_notifications.booking_order_id IS '匹配到的 douyin_presale_booking_orders.id；仅 biz_type=2012 使用';
