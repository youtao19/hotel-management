"use strict";

const tableName = "douyin_order_event";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    douyin_order_id VARCHAR(100),
    order_out_id VARCHAR(100),
    internal_order_id VARCHAR(80),
    event_type VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    event_status VARCHAR(20) NOT NULL DEFAULT 'processed',
    idempotency_key VARCHAR(150) NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_order_event_idem ON ${tableName} (idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_order_event_order_id ON ${tableName} (douyin_order_id, order_out_id)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
