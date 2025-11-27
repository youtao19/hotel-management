"use strict";

const tableName = "bills";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    bill_id SERIAL PRIMARY KEY, -- 账单号
    order_id VARCHAR(50), -- 订单号，允许为空以支持无订单的收入
    room_number VARCHAR(10), -- 房间号，非客房收入可为空
    guest_name VARCHAR(50), -- 客人姓名
    change_price NUMERIC(10,2) DEFAULT 0, -- 统一金额字段（收入为正，支出为负）
    change_type TEXT, -- 类型：房费、收押、退押、补收、退款
    pay_way VARCHAR(50) NOT NULL, -- 支付方式
    create_time TIMESTAMP NOT NULL, -- 创建时间
    remarks TEXT, -- 备注
    stay_type TEXT, -- 入住类型
    stay_date DATE -- 入住日期
    -- 注意：移除了 order_id 外键约束，因为多日分行结构中 order_id 不再是唯一的
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
