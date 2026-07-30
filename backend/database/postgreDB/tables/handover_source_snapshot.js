"use strict";

const tableName = "handover_source_snapshot";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id SERIAL PRIMARY KEY,
  business_date DATE NOT NULL,
  source_item VARCHAR(40) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  bill_id INTEGER,
  order_id VARCHAR(50),
  room_number VARCHAR(20),
  guest_name VARCHAR(50),
  change_type TEXT,
  source_amount NUMERIC(10,2) NOT NULL,
  bill_create_time TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_handover_source_snapshot_lookup
   ON ${tableName}(business_date, source_item, payment_method, bill_create_time, bill_id)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
