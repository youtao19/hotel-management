CREATE TABLE IF NOT EXISTS douyin_presale_cancel_audits (
  id BIGSERIAL PRIMARY KEY,
  cancel_id VARCHAR(64) NOT NULL UNIQUE,
  biz_type INTEGER NOT NULL,
  presale_order_id INTEGER REFERENCES douyin_presale_orders(id) ON DELETE SET NULL,
  booking_order_id INTEGER REFERENCES douyin_presale_booking_orders(id) ON DELETE SET NULL,
  ota_order_id VARCHAR(64) NOT NULL,
  order_out_id VARCHAR(64),
  cancel_type INTEGER NOT NULL,
  after_sale_type INTEGER NOT NULL,
  refund_type INTEGER NOT NULL,
  request_log_id VARCHAR(128),
  request_payload JSONB NOT NULL,
  audit_status VARCHAR(32) NOT NULL,
  audit_result INTEGER,
  audit_reason TEXT,
  reviewer_account_id INTEGER,
  reviewer_name VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  callback_log_id VARCHAR(128),
  callback_response JSONB,
  callback_error TEXT,
  callback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_douyin_presale_cancel_audits_status_created
  ON douyin_presale_cancel_audits(audit_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_douyin_presale_cancel_audits_ota_order
  ON douyin_presale_cancel_audits(ota_order_id);

COMMENT ON TABLE douyin_presale_cancel_audits IS '抖音预售券及预约单取消人工审核记录；cancel_id 全局唯一用于 SPI 重试幂等';
COMMENT ON COLUMN douyin_presale_cancel_audits.id IS '取消人工审核记录主键';
COMMENT ON COLUMN douyin_presale_cancel_audits.cancel_id IS '抖音取消申请唯一标识，同一标识重复回调不得重复审核';
COMMENT ON COLUMN douyin_presale_cancel_audits.biz_type IS '抖音业务类型：2011预售券主订单，2012预售券预约单';
COMMENT ON COLUMN douyin_presale_cancel_audits.presale_order_id IS '关联的预售券主订单，仅 biz_type=2011 使用';
COMMENT ON COLUMN douyin_presale_cancel_audits.booking_order_id IS '关联的预售券预约单，仅 biz_type=2012 使用';
COMMENT ON COLUMN douyin_presale_cancel_audits.ota_order_id IS '抖音订单号 order_id，用于与取消申请核对';
COMMENT ON COLUMN douyin_presale_cancel_audits.order_out_id IS '酒店本地订单号 order_out_id，创单失败取消时允许为空';
COMMENT ON COLUMN douyin_presale_cancel_audits.cancel_type IS '取消类型：1支付前取消，2支付后取消，3创单失败取消';
COMMENT ON COLUMN douyin_presale_cancel_audits.after_sale_type IS '售后方式：1取消预约并退款，2仅取消预约，3仅退款不取消订单';
COMMENT ON COLUMN douyin_presale_cancel_audits.refund_type IS '退款类型：11规则内整单，12规则内部分，21规则外整单，22规则外部分';
COMMENT ON COLUMN douyin_presale_cancel_audits.request_log_id IS '取消 SPI 请求头 X-Bytedance-Logid';
COMMENT ON COLUMN douyin_presale_cancel_audits.request_payload IS '取消 SPI 原始请求体，供审核与抖音排障使用';
COMMENT ON COLUMN douyin_presale_cancel_audits.audit_status IS '审核状态：PENDING待人工审核、CALLBACK_PENDING待回传、APPROVED已同意、REJECTED已拒绝、CALLBACK_FAILED回传失败';
COMMENT ON COLUMN douyin_presale_cancel_audits.audit_result IS '人工审核结论：1同意，2拒绝';
COMMENT ON COLUMN douyin_presale_cancel_audits.audit_reason IS '审核拒绝或同意说明，回传抖音 reason';
COMMENT ON COLUMN douyin_presale_cancel_audits.reviewer_account_id IS '执行审核的本系统员工账号 ID';
COMMENT ON COLUMN douyin_presale_cancel_audits.reviewer_name IS '执行审核的本系统员工名称';
COMMENT ON COLUMN douyin_presale_cancel_audits.reviewed_at IS '人工提交审核结论时间，由数据库时区处理';
COMMENT ON COLUMN douyin_presale_cancel_audits.callback_log_id IS '抖音审核回传接口响应 extra.logid';
COMMENT ON COLUMN douyin_presale_cancel_audits.callback_response IS '抖音审核回传接口完整响应';
COMMENT ON COLUMN douyin_presale_cancel_audits.callback_error IS '最近一次审核回传失败原因，无抖音标识的网络错误也在此保存';
COMMENT ON COLUMN douyin_presale_cancel_audits.callback_at IS '审核结论成功回传抖音的时间，由数据库时区处理';
COMMENT ON COLUMN douyin_presale_cancel_audits.created_at IS '取消申请首次接收时间，由数据库时区处理';
COMMENT ON COLUMN douyin_presale_cancel_audits.updated_at IS '取消申请或审核回传最近更新时间，由数据库时区处理';
COMMENT ON COLUMN douyin_presale_booking_orders.booking_status IS '本地预约状态：CREATED、CONFIRMED、CONFIRM_FAILED、CANCELLED 或 REFUNDED';
