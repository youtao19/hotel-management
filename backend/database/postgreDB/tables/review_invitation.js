"use strict";

const tableName = "review_invitations";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  invited BOOLEAN NOT NULL DEFAULT FALSE,
  positive_review BOOLEAN DEFAULT NULL,
  invite_time TIMESTAMP DEFAULT NULL,
  update_time TIMESTAMP DEFAULT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
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

