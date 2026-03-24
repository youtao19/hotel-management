-- Active: 1759822017582@@127.0.0.1@5432@hotel_db@public
CREATE TABLE IF NOT EXISTS douyin_orders (
  id BIGSERIAL PRIMARY KEY,
  ota_order_id VARCHAR(64) NOT NULL UNIQUE,
  account_id VARCHAR(64),
  order_status VARCHAR(32),
  guest_name VARCHAR(128),
  guest_mobile VARCHAR(64),
  check_in_date DATE,
  check_out_date DATE,
  room_count INTEGER,
  amount DECIMAL(12, 2),
  currency VARCHAR(16),
  raw_payload JSONB NOT NULL,
  mapped_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE douyin_orders IS '抖音OTA订单落地表';
COMMENT ON COLUMN douyin_orders.ota_order_id IS '抖音订单ID，幂等唯一键';
COMMENT ON COLUMN douyin_orders.account_id IS '抖音商家账户ID';
COMMENT ON COLUMN douyin_orders.order_status IS '抖音订单状态';
COMMENT ON COLUMN douyin_orders.guest_name IS '入住人/联系人姓名';
COMMENT ON COLUMN douyin_orders.guest_mobile IS '入住人/联系人手机号';
COMMENT ON COLUMN douyin_orders.check_in_date IS '入住日期';
COMMENT ON COLUMN douyin_orders.check_out_date IS '离店日期';
COMMENT ON COLUMN douyin_orders.room_count IS '房间数';
COMMENT ON COLUMN douyin_orders.amount IS '订单金额';
COMMENT ON COLUMN douyin_orders.currency IS '币种';
COMMENT ON COLUMN douyin_orders.raw_payload IS '抖音原始请求体';
COMMENT ON COLUMN douyin_orders.mapped_payload IS '映射后的标准字段';

ALTER TABLE douyin_orders
ADD COLUMN synced BOOLEAN DEFAULT FALSE,
ADD COLUMN system_order_id BIGINT;

COMMENT ON COLUMN douyin_orders.synced IS '是否已同步到系统订单';
COMMENT ON COLUMN douyin_orders.system_order_id IS '系统订单ID';

ALTER TABLE douyin_orders
ADD COLUMN confirm_status VARCHAR(32),
ADD COLUMN confirm_number VARCHAR(64),
ADD COLUMN confirmed_at TIMESTAMP;

COMMENT ON COLUMN douyin_orders.confirm_status IS '确认状态：pending/confirmed/failed';
COMMENT ON COLUMN douyin_orders.confirm_number IS '传给抖音的确认号';
COMMENT ON COLUMN douyin_orders.confirmed_at IS '订单确认时间';

ALTER TABLE douyin_orders
ADD COLUMN room_id VARCHAR(64),
ADD COLUMN room_name VARCHAR(255);

COMMENT ON COLUMN douyin_orders.room_id IS '房间ID';
COMMENT ON COLUMN douyin_orders.room_name IS '房间名称';

ALTER TABLE douyin_orders
ADD COLUMN IF NOT EXISTS source_order_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS hotel_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(128),
ADD COLUMN IF NOT EXISTS contact_mobile VARCHAR(128),
ADD COLUMN IF NOT EXISTS number_of_guests INTEGER,
ADD COLUMN IF NOT EXISTS amount_before_tax DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS rate_plan_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS biz_type INTEGER,
ADD COLUMN IF NOT EXISTS remark_from_douyin TEXT,
ADD COLUMN IF NOT EXISTS remark_from_guest TEXT,
ADD COLUMN IF NOT EXISTS daily_rates JSONB,
ADD COLUMN IF NOT EXISTS occupancies JSONB,
ADD COLUMN IF NOT EXISTS member_info JSONB,
ADD COLUMN IF NOT EXISTS douyin_log_id VARCHAR(128),
ADD COLUMN IF NOT EXISTS cancel_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS cancel_type INTEGER,
ADD COLUMN IF NOT EXISTS need_audit BOOLEAN,
ADD COLUMN IF NOT EXISTS after_sale_type INTEGER,
ADD COLUMN IF NOT EXISTS refund_type INTEGER,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS user_refund_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancel_order_time VARCHAR(19),
ADD COLUMN IF NOT EXISTS refund_order_detail JSONB,
ADD COLUMN IF NOT EXISTS cancel_status VARCHAR(32),
ADD COLUMN IF NOT EXISTS cancel_audit_deadline VARCHAR(19),
ADD COLUMN IF NOT EXISTS cancel_audit_result INTEGER,
ADD COLUMN IF NOT EXISTS cancel_audit_reason TEXT,
ADD COLUMN IF NOT EXISTS cancel_audit_status VARCHAR(32),
ADD COLUMN IF NOT EXISTS cancel_audit_response JSONB,
ADD COLUMN IF NOT EXISTS cancel_audit_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancel_audit_retry_count INTEGER DEFAULT 0;

COMMENT ON COLUMN douyin_orders.source_order_id IS '预售来源订单号';
COMMENT ON COLUMN douyin_orders.hotel_id IS '抖音酒店ID';
COMMENT ON COLUMN douyin_orders.contact_name IS '联系人姓名';
COMMENT ON COLUMN douyin_orders.contact_mobile IS '联系人手机号/加密串';
COMMENT ON COLUMN douyin_orders.number_of_guests IS '入住人数';
COMMENT ON COLUMN douyin_orders.amount_before_tax IS '税前金额';
COMMENT ON COLUMN douyin_orders.rate_plan_id IS '抖音售卖房型ID';
COMMENT ON COLUMN douyin_orders.biz_type IS '业务类型';
COMMENT ON COLUMN douyin_orders.remark_from_douyin IS '抖音备注';
COMMENT ON COLUMN douyin_orders.remark_from_guest IS '客人备注';
COMMENT ON COLUMN douyin_orders.daily_rates IS '抖音分日价格明细';
COMMENT ON COLUMN douyin_orders.occupancies IS '入住人明细';
COMMENT ON COLUMN douyin_orders.member_info IS '会员信息';
COMMENT ON COLUMN douyin_orders.douyin_log_id IS '抖音请求头 x-bytedance-logid';
COMMENT ON COLUMN douyin_orders.cancel_id IS '取消单唯一标识';
COMMENT ON COLUMN douyin_orders.cancel_type IS '取消类型';
COMMENT ON COLUMN douyin_orders.need_audit IS '是否需要审核';
COMMENT ON COLUMN douyin_orders.after_sale_type IS '售后方式';
COMMENT ON COLUMN douyin_orders.refund_type IS '退款类型';
COMMENT ON COLUMN douyin_orders.refund_amount IS '申请退款金额';
COMMENT ON COLUMN douyin_orders.user_refund_amount IS '用户实退金额';
COMMENT ON COLUMN douyin_orders.penalty_amount IS '罚金金额';
COMMENT ON COLUMN douyin_orders.cancel_reason IS '取消原因';
COMMENT ON COLUMN douyin_orders.cancel_order_time IS '取消时间';
COMMENT ON COLUMN douyin_orders.refund_order_detail IS '售后间夜明细';
COMMENT ON COLUMN douyin_orders.cancel_status IS '取消处理状态';
COMMENT ON COLUMN douyin_orders.cancel_audit_deadline IS '审核截止时间';
COMMENT ON COLUMN douyin_orders.cancel_audit_result IS '审核回传结果(1同意/2拒绝)';
COMMENT ON COLUMN douyin_orders.cancel_audit_reason IS '审核回传原因';
COMMENT ON COLUMN douyin_orders.cancel_audit_status IS '审核回传状态';
COMMENT ON COLUMN douyin_orders.cancel_audit_response IS '审核回传原始响应';
COMMENT ON COLUMN douyin_orders.cancel_audit_sent_at IS '审核回传时间';
COMMENT ON COLUMN douyin_orders.cancel_audit_retry_count IS '审核回传重试次数';


ALTER TABLE douyin_orders
ALTER COLUMN system_order_id TYPE VARCHAR(64)
USING system_order_id::VARCHAR;

COMMENT ON COLUMN douyin_orders.system_order_id IS '系统订单号(order_id)';
