"use strict";

const tableName = "douyin_room_type_mapping";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    douyin_room_id VARCHAR(64) NOT NULL UNIQUE,
    douyin_room_name VARCHAR(255),
    local_room_type VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_douyin_room_type_mapping_updated_at ON ${tableName} (updated_at);`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音房型到本地房型一对一映射表';`,
  `COMMENT ON COLUMN ${tableName}.douyin_room_id IS '抖音物理房型ID';`,
  `COMMENT ON COLUMN ${tableName}.douyin_room_name IS '抖音物理房型名称';`,
  `COMMENT ON COLUMN ${tableName}.local_room_type IS '本地系统房型编码';`
];

const schemaUpdateQueryStrings = [
  `ALTER TABLE ${tableName} ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone')`,
  `ALTER TABLE ${tableName} ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE current_setting('TimeZone')`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'douyin_room_type_mapping_local_room_type_key'
     ) THEN
       ALTER TABLE ${tableName}
       ADD CONSTRAINT douyin_room_type_mapping_local_room_type_key UNIQUE (local_room_type);
     END IF;
   END $$;`
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
