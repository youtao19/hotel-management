"use strict";

// 通用 OTA 订单映射表名，用于维护 OTA 订单与本地逻辑订单的一对一关系。
const tableName = "ota_order_relation";

// 创建 OTA 订单映射表，保存外部订单与本地订单的映射，以及插件侧关键业务字段。
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    ota_order_id VARCHAR(100) NOT NULL,
    local_order_id VARCHAR(80) NOT NULL,
    ota_room_type VARCHAR(50),
    ota_guest_name VARCHAR(100),
    ota_check_in_date DATE,
    ota_check_out_date DATE,
    ota_total_price NUMERIC(10, 2),
    ota_order_status VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// 删除 OTA 订单映射表的 SQL，供测试环境重建数据库时使用。
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

// 映射表索引集合，分别用于唯一约束和按本地订单查询。
const createIndexQueryStrings = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_ota_order_relation_platform_order ON ${tableName} (platform, ota_order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ota_order_relation_local_order ON ${tableName} (local_order_id)`
];

// 映射表注释 SQL 集合，统一为表和关键字段补充数据库注释，方便后续排查与维护。
const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS 'OTA订单映射表：保存渠道订单与本地逻辑订单的一对一关系，以及插件侧关键业务字段';`,
  `COMMENT ON COLUMN ${tableName}.id IS '主键ID';`,
  `COMMENT ON COLUMN ${tableName}.platform IS 'OTA渠道平台标识，例如 meituan、ctrip、fliggy';`,
  `COMMENT ON COLUMN ${tableName}.ota_order_id IS 'OTA主订单号';`,
  `COMMENT ON COLUMN ${tableName}.local_order_id IS '本地逻辑订单号，对应 orders.order_id';`,
  `COMMENT ON COLUMN ${tableName}.ota_room_type IS '插件侧传入的房型标识或房型名称';`,
  `COMMENT ON COLUMN ${tableName}.ota_guest_name IS '插件侧传入的客人姓名';`,
  `COMMENT ON COLUMN ${tableName}.ota_check_in_date IS '插件侧传入的入住日期';`,
  `COMMENT ON COLUMN ${tableName}.ota_check_out_date IS '插件侧传入的离店日期';`,
  `COMMENT ON COLUMN ${tableName}.ota_total_price IS '插件侧传入的订单总费用';`,
  `COMMENT ON COLUMN ${tableName}.ota_order_status IS '插件侧订单状态';`,
  `COMMENT ON COLUMN ${tableName}.created_at IS '记录创建时间';`,
  `COMMENT ON COLUMN ${tableName}.updated_at IS '记录更新时间';`
];

// 导出 OTA 订单映射表定义，供数据库初始化模块统一执行。
module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
  createCommentQueryStrings
};
