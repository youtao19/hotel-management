"use strict";

const tableName = "handover";

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id SERIAL PRIMARY KEY,                -- 主键，自增
  date DATE NOT NULL,                   -- 交接日期
  handover_person VARCHAR(50) NOT NULL, -- 交班人
  takeover_person VARCHAR(50) NOT NULL, -- 接班人
  vip_card INT DEFAULT 0,               -- VIP 卡数量

  payment_type SMALLINT NOT NULL,       -- 1=现金, 2=微信, 3=微邮付, 4=其他
  reserve_cash NUMERIC(10,2) DEFAULT 0, -- 备用金
  room_income NUMERIC(10,2) DEFAULT 0,  -- 客房收入
  rest_income NUMERIC(10,2) DEFAULT 0,  -- 休息房收入
  rent_income NUMERIC(10,2) DEFAULT 0,  -- 租车收入
  total_income NUMERIC(10,2) DEFAULT 0, -- 合计
  room_refund NUMERIC(10,2) DEFAULT 0,  -- 客房退押
  rest_refund NUMERIC(10,2) DEFAULT 0,  -- 休息房退押
  retained NUMERIC(10,2) DEFAULT 0,     -- 留存款
  handover NUMERIC(10,2) DEFAULT 0,     -- 交接款

  task_list JSONB DEFAULT '[]'::jsonb,  -- 备忘录（JSON数组，更灵活）
  remarks TEXT                          -- 备注信息
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_handover_date ON ${tableName}(date)`,
];

const table = {
  tableName,
  createQuery,
  dropQuery,
  createIndexQueryStrings
}

module.exports = table;
