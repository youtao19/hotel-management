-- 创建订单修改记录表，用来存储订单修改历史
-- 不再使用"隐藏旧单+创建新单"的方式，而是保留原单并记录修改
BEGIN;

-- 1. 创建订单修改记录表
CREATE TABLE IF NOT EXISTS public.order_changes (
  change_id SERIAL PRIMARY KEY,                   -- 变更ID（自增）
  order_id VARCHAR(50) NOT NULL,                  -- 原始订单号
  change_type VARCHAR(50) NOT NULL,               -- 变更类型（如：修改房型、修改日期等）
  old_value JSONB NOT NULL,                       -- 修改前的值
  new_value JSONB NOT NULL,                       -- 修改后的值
  changed_fields TEXT[] NOT NULL,                 -- 变更的字段名数组
  change_reason TEXT,                             -- 变更原因
  change_time TIMESTAMP NOT NULL DEFAULT NOW(),   -- 变更时间
  operator VARCHAR(50),                           -- 操作人
  
  -- 添加外键约束，确保关联到有效的订单
  CONSTRAINT fk_order_changes_order_id FOREIGN KEY (order_id)
    REFERENCES public.orders (order_id) ON DELETE CASCADE,
    
  -- 添加检查约束，确保 old_value 和 new_value 不为空
  CONSTRAINT chk_order_changes_values CHECK (
    jsonb_typeof(old_value) IN ('object') AND 
    jsonb_typeof(new_value) IN ('object')
  )
);

-- 2. 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_order_changes_order_id ON public.order_changes (order_id);
CREATE INDEX IF NOT EXISTS idx_order_changes_change_time ON public.order_changes (change_time);
CREATE INDEX IF NOT EXISTS idx_order_changes_changed_fields ON public.order_changes USING GIN (changed_fields);

-- 3. 添加注释
COMMENT ON TABLE public.order_changes IS '订单修改记录表，记录每次订单修改的历史';
COMMENT ON COLUMN public.order_changes.change_id IS '变更记录ID（自增主键）';
COMMENT ON COLUMN public.order_changes.order_id IS '原始订单号';
COMMENT ON COLUMN public.order_changes.change_type IS '变更类型';
COMMENT ON COLUMN public.order_changes.old_value IS '修改前的完整值（JSON格式）';
COMMENT ON COLUMN public.order_changes.new_value IS '修改后的完整值（JSON格式）';
COMMENT ON COLUMN public.order_changes.changed_fields IS '变更的字段名数组';
COMMENT ON COLUMN public.order_changes.change_reason IS '变更原因';
COMMENT ON COLUMN public.order_changes.change_time IS '变更时间';
COMMENT ON COLUMN public.order_changes.operator IS '操作人';

-- 4. 创建查看订单变更历史的视图
CREATE OR REPLACE VIEW public.order_change_history AS
SELECT 
  oc.change_id,
  oc.order_id,
  oc.change_type,
  oc.changed_fields,
  oc.change_reason,
  oc.change_time,
  oc.operator,
  o.guest_name,
  o.phone,
  o.room_number,
  o.room_type,
  o.check_in_date,
  o.check_out_date,
  o.status
FROM 
  public.order_changes oc
JOIN 
  public.orders o ON oc.order_id = o.order_id
ORDER BY 
  oc.change_time DESC;

COMMIT;
