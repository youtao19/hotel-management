"use strict";

// 表名常量
const tableName = "rate_plans";

// 创建表的SQL语句
const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,       -- 如：高级大床房-双早
    base_price INTEGER NOT NULL,      -- 本地基础价
    status INTEGER DEFAULT 1)`;


// 创建索引的SQL语句

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const table = {
    tableName,
    createQuery,
    dropQuery
  }

module.exports = table;
