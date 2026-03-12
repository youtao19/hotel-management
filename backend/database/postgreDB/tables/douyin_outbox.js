"use strict";

const tableName = "douyin_outbox";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(30) NOT NULL,
    local_room_type VARCHAR(20) NOT NULL,
    dedupe_key VARCHAR(150) NOT NULL,
    request_payload JSONB NOT NULL,
    task_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_outbox_dedupe_key ON ${tableName} (dedupe_key)`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_outbox_status_retry ON ${tableName} (task_status, next_retry_at)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
