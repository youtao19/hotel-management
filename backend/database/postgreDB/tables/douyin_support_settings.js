"use strict";

/** 抖音支持设置表名。 */
const tableName = 'douyin_support_settings';

/** 创建抖音支持设置单例表。 */
const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  auto_confirm_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

/** 删除抖音支持设置表。 */
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

/** 创建抖音支持设置字段注释。 */
const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音系统支持设置，固定单例记录 id=1';`,
  `COMMENT ON COLUMN ${tableName}.auto_confirm_enabled IS '是否自动确认 biz_type=2012 预约订单；关闭后由员工在预约订单列表手动接单或拒单';`,
  `COMMENT ON COLUMN ${tableName}.updated_by IS '最后修改设置的员工账号ID';`,
  `COMMENT ON COLUMN ${tableName}.updated_at IS '最后修改设置的时间，由数据库时区处理';`
];

module.exports = {
  tableName,
  createQuery,
  dropQuery,
  createCommentQueryStrings
};
