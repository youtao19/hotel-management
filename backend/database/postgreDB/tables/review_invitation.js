"use strict";

const tableName = "review_invitations";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  invited BOOLEAN NOT NULL DEFAULT FALSE,
  positive_review BOOLEAN DEFAULT NULL,
  invite_time TIMESTAMPTZ DEFAULT NULL,
  update_time TIMESTAMPTZ DEFAULT NULL,
  -- 注意：移除了 order_id 外键约束，因为多日分行结构中 order_id 不再是唯一的
  UNIQUE(order_id)
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_review_invitations_order_id ON ${tableName}(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_review_invitations_invited ON ${tableName}(invited)`,
  `CREATE INDEX IF NOT EXISTS idx_review_invitations_positive_review ON ${tableName}(positive_review)`
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;

