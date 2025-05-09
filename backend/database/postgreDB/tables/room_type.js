// 房型数据表操作模块
"use strict";

// 表名常量
const tableName = "room_types";

// 创建表的SQL语句
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    type_code VARCHAR(20) PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_closed BOOLEAN NOT NULL DEFAULT false
  );
`;

// 创建索引的SQL语句
const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_room_types_name ON ${tableName} (type_name);`
];

// 导出表定义
module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings
};
