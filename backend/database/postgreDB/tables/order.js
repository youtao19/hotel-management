"use strict";

const tableName = "orders";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    order_id VARCHAR(50) PRIMARY KEY, -- 订单号
    id_source VARCHAR(50), -- 来源单号
    order_source VARCHAR(20) NOT NULL, -- 订单来源
    guest_name VARCHAR(50) NOT NULL, -- 客人姓名
    phone VARCHAR(20) NOT NULL, -- 客人电话
    id_number VARCHAR(30) NOT NULL, -- 证件号码
    room_type VARCHAR(20) NOT NULL, -- 房间类型
    room_number VARCHAR(20) NOT NULL, -- 房间号
    check_in_date DATE NOT NULL, -- 入住日期
    check_out_date DATE NOT NULL, -- 离店日期
    status VARCHAR(20) NOT NULL, -- 订单状态
    payment_method VARCHAR(20), -- 支付方式
    total_price NUMERIC(10, 2), -- 房间价格
    deposit DECIMAL(10,2), -- 押金
    create_time TIMESTAMP NOT NULL, -- 创建时间
    stay_type TEXT, -- 住宿类型
    remarks TEXT, -- 备注
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number),
    CONSTRAINT unique_order_constraint UNIQUE (guest_name, check_in_date, check_out_date, room_type)
)`;


const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON ${tableName}(status)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON ${tableName}(check_in_date, check_out_date)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_create_time ON ${tableName}(create_time DESC)`,
  // 仅对展示中的订单做唯一约束，避免历史版本冲突
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_active ON ${tableName} (guest_name, check_in_date, check_out_date, room_type)`
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;
