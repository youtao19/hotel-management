"use strict";

const tableName = "order_changes";

const createQuery = `
	CREATE TABLE IF NOT EXISTS ${tableName} (
		change_id SERIAL PRIMARY KEY, -- 变更ID
		order_id VARCHAR(50) NOT NULL, -- 订单ID
		changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(), -- 变更时间
		changed_by VARCHAR(50), -- 变更人
		changes JSONB, -- 变更内容
		reason TEXT -- 变更原因
		-- 注意：移除了 order_id 外键约束，因为多日分行结构中 order_id 不再是唯一的
	);
`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
	`CREATE INDEX IF NOT EXISTS idx_order_changes_order_id ON ${tableName}(order_id)` ,
	`CREATE INDEX IF NOT EXISTS idx_order_changes_changed_at ON ${tableName}(changed_at)`
];

const table = {
	tableName,
	createQuery,
	dropQuery,
	createIndexQueryStrings
};

module.exports = table;
