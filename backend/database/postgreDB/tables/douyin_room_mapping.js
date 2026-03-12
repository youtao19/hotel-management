"use strict";

const tableName = "douyin_room_mapping";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    local_room_type VARCHAR(20) NOT NULL,
    douyin_room_id VARCHAR(100) NOT NULL,
    douyin_rate_plan_id VARCHAR(100) NOT NULL DEFAULT '',
    sync_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    sync_price BOOLEAN NOT NULL DEFAULT TRUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (local_room_type) REFERENCES room_types(type_code)
  );
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_room_mapping_room_rate
     ON ${tableName} (douyin_room_id, douyin_rate_plan_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_douyin_room_mapping_local_type
     ON ${tableName} (local_room_type, douyin_rate_plan_id)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
