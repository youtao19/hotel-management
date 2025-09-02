-- 数据库迁移：创建 order_changes 表

CREATE TABLE IF NOT EXISTS order_changes (
    change_id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by VARCHAR(255),
    changes JSONB NOT NULL,
    reason TEXT,
    CONSTRAINT fk_order
        FOREIGN KEY(order_id) 
        REFERENCES orders(order_id)
        ON DELETE CASCADE
);

COMMENT ON TABLE order_changes IS '记录订单信息的修改历史';
COMMENT ON COLUMN order_changes.change_id IS '变更记录的唯一ID';
COMMENT ON COLUMN order_changes.order_id IS '关联的订单ID';
COMMENT ON COLUMN order_changes.changed_at IS '变更发生的时间戳';
COMMENT ON COLUMN order_changes.changed_by IS '执行变更的操作员';
COMMENT ON COLUMN order_changes.changes IS '一个JSON对象，记录字段的新旧值';
COMMENT ON COLUMN order_changes.reason IS '执行变更的原因';
