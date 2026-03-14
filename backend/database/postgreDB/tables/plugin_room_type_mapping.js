"use strict";

/**
 * 插件房型映射表名。
 * 用于保存插件平台房型与本地房型编码的映射关系。
 */
const tableName = "plugin_room_type_mapping";

/**
 * 创建插件房型映射表的 SQL。
 * platform + ota_room_type 在同一平台下必须唯一，避免重复映射。
 */
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    ota_room_type VARCHAR(100) NOT NULL,
    local_room_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_plugin_room_type_mapping_local_room_type
      FOREIGN KEY (local_room_type) REFERENCES room_types(type_code)
  );
`;

/**
 * 删除插件房型映射表的 SQL。
 * 供测试环境或重建数据库结构时使用。
 */
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

/**
 * 插件房型映射表索引集合。
 * 唯一索引用于保证同一平台下 OTA 房型不重复映射。
 */
const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_plugin_room_type_mapping_platform_ota_room
     ON ${tableName} (platform, ota_room_type)`,
  `CREATE INDEX IF NOT EXISTS idx_plugin_room_type_mapping_local_room_type
     ON ${tableName} (local_room_type)`
];

/**
 * 插件房型映射表及字段注释 SQL 集合。
 * 用于补充数据库结构说明，便于维护和排查。
 */
const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '插件房型映射表：保存插件平台房型与本地房型编码的对应关系';`,
  `COMMENT ON COLUMN ${tableName}.id IS '主键ID';`,
  `COMMENT ON COLUMN ${tableName}.platform IS '插件平台标识，例如 meituan、ctrip、douyin';`,
  `COMMENT ON COLUMN ${tableName}.ota_room_type IS '插件侧房型标识或房型名称';`,
  `COMMENT ON COLUMN ${tableName}.local_room_type IS '本地房型编码，对应 room_types.type_code';`,
  `COMMENT ON COLUMN ${tableName}.created_at IS '记录创建时间';`,
  `COMMENT ON COLUMN ${tableName}.updated_at IS '记录更新时间';`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
  createCommentQueryStrings
};
