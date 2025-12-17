"use strict";

const tableName = "orders";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY, -- 自增主键
    order_id VARCHAR(50) NOT NULL, -- 订单号 (不再是主键)
    id_source VARCHAR(50), -- 来源单号
    order_source VARCHAR(20) NOT NULL, -- 订单来源
    guest_name VARCHAR(50) NOT NULL, -- 客人姓名
    phone VARCHAR(20), -- 客人电话（非必填）
    room_type VARCHAR(20) NOT NULL, -- 房间类型
    room_number VARCHAR(20) NOT NULL, -- 房间号
    check_in_date DATE NOT NULL, -- 入住日期 (订单整体)
    check_out_date DATE NOT NULL, -- 离店日期 (订单整体)
    stay_date DATE NOT NULL, -- 实际入住日期 (单日)
    status VARCHAR(20) NOT NULL, -- 订单状态
    payment_method VARCHAR(20), -- 支付方式
    total_price NUMERIC(10, 2), -- 房间价格 (单日)
    deposit DECIMAL(10,2), -- 押金 (通常只在第一天记录)
    is_prepaid BOOLEAN NOT NULL DEFAULT FALSE, -- 是否在下单时已收房费
    prepaid_amount NUMERIC(10,2) DEFAULT 0, -- 预收房费金额
    create_time TIMESTAMPTZ NOT NULL DEFAULT now(), -- 创建时间
    stay_type TEXT, -- 住宿类型
    remarks TEXT,
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
)`;


const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_orders_order_id ON ${tableName}(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON ${tableName}(status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON ${tableName}(check_in_date, check_out_date)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_stay_date ON ${tableName}(stay_date)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_create_time ON ${tableName}(create_time DESC)`,
  // 活跃订单唯一约束：同一人、同一房、同一天、同一类型不能重复 (允许同日 休息房+客房)
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_guest_stay ON ${tableName} (guest_name, room_number, stay_date, stay_type) WHERE status NOT IN ('cancelled', 'checked-out')`
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;
