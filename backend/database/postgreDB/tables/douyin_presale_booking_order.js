"use strict";

/** 抖音预售券预约订单表名。 */
const tableName = 'douyin_presale_booking_orders';

/** 创建抖音预售券预约订单表。 */
const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
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
  reject_code INTEGER,
  reject_reason VARCHAR(512),
  create_log_id VARCHAR(128),
  confirm_log_id VARCHAR(128),
  confirm_error VARCHAR(512),
  confirm_response JSONB,
  refund_status VARCHAR(32),
  refund_log_id VARCHAR(128),
  refund_received_at TIMESTAMPTZ,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  number_of_units INTEGER NOT NULL,
  number_of_guests INTEGER NOT NULL,
  total_amount BIGINT NOT NULL,
  add_amount BIGINT NOT NULL DEFAULT 0,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  payment_log_id VARCHAR(128),
  cancel_id VARCHAR(128),
  cancel_status VARCHAR(32),
  cancel_log_id VARCHAR(128),
  cancel_payload JSONB,
  cancelled_at TIMESTAMPTZ,
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
  assigned_rooms JSONB NOT NULL,
  daily_rates JSONB NOT NULL,
  occupancies JSONB,
  contact_info JSONB,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

/** 删除抖音预售券预约订单表。 */
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

/** 为已存在的预约订单表补齐退款结果字段。 */
const schemaUpdateQueryStrings = [
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS refund_log_id VARCHAR(128);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS refund_received_at TIMESTAMPTZ;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS reject_code INTEGER;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(512);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS add_amount BIGINT NOT NULL DEFAULT 0;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED';`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS payment_log_id VARCHAR(128);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_id VARCHAR(128);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_status VARCHAR(32);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_log_id VARCHAR(128);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_payload JSONB;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;`
];

/** 创建预约订单查询索引。 */
const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_source_order_id ON ${tableName}(source_order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_confirm_status ON ${tableName}(confirm_status)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_cancel_id ON ${tableName}(cancel_id)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_booking_orders_created_at ON ${tableName}(created_at DESC)`
];

/** 创建预约订单结构注释。 */
const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音住宿预售券预约订单，固定对应 biz_type=2012';`,
  `COMMENT ON COLUMN ${tableName}.order_id IS '本地预约订单号，作为创建预约响应的 order_out_id';`,
  `COMMENT ON COLUMN ${tableName}.ota_order_id IS '抖音预约订单号 order_id，用于回调幂等和确认接单';`,
  `COMMENT ON COLUMN ${tableName}.source_order_id IS '来源抖音预售券订单号，必须关联已支付的 biz_type=2011 订单';`,
  `COMMENT ON COLUMN ${tableName}.biz_type IS '抖音业务类型，预约订单固定为 2012';`,
  `COMMENT ON COLUMN ${tableName}.booking_status IS '本地预约状态：CREATED、CONFIRMED、REJECTED、CONFIRM_FAILED、CANCELLED 或 REFUNDED';`,
  `COMMENT ON COLUMN ${tableName}.confirm_status IS '确认接单状态：PENDING、CONFIRMED、REJECTED 或 FAILED';`,
  `COMMENT ON COLUMN ${tableName}.confirm_number IS '本地酒店确认号，发送至抖音确认接单接口';`,
  `COMMENT ON COLUMN ${tableName}.reject_code IS '员工手动拒单时发送给抖音的拒单原因码';`,
  `COMMENT ON COLUMN ${tableName}.reject_reason IS '员工手动拒单时发送给抖音的拒单原因';`,
  `COMMENT ON COLUMN ${tableName}.create_log_id IS '创建预约 SPI 请求头 X-Bytedance-Logid';`,
  `COMMENT ON COLUMN ${tableName}.confirm_log_id IS '确认接单接口响应 extra.logid';`,
  `COMMENT ON COLUMN ${tableName}.confirm_error IS '确认接单失败原因；网络失败时不含抖音 logid';`,
  `COMMENT ON COLUMN ${tableName}.refund_status IS '退款状态：COMPLETED 表示抖音已完成预约单退款';`,
  `COMMENT ON COLUMN ${tableName}.refund_log_id IS '预约单退款结果通知的 X-Bytedance-Logid';`,
  `COMMENT ON COLUMN ${tableName}.refund_received_at IS '预约单退款结果通知接收时间，由数据库时区处理';`,
  `COMMENT ON COLUMN ${tableName}.total_amount IS '预约订单原始总金额，单位分';`,
  `COMMENT ON COLUMN ${tableName}.add_amount IS '预约订单应付加价总额，按 daily_rates.daily_add_amount 汇总，单位分';`,
  `COMMENT ON COLUMN ${tableName}.payment_status IS '预约加价支付状态：NOT_REQUIRED无需加价、PENDING待支付、PAID已支付或 CANCELLED超时取消';`,
  `COMMENT ON COLUMN ${tableName}.payment_log_id IS '预约加价支付通知的 X-Bytedance-Logid';`,
  `COMMENT ON COLUMN ${tableName}.cancel_id IS '抖音取消预约请求唯一标识，用于幂等处理';`,
  `COMMENT ON COLUMN ${tableName}.cancel_status IS '预约取消处理状态：CANCELLED 或 REFUND_PENDING';`,
  `COMMENT ON COLUMN ${tableName}.cancel_log_id IS '预约取消 SPI 请求头 X-Bytedance-Logid';`,
  `COMMENT ON COLUMN ${tableName}.cancel_payload IS '抖音预约取消 SPI 原始请求体';`,
  `COMMENT ON COLUMN ${tableName}.cancelled_at IS '本地同意取消预约的处理时间，由数据库时区处理';`,
  `COMMENT ON COLUMN ${tableName}.assigned_rooms IS '已分配的本地房间号数组；每个房间在入住区间占用库存';`,
  `COMMENT ON COLUMN ${tableName}.daily_rates IS '抖音请求的单日单间价格明细，金额单位分';`,
  `COMMENT ON COLUMN ${tableName}.confirmed_at IS '接单或拒单结果成功回传时间，由数据库时区处理';`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  schemaUpdateQueryStrings,
  createIndexQueryStrings,
  createCommentQueryStrings
};
