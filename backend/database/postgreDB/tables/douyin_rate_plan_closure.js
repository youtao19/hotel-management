"use strict";

const tableName = 'douyin_rate_plan_closures';
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    rate_plan_id INTEGER NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rate_plan_id, stay_date)
  )
`;

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '抖音套餐按房晚主动关房记录；命中时可订检查返回错误码18';`,
  `COMMENT ON COLUMN ${tableName}.stay_date IS '主动关房的入住自然日，按 YYYY-MM-DD 使用';`
];

module.exports = { tableName, createQuery, createCommentQueryStrings, dropQuery: `DROP TABLE IF EXISTS ${tableName}` };
