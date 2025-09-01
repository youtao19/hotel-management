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
    room_price JSONB NOT NULL, -- 房间价格(JSON格式: {"YYYY-MM-DD": 价格} 或 数字)
    deposit DECIMAL(10,2), -- 押金
    create_time TIMESTAMP NOT NULL, -- 创建时间
    show BOOLEAN DEFAULT TRUE, -- 是否显示
    remarks TEXT, -- 备注
    FOREIGN KEY (room_type) REFERENCES room_types(type_code), -- 房间类型外键
    FOREIGN KEY (room_number) REFERENCES rooms(room_number), -- 房间号外键
    CONSTRAINT unique_order_constraint UNIQUE (guest_name, check_in_date, check_out_date, room_type), -- 唯一约束
  -- 允许 room_price 为对象(多日)或数字(单日/休息房)
  -- 允许 room_price 为对象(多日)或数字(单日/休息房)，以及字符串数字（兼容部分测试用例）
  CONSTRAINT chk_room_price_json CHECK (jsonb_typeof(room_price) IN ('object','number','string'))
)`;


const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON ${tableName}(status)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON ${tableName}(check_in_date, check_out_date)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_room_price_gin ON ${tableName} USING GIN (room_price)` // JSONB字段的GIN索引
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;
