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
    each_person_max INTEGER NOT NULL DEFAULT 1,
    each_person_each_order_max INTEGER NOT NULL DEFAULT 1,
    cancel_booking_type INTEGER NOT NULL DEFAULT 3,
    cancel_booking_offset_days INTEGER,
    cancel_booking_offset_hours INTEGER,
    markup_rules JSONB NOT NULL DEFAULT '[]',
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
    CONSTRAINT douyin_presale_vouchers_each_person_max_check CHECK (each_person_max > 0),
    CONSTRAINT douyin_presale_vouchers_each_person_each_order_max_check CHECK (each_person_each_order_max > 0),
    CONSTRAINT douyin_presale_vouchers_cancel_booking_type_check CHECK (cancel_booking_type IN (1, 2, 3)),
    CONSTRAINT douyin_presale_vouchers_cancel_booking_offset_days_check CHECK (cancel_booking_offset_days IS NULL OR cancel_booking_offset_days >= 1),
    CONSTRAINT douyin_presale_vouchers_cancel_booking_offset_hours_check CHECK (cancel_booking_offset_hours IS NULL OR cancel_booking_offset_hours BETWEEN 0 AND 23),
    CONSTRAINT douyin_presale_vouchers_cancel_booking_offset_required_check CHECK (
      cancel_booking_type <> 2 OR (cancel_booking_offset_days IS NOT NULL AND cancel_booking_offset_hours IS NOT NULL)
    ),
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
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS last_product_status_error TEXT;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS each_person_max INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS each_person_each_order_max INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_booking_type INTEGER NOT NULL DEFAULT 3;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_booking_offset_days INTEGER;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS cancel_booking_offset_hours INTEGER;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS markup_rules JSONB NOT NULL DEFAULT '[]';`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '本地预售券主数据，一张券仅绑定一个已同步的抖音预定商品';`,
  `COMMENT ON COLUMN ${tableName}.rate_plan_id IS '绑定的本地售卖套餐ID，唯一约束保证一期一券一套餐';`,
  `COMMENT ON COLUMN ${tableName}.original_amount IS '预售券划线价，单位元，发送抖音时转换为分';`,
  `COMMENT ON COLUMN ${tableName}.actual_amount IS '预售券实际售价，单位元，发送抖音时转换为分';`,
  `COMMENT ON COLUMN ${tableName}.inventory_is_limited IS '是否有限库存；false时inventory_count不参与抖音库存参数';`,
  `COMMENT ON COLUMN ${tableName}.each_person_max IS '单个抖音用户在本券售卖期内累计可购买的最大张数，必须大于0';`,
  `COMMENT ON COLUMN ${tableName}.each_person_each_order_max IS '单个抖音用户每笔订单可购买的最大张数，必须大于0';`,
  `COMMENT ON COLUMN ${tableName}.cancel_booking_type IS '抖音取消预约类型：1未使用自动退，2限时取消且必须配置入住前免费取消截止时间，3不可取消';`,
  `COMMENT ON COLUMN ${tableName}.cancel_booking_offset_days IS '限时取消距入住时间的提前天数；cancel_booking_type=2时必填，必须至少1天';`,
  `COMMENT ON COLUMN ${tableName}.cancel_booking_offset_hours IS '限时取消距入住时间的提前小时数；cancel_booking_type=2时必填，范围0至23';`,
  `COMMENT ON COLUMN ${tableName}.markup_rules IS '预约加价规则数组：每项包含指定日期或节假日、适用范围、星期和每晚加价金额（元）；同步抖音时转换为分';`,
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
