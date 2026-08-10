COMMENT ON COLUMN douyin_presale_refund_notifications.id IS '退款通知明细主键';
COMMENT ON COLUMN douyin_presale_refund_notifications.currency IS '退款金额币种；境内商家通常为 CNY';
COMMENT ON COLUMN douyin_presale_refund_notifications.audit_user_type IS '退款审核人类型：1平台、2系统超时、3商家、4其他、5商家来客';
COMMENT ON COLUMN douyin_presale_refund_notifications.applicant_type IS '退款申请人类型：0未知、1用户、2客服运营、4商家、99系统';
COMMENT ON COLUMN douyin_presale_refund_notifications.need_third_cancel IS '退款后是否还需要第三方取消订单；仅抖音加白场景可能下发';
COMMENT ON COLUMN douyin_presale_refund_notifications.refund_reason IS '面向用户展示的退款申请原因';
COMMENT ON COLUMN douyin_presale_refund_notifications.refund_order_detail IS '退款涉及的抖音售卖房型和间夜金额明细';
