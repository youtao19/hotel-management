"use strict";

const tableName = "bills";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    bill_id SERIAL PRIMARY KEY, -- 账单号
    order_id VARCHAR(50) NOT NULL, -- 订单号
    room_number VARCHAR(10) NOT NULL, -- 房间号
    guest_name VARCHAR(50), -- 客人姓名
    room_fee NUMERIC(10,2), -- 房间价格
    deposit NUMERIC(10,2) DEFAULT 0, -- 押金
    change_price NUMERIC(10,2) DEFAULT 0, -- 改价金额
    change_type TEXT, -- 改价类型
    pay_way VARCHAR(50) NOT NULL, -- 支付方式
    create_time TIMESTAMP NOT NULL, -- 创建时间
    remarks TEXT, -- 备注
    stay_type TEXT, -- 入住类型
    FOREIGN KEY (order_id) REFERENCES orders(order_id) -- 订单号外键
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
    `CREATE INDEX IF NOT EXISTS idx_bills_order_id ON ${tableName}(order_id)`
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;
