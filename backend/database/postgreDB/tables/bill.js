"use strict";

const tableName = "bills";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    order_id VARCHAR(50) PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL,
    guest_name VARCHAR(50),
    deposit DECIMAL(10,2),
    refund_deposit BOOLEAN NOT NULL,
    room_fee DECIMAL(10,2),
    total_income DECIMAL(10,2),
    pay_way VARCHAR(50) NOT NULL,
    create_time TIMESTAMP NOT NULL,
    remarks TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
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
