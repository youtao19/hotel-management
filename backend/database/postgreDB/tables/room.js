// 房间数据表操作模块
"use strict";

// 表名常量
const tableName = "rooms";

// 创建表的SQL语句
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    room_id INT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
  );
`;

// 创建索引的SQL语句
const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_rooms_number ON ${tableName} (room_number);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_status ON ${tableName} (status);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_type ON ${tableName} (type_code);`
];

module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings
};
