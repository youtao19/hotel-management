"use strict";

const tableName = "dashboard_memos";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    memo_id SERIAL PRIMARY KEY,
    memo_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );
`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_dashboard_memos_date ON ${tableName} (memo_date);`,
  `CREATE INDEX IF NOT EXISTS idx_dashboard_memos_priority ON ${tableName} (priority);`
];

module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings
};
