"use strict";

const tableName = "ota_channel_mappings";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
id SERIAL PRIMARY KEY,

    -- 1. 认亲：这是本地的哪个东西？
    local_target_type VARCHAR(50) NOT NULL,  -- 枚举值: 'ROOM' (物理房型) 或 'RATE_PLAN' (售卖套餐)
    local_target_id INTEGER NOT NULL,        -- 对应的本地 ID (rooms.id 或 rate_plans.id)

    -- 2. 去哪：推给哪个平台？
    channel_code VARCHAR(50) NOT NULL,       -- 枚举值: 'DOUYIN', 'MEITUAN', 'CTRIP'

    -- 3. 对方管它叫什么？
    channel_item_id VARCHAR(100) NOT NULL,   -- 对方平台返回的 ID (如抖音的 rate_plan_id)

    -- 4. 平台专属配置（高阶技巧：用 JSONB 存储各个平台的奇葩规则）
    -- 比如：抖音要求传 sales_type，但美团可能不需要，统统塞进 JSON 里，表结构永远不膨胀
    channel_config JSONB DEFAULT '{}',

    -- 状态与时间戳
    sync_status INTEGER DEFAULT 1,           -- 1: 同步成功, 0: 待同步, -1: 失败下架
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- 联合唯一索引：同一个本地套餐，在同一个渠道，只能有一个映射
    UNIQUE (local_target_type, local_target_id, channel_code))`;


    const createCommentQueryStrings = [
        `COMMENT ON TABLE ${tableName} IS '全渠道资源映射表：维护本地资源与各OTA渠道资源的一对一映射关系，以及平台专属配置';`,
        `COMMENT ON COLUMN ${tableName}.local_target_type IS '本地资源类型，枚举值: ROOM（物理房型）或 RATE_PLAN（售卖套餐）';`,
        `COMMENT ON COLUMN ${tableName}.channel_config IS '存放特定平台的配置参数(JSON格式)';`
      ]


const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const schemaUpdateQueryStrings = [
    `ALTER TABLE ${tableName} ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone')`,
    `ALTER TABLE ${tableName} ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE current_setting('TimeZone')`
];

const table = {
    tableName,
    createQuery,
    createCommentQueryStrings,
    dropQuery,
    schemaUpdateQueryStrings
  }

module.exports = table;
