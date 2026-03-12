"use strict";

const tableName = "douyin_order";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    internal_order_id VARCHAR(80) NOT NULL,
    douyin_order_id VARCHAR(100) NOT NULL,
    order_out_id VARCHAR(100),
    hotel_confirm_number VARCHAR(100) NOT NULL,
    local_room_type VARCHAR(20) NOT NULL,
    douyin_room_id VARCHAR(100) NOT NULL,
    douyin_rate_plan_id VARCHAR(100),
    order_status VARCHAR(30) NOT NULL,
    pay_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    cancel_status VARCHAR(30) NOT NULL DEFAULT 'none',
    raw_create_payload JSONB,
    raw_cancel_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_order_douyin_id ON ${tableName} (douyin_order_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_order_order_out_id ON ${tableName} (order_out_id) WHERE order_out_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_order_confirm_number ON ${tableName} (hotel_confirm_number)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
