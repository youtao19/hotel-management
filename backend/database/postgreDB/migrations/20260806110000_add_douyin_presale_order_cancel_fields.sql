ALTER TABLE douyin_presale_orders
  ADD COLUMN IF NOT EXISTS cancel_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cancel_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cancel_log_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS cancel_payload JSONB,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_douyin_presale_orders_cancel_id
  ON douyin_presale_orders(cancel_id);

COMMENT ON COLUMN douyin_presale_orders.cancel_id IS '抖音取消请求唯一标识，用于同一取消请求幂等';
COMMENT ON COLUMN douyin_presale_orders.cancel_status IS '取消处理状态：CANCELLED、REFUND_NOT_SUPPORTED 或 REJECTED';
COMMENT ON COLUMN douyin_presale_orders.cancel_log_id IS '取消 SPI 请求头 x-bytedance-logid';
COMMENT ON COLUMN douyin_presale_orders.cancel_payload IS '抖音取消 SPI 原始请求体';
COMMENT ON COLUMN douyin_presale_orders.cancelled_at IS '本地同意取消的处理时间';
