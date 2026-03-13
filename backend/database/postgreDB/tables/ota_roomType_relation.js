"use strict";

// OTA 房型映射表名，用于维护 OTA 房型与本地房型的一对一关系。
const tableName = "ota_room_type_relation";

// 创建 OTA 房型映射表，保存外部房型与本地房型的映射关系。
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    ota_room_type VARCHAR(100) NOT NULL,
    local_room_type_id VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// 删除 OTA 房型映射表的 SQL，供测试环境重建数据库时使用。
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

// 映射表索引集合，分别用于唯一约束和按本地房型查询。
const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_ota_room_type_relation_platform_room ON ${tableName} (platform, ota_room_type)`,
  `CREATE INDEX IF NOT EXISTS idx_ota_room_type_relation_local_room ON ${tableName} (local_room_type_id)`
];

// 映射表注释 SQL 集合，统一为表和关键字段补充数据库注释，方便后续排查与维护。
const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS 'OTA房型映射表：保存渠道房型与本地房型的一对一关系';`,
  `COMMENT ON COLUMN ${tableName}.id IS '主键ID';`,
  `COMMENT ON COLUMN ${tableName}.platform IS 'OTA渠道平台标识，例如 meituan、ctrip、douyin';`,
  `COMMENT ON COLUMN ${tableName}.ota_room_type IS 'OTA房型标识或名称';`,
  `COMMENT ON COLUMN ${tableName}.local_room_type_id IS '本地房型ID，对应 rooms.room_type_id';`,
  `COMMENT ON COLUMN ${tableName}.created_at IS '记录创建时间';`,
  `COMMENT ON COLUMN ${tableName}.updated_at IS '记录更新时间';`
];

// 导出 OTA 房型映射表定义，供数据库初始化模块统一执行。
module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
  createCommentQueryStrings
};
