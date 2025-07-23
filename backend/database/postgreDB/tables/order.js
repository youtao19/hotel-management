"use strict";

const tableName = "orders";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    order_id VARCHAR(20) PRIMARY KEY,
    id_source VARCHAR(50),
    order_source VARCHAR(20) NOT NULL,
    guest_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(30) NOT NULL,
    room_type VARCHAR(20) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20),
    room_price DECIMAL(10,2) NOT NULL,
    deposit DECIMAL(10,2),
    create_time TIMESTAMP NOT NULL,
    remarks TEXT,
    refunded_deposit DECIMAL(10,2) DEFAULT 0,
    refund_records JSONB DEFAULT '[]'::jsonb,
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number),
    CONSTRAINT unique_order_constraint UNIQUE (guest_name, check_in_date, check_out_date, room_type)
)`;


const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON ${tableName}(status)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON ${tableName}(check_in_date, check_out_date)`
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;
