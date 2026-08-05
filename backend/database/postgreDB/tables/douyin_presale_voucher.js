"use strict";

const tableName = 'douyin_presale_vouchers';

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    rate_plan_id INTEGER NOT NULL UNIQUE REFERENCES rate_plans(id),
    name VARCHAR(255) NOT NULL,
    original_amount NUMERIC(10, 2) NOT NULL,
    actual_amount NUMERIC(10, 2) NOT NULL,
    inventory_is_limited BOOLEAN NOT NULL DEFAULT TRUE,
    inventory_count INTEGER,
    sale_start_at TIMESTAMPTZ NOT NULL,
    sale_end_at TIMESTAMPTZ NOT NULL,
    book_start_date DATE NOT NULL,
    book_end_date DATE NOT NULL,
    image_urls JSONB NOT NULL DEFAULT '[]',
    douyin_voucher_id VARCHAR(100),
    audit_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    audit_message TEXT,
    sync_status INTEGER NOT NULL DEFAULT 0,
    last_sync_log_id VARCHAR(128),
    product_status VARCHAR(20),
    product_status_updated_at TIMESTAMPTZ,
    last_product_status_log_id VARCHAR(128),
    last_product_status_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT douyin_presale_vouchers_amount_check CHECK (original_amount >= actual_amount AND actual_amount >= 0),
    CONSTRAINT douyin_presale_vouchers_inventory_check CHECK (inventory_count IS NULL OR inventory_count >= 0),
    CONSTRAINT douyin_presale_vouchers_sale_time_check CHECK (sale_end_at > sale_start_at),
    CONSTRAINT douyin_presale_vouchers_book_date_check CHECK (book_end_date >= book_start_date)
  );
`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_douyin_presale_vouchers_audit_status ON ${tableName} (audit_status);`
];

const schemaUpdateQueryStrings = [
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS product_status VARCHAR(20);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS product_status_updated_at TIMESTAMPTZ;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS last_product_status_log_id VARCHAR(128);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS last_product_status_error TEXT;`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '本地预售券主数据，一张券仅绑定一个已同步的抖音预定商品';`,
  `COMMENT ON COLUMN ${tableName}.rate_plan_id IS '绑定的本地售卖套餐ID，唯一约束保证一期一券一套餐';`,
  `COMMENT ON COLUMN ${tableName}.original_amount IS '预售券划线价，单位元，发送抖音时转换为分';`,
  `COMMENT ON COLUMN ${tableName}.actual_amount IS '预售券实际售价，单位元，发送抖音时转换为分';`,
  `COMMENT ON COLUMN ${tableName}.inventory_is_limited IS '是否有限库存；false时inventory_count不参与抖音库存参数';`,
  `COMMENT ON COLUMN ${tableName}.image_urls IS '券图片URL数组，首张作为头图，其余作为详情图';`,
  `COMMENT ON COLUMN ${tableName}.audit_status IS '抖音审核状态：PENDING待审核、APPROVED通过、REJECTED未通过';`,
  `COMMENT ON COLUMN ${tableName}.sync_status IS '同步状态：1成功、0待同步、-1同步失败';`,
  `COMMENT ON COLUMN ${tableName}.last_sync_log_id IS '最近一次预售券创建或更新接口返回的logid，用于向抖音排查问题';`,
  `COMMENT ON COLUMN ${tableName}.product_status IS '抖音商品上下架状态：ONLINE已上线、OFFLINE已下线；为空表示尚未操作或未确认';`,
  `COMMENT ON COLUMN ${tableName}.product_status_updated_at IS '最近一次成功更新抖音商品状态的时间';`,
  `COMMENT ON COLUMN ${tableName}.last_product_status_log_id IS '最近一次抖音商品状态接口返回的logid，成功或失败均保留';`,
  `COMMENT ON COLUMN ${tableName}.last_product_status_error IS '最近一次抖音商品状态接口失败原因；成功后清空';`
];

module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings,
  schemaUpdateQueryStrings,
  createCommentQueryStrings
};
