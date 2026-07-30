"use strict";

const tableName = "handover_daily_settings";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  business_date DATE PRIMARY KEY,
  cash_reserve NUMERIC(10,2) NOT NULL CHECK (cash_reserve >= 0),
  cash_retained NUMERIC(10,2) NOT NULL CHECK (cash_retained >= 0),
  set_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

module.exports = {
  tableName,
  createQuery,
  dropQuery
};
