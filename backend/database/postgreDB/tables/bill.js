"use strict";

const tableName = "bills";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    bill_id SERIAL PRIMARY KEY, -- 账单号
    order_id VARCHAR(50) NOT NULL, -- 订单号
    room_number VARCHAR(10) NOT NULL, -- 房间号
    guest_name VARCHAR(50), -- 客人姓名
    deposit DECIMAL(10,2), -- 押金
    refund_deposit DECIMAL(10,2) DEFAULT 0, -- 已退押金(0=未退，负数=已退金额)
    room_fee DECIMAL(10,2), -- 房费
    total_income DECIMAL(10,2), -- 总收入
    pay_way VARCHAR(50) NOT NULL, -- 支付方式
    create_time TIMESTAMP NOT NULL, -- 创建时间
    refund_time TIMESTAMP NOT NULL, -- 退款时间
    remarks TEXT, -- 备注
    FOREIGN KEY (order_id) REFERENCES orders(order_id), -- 订单号外键
    CONSTRAINT chk_refund_deposit CHECK (refund_deposit <= 0) -- 确保已退押金只能为0或负数
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
