-- 将唯一约束调整为仅对有效（show=TRUE）的订单生效
-- 注意：执行前请确认无依赖旧约束名称差异

BEGIN;

-- 删除旧的唯一约束与索引（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_order_constraint'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT unique_order_constraint;
  END IF;
END$$;

-- 删除可能存在的旧索引
DROP INDEX IF EXISTS unique_order_constraint;

-- 创建仅对 show=TRUE 生效的部分唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_active
ON public.orders (guest_name, check_in_date, check_out_date, room_type)
WHERE COALESCE(show, true) = TRUE;

COMMIT;
