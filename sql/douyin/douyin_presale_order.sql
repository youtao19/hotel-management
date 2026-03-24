CREATE TABLE IF NOT EXISTS douyin_presale_orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE,
  ota_order_id VARCHAR(64) NOT NULL UNIQUE,
  source_order_id VARCHAR(64),
  account_id VARCHAR(64),
  hotel_id VARCHAR(64),
  biz_type INTEGER NOT NULL,
  order_stage VARCHAR(32) NOT NULL,
  pre_sale_coupon_id VARCHAR(64),
  goods_id VARCHAR(64),
  sku_id VARCHAR(64),
  rate_plan_id VARCHAR(64),
  contact_name VARCHAR(128),
  contact_mobile VARCHAR(128),
  guest_name VARCHAR(128),
  guest_mobile VARCHAR(128),
  voucher_count INTEGER,
  each_coupon_amount NUMERIC(12, 2),
  total_amount NUMERIC(12, 2),
  currency VARCHAR(16),
  check_in_date DATE,
  check_out_date DATE,
  early_arrival_time VARCHAR(32),
  last_arrival_time VARCHAR(32),
  douyin_log_id VARCHAR(128),
  raw_payload JSONB NOT NULL,
  mapped_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE douyin_presale_orders IS '抖音酒店预售券本地订单主表';
COMMENT ON COLUMN douyin_presale_orders.order_id IS '第三方订单号，回传给抖音的 order_out_id';
COMMENT ON COLUMN douyin_presale_orders.ota_order_id IS '抖音预售订单号';
COMMENT ON COLUMN douyin_presale_orders.source_order_id IS '来源预售订单号，供后续预约单关联';
COMMENT ON COLUMN douyin_presale_orders.biz_type IS '抖音业务类型，预售券固定为 2011';
COMMENT ON COLUMN douyin_presale_orders.order_stage IS '预售订单阶段';
COMMENT ON COLUMN douyin_presale_orders.pre_sale_coupon_id IS '预售券ID';
COMMENT ON COLUMN douyin_presale_orders.goods_id IS '抖音商品ID';
COMMENT ON COLUMN douyin_presale_orders.sku_id IS '抖音商品SKU ID';
COMMENT ON COLUMN douyin_presale_orders.rate_plan_id IS '抖音售卖房型ID';
COMMENT ON COLUMN douyin_presale_orders.voucher_count IS '预售券数量';
COMMENT ON COLUMN douyin_presale_orders.each_coupon_amount IS '单张预售券金额';
COMMENT ON COLUMN douyin_presale_orders.total_amount IS '订单总金额';
COMMENT ON COLUMN douyin_presale_orders.douyin_log_id IS '抖音请求头 x-bytedance-logid';

CREATE INDEX IF NOT EXISTS idx_douyin_presale_orders_ota_order_id ON douyin_presale_orders(ota_order_id);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_orders_source_order_id ON douyin_presale_orders(source_order_id);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_orders_order_stage ON douyin_presale_orders(order_stage);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_orders_created_at ON douyin_presale_orders(created_at DESC);
