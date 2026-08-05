ALTER TABLE douyin_presale_vouchers
  ADD COLUMN IF NOT EXISTS product_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS product_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_product_status_log_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS last_product_status_error TEXT;

COMMENT ON COLUMN douyin_presale_vouchers.product_status IS '抖音商品上下架状态：ONLINE已上线、OFFLINE已下线；为空表示尚未操作或未确认';
COMMENT ON COLUMN douyin_presale_vouchers.product_status_updated_at IS '最近一次成功更新抖音商品状态的时间';
COMMENT ON COLUMN douyin_presale_vouchers.last_product_status_log_id IS '最近一次抖音商品状态接口返回的logid，成功或失败均保留';
COMMENT ON COLUMN douyin_presale_vouchers.last_product_status_error IS '最近一次抖音商品状态接口失败原因；成功后清空';
