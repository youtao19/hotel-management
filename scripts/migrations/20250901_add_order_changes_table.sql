-- 创建订单变更历史表
CREATE TABLE IF NOT EXISTS order_changes (
    change_id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    old_value JSONB NOT NULL,
    new_value JSONB NOT NULL,
    changed_fields TEXT[] NOT NULL,
    change_reason TEXT,
    operator VARCHAR(100),
    change_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- 创建索引以提高查询效率
CREATE INDEX IF NOT EXISTS idx_order_changes_order_id ON order_changes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_changes_change_time ON order_changes(change_time);

-- 添加注释
COMMENT ON TABLE order_changes IS '订单变更历史记录表';
COMMENT ON COLUMN order_changes.change_id IS '变更ID，自增主键';
COMMENT ON COLUMN order_changes.order_id IS '订单ID，关联orders表';
COMMENT ON COLUMN order_changes.change_type IS '变更类型，如修改客人信息、修改房间等';
COMMENT ON COLUMN order_changes.old_value IS '修改前的值，JSON格式';
COMMENT ON COLUMN order_changes.new_value IS '修改后的值，JSON格式';
COMMENT ON COLUMN order_changes.changed_fields IS '变更的字段列表';
COMMENT ON COLUMN order_changes.change_reason IS '变更原因';
COMMENT ON COLUMN order_changes.operator IS '操作人';
COMMENT ON COLUMN order_changes.change_time IS '变更时间';
