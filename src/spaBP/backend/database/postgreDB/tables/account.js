"use strict";
const tableName = "account"; // 定义数据库表名

// 定义表示账户数据结构的对象，主要用于示例或参考
const dataShape = {
  id: 1, // 用户ID, 通常是自增主键
  name: "youtao", // 用户名
  email: "wuyoutao19@qq.com", // 用户邮箱地址, 具有唯一性约束
  email_verified: true, // 邮箱是否已验证
  pw: "1219", // 存储加密后的用户密码
  created_at: new Date(), // 账户创建时间
};

// 创建账户表的 SQL 查询语句
// 如果表不存在则创建
const createQuery = `CREATE table if not exists ${tableName} \
(id serial PRIMARY KEY,          -- 自增主键ID
    name text,                   -- 用户名
    email text UNIQUE,           -- 邮箱地址，唯一
    email_verified boolean,      -- 邮箱是否验证
    created_at timestamptz,       -- 创建时间（带时区）
    pw text)                     -- 加密后的密码`;

// 删除账户表的 SQL 查询语句
const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

// 用于存储创建索引的 SQL 查询语句的数组
const createIndexQueryStrings = [];
// 创建邮箱字段索引的 SQL 查询语句，提高查询效率
const createEmailIndexQuery = `CREATE INDEX if not exists accountEmailIndex ON ${tableName} (email)`;
createIndexQueryStrings.push(createEmailIndexQuery); // 将创建邮箱索引的语句添加到数组中

// 导出的模块对象，包含表名、数据结构示例、创建/删除语句以及索引创建语句
const table = {
  tableName,
  dataShape,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
};
module.exports = table;