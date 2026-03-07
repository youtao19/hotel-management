"use strict";

const tableName = "ota_inventory_quota";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    channel_code VARCHAR(50) NOT NULL,
    room_type VARCHAR(20) NOT NULL,
    stay_date DATE NOT NULL,
    quota INTEGER NOT NULL CHECK (quota >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    FOREIGN KEY (room_type) REFERENCES room_types(type_code)
  );
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_ota_inventory_quota
     ON ${tableName} (channel_code, room_type, stay_date)`,
  `CREATE INDEX IF NOT EXISTS idx_ota_inventory_quota_room_date
     ON ${tableName} (room_type, stay_date)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
