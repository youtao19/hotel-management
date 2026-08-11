ALTER TABLE douyin_presale_booking_orders
  ADD COLUMN IF NOT EXISTS reject_code INTEGER,
  ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(512);

COMMENT ON COLUMN douyin_presale_booking_orders.reject_code IS '员工手动拒单时发送给抖音的拒单原因码';
COMMENT ON COLUMN douyin_presale_booking_orders.reject_reason IS '员工手动拒单时发送给抖音的拒单原因';
COMMENT ON COLUMN douyin_presale_booking_orders.booking_status IS '本地预约状态：CREATED、CONFIRMED、REJECTED、CONFIRM_FAILED、CANCELLED 或 REFUNDED';
COMMENT ON COLUMN douyin_presale_booking_orders.confirm_status IS '确认接单状态：PENDING、CONFIRMED、REJECTED 或 FAILED';
COMMENT ON COLUMN douyin_presale_booking_orders.confirmed_at IS '接单或拒单结果成功回传时间，由数据库时区处理';
