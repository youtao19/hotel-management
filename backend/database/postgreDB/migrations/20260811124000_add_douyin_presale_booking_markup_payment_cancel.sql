ALTER TABLE douyin_presale_booking_orders
  ADD COLUMN IF NOT EXISTS add_amount BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS payment_log_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS cancel_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS cancel_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cancel_log_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS cancel_payload JSONB,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_cancel_id
  ON douyin_presale_booking_orders(cancel_id);

COMMENT ON COLUMN douyin_presale_booking_orders.add_amount IS '预约订单应付加价总额，按 daily_rates.daily_add_amount 汇总，单位分';
COMMENT ON COLUMN douyin_presale_booking_orders.payment_status IS '预约加价支付状态：NOT_REQUIRED无需加价、PENDING待支付、PAID已支付或 CANCELLED超时取消';
COMMENT ON COLUMN douyin_presale_booking_orders.payment_log_id IS '预约加价支付通知的 X-Bytedance-Logid';
COMMENT ON COLUMN douyin_presale_booking_orders.cancel_id IS '抖音取消预约请求唯一标识，用于幂等处理';
COMMENT ON COLUMN douyin_presale_booking_orders.cancel_status IS '预约取消处理状态：CANCELLED 或 REFUND_PENDING';
COMMENT ON COLUMN douyin_presale_booking_orders.cancel_log_id IS '预约取消 SPI 请求头 X-Bytedance-Logid';
COMMENT ON COLUMN douyin_presale_booking_orders.cancel_payload IS '抖音预约取消 SPI 原始请求体';
COMMENT ON COLUMN douyin_presale_booking_orders.cancelled_at IS '本地同意取消预约的处理时间，由数据库时区处理';
