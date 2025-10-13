-- 迁移日期: 2025-10-13
-- 描述: 将订单唯一约束从房型改为房间号
-- 原因: 防止同一客人在相同时间段重复预订相同房间
--
-- 变更内容:
-- 1. 删除基于房型的唯一约束
-- 2. 创建基于房间号的唯一约束
-- 3. 更新部分唯一索引（只对活跃订单）

BEGIN;

-- 1. 删除旧的唯一约束（基于房型）
ALTER TABLE orders DROP CONSTRAINT IF EXISTS unique_order_constraint;

-- 2. 删除旧的部分唯一索引
DROP INDEX IF EXISTS uniq_orders_active;

-- 3. 创建新的唯一约束（基于房间号）
-- 防止同一客人在相同时间段预订相同房间
ALTER TABLE orders ADD CONSTRAINT unique_order_constraint 
  UNIQUE (guest_name, check_in_date, check_out_date, room_number);

-- 4. 创建新的部分唯一索引
-- 只对活跃订单（非已取消、非已退房）应用唯一约束
-- 这样允许历史订单重复，避免归档数据冲突
CREATE UNIQUE INDEX uniq_orders_active ON orders (
  guest_name, check_in_date, check_out_date, room_number
) WHERE status NOT IN ('cancelled', 'checked-out');

COMMIT;

-- 验证约束
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'orders'::regclass AND conname = 'unique_order_constraint';

