CREATE TABLE IF NOT EXISTS douyin_presale_booking_accommodation_syncs (
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
);

CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_accommodation_syncs_status
  ON douyin_presale_booking_accommodation_syncs(sync_status, updated_at DESC);

COMMENT ON TABLE douyin_presale_booking_accommodation_syncs IS '抖音预售券预约单入住、未入住和离店状态的出站同步记录；一笔预约单每种履约状态只保留一条可重试记录';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.booking_order_id IS '关联 douyin_presale_booking_orders.id，仅对应 biz_type=2012 预约订单';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.accommodation_status IS '通知抖音的住宿状态：1已入住，2未入住，3已离店';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.sync_status IS '同步状态：PENDING待发送、SUCCEEDED成功、FAILED失败';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.attempt_count IS '向抖音实际发起请求的累计次数，首次发送为 1';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.last_attempt_at IS '最近一次向抖音发送履约通知的时间，由数据库时区处理';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.synced_at IS '抖音确认接收履约通知的时间，由数据库时区处理';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.douyin_log_id IS '抖音履约接口响应 extra.logid，用于平台排查';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.error_code IS '抖音响应 extra.error_code；网络异常为空';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.error_description IS '抖音业务失败描述或网络异常原因';
COMMENT ON COLUMN douyin_presale_booking_accommodation_syncs.response IS '抖音履约接口最近一次原始 JSON 响应；网络异常为空';
