CREATE TABLE IF NOT EXISTS douyin_presale_booking_orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE,
  ota_order_id VARCHAR(64) NOT NULL UNIQUE,
  source_order_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(64),
  hotel_id VARCHAR(64) NOT NULL,
  rate_plan_id VARCHAR(64) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  biz_type INTEGER NOT NULL DEFAULT 2012,
  booking_status VARCHAR(32) NOT NULL,
  confirm_status VARCHAR(32) NOT NULL,
  confirm_number VARCHAR(64),
  create_log_id VARCHAR(128),
  confirm_log_id VARCHAR(128),
  confirm_error VARCHAR(512),
  confirm_response JSONB,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  number_of_units INTEGER NOT NULL,
  number_of_guests INTEGER NOT NULL,
  total_amount BIGINT NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
  assigned_rooms JSONB NOT NULL,
  daily_rates JSONB NOT NULL,
  occupancies JSONB,
  contact_info JSONB,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_source_order_id
  ON douyin_presale_booking_orders(source_order_id);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_confirm_status
  ON douyin_presale_booking_orders(confirm_status);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_created_at
  ON douyin_presale_booking_orders(created_at DESC);

COMMENT ON TABLE douyin_presale_booking_orders IS '抖音住宿预售券预约订单，固定对应 biz_type=2012';
COMMENT ON COLUMN douyin_presale_booking_orders.order_id IS '本地预约订单号，作为创建预约响应的 order_out_id';
COMMENT ON COLUMN douyin_presale_booking_orders.ota_order_id IS '抖音预约订单号 order_id，用于回调幂等和确认接单';
COMMENT ON COLUMN douyin_presale_booking_orders.source_order_id IS '来源抖音预售券订单号，必须关联已支付的 biz_type=2011 订单';
COMMENT ON COLUMN douyin_presale_booking_orders.biz_type IS '抖音业务类型，预约订单固定为 2012';
COMMENT ON COLUMN douyin_presale_booking_orders.booking_status IS '本地预约状态：CREATED、CONFIRMED 或 CONFIRM_FAILED';
COMMENT ON COLUMN douyin_presale_booking_orders.confirm_status IS '确认接单状态：PENDING、CONFIRMED 或 FAILED';
COMMENT ON COLUMN douyin_presale_booking_orders.confirm_number IS '本地酒店确认号，发送至抖音确认接单接口';
COMMENT ON COLUMN douyin_presale_booking_orders.create_log_id IS '创建预约 SPI 请求头 X-Bytedance-Logid';
COMMENT ON COLUMN douyin_presale_booking_orders.confirm_log_id IS '确认接单接口响应 extra.logid';
COMMENT ON COLUMN douyin_presale_booking_orders.confirm_error IS '确认接单失败原因；网络失败时不含抖音 logid';
COMMENT ON COLUMN douyin_presale_booking_orders.total_amount IS '预约订单原始总金额，单位分';
COMMENT ON COLUMN douyin_presale_booking_orders.assigned_rooms IS '已分配的本地房间号数组；每个房间在入住区间占用库存';
COMMENT ON COLUMN douyin_presale_booking_orders.daily_rates IS '抖音请求的单日单间价格明细，金额单位分';
COMMENT ON COLUMN douyin_presale_booking_orders.confirmed_at IS '确认接单成功时间，由数据库时区处理';
