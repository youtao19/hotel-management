"use strict";

const tableName = "douyin_account_config";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    account_code VARCHAR(50) PRIMARY KEY,
    client_key VARCHAR(100) NOT NULL,
    inbound_secret VARCHAR(200) NOT NULL,
    app_id VARCHAR(100),
    app_secret VARCHAR(200),
    account_id VARCHAR(100),
    hotel_id VARCHAR(100),
    api_base_url TEXT,
    access_token TEXT,
    token_expire_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    mock_mode VARCHAR(20) NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_douyin_account_config_client_key ON ${tableName} (client_key)`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
};
