"use strict";

const tableName = "douyin_physical_rooms";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    room_id VARCHAR(64) NOT NULL UNIQUE,
    room_name VARCHAR(255),
    status INTEGER,
    audit_message TEXT,
    rate_plan_list JSONB,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_douyin_physical_rooms_account_id ON ${tableName} (account_id);`,
  `CREATE INDEX IF NOT EXISTS idx_douyin_physical_rooms_updated_at ON ${tableName} (updated_at);`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音物理房型原始缓存表';`,
  `COMMENT ON COLUMN ${tableName}.account_id IS '抖音账号ID';`,
  `COMMENT ON COLUMN ${tableName}.room_id IS '抖音物理房型ID';`,
  `COMMENT ON COLUMN ${tableName}.room_name IS '抖音物理房型名称';`,
  `COMMENT ON COLUMN ${tableName}.status IS '抖音物理房型状态';`,
  `COMMENT ON COLUMN ${tableName}.audit_message IS '审核信息';`,
  `COMMENT ON COLUMN ${tableName}.rate_plan_list IS '价格计划列表';`,
  `COMMENT ON COLUMN ${tableName}.raw_payload IS '抖音原始房型对象';`
];

const schemaUpdateQueryStrings = [
  `ALTER TABLE ${tableName} ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone')`,
  `ALTER TABLE ${tableName} ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE current_setting('TimeZone')`
];

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings,
  createCommentQueryStrings,
  schemaUpdateQueryStrings,
  dropQuery
};
