"use strict";
const { Pool } = require("pg");
const setup = require("../../appSettings/setup");
const fs = require('fs');
const path = require('path');
const { getConfig } = require('./dbConfig');

// 数据库连接配置
// const dbConfig = {
//   user: setup.db.postgres.user,
//   password: setup.db.postgres.pw,
//   host: setup.db.postgres.host,
//   port: setup.db.postgres.port,
//   database: setup.db.postgres.name,
//   max: 20, // 连接池最大连接数
//   idleTimeoutMillis: 30000, // 连接最大空闲时间 30s
//   connectionTimeoutMillis: 10000 // 连接超时时间 10s
// };

const dbConfig = getConfig();

// 创建连接池实例
let pool = null;

/**
 * 初始化连接池
 */
function createPool() {
  if (!pool) {
    pool = new Pool(dbConfig);
    // 添加错误处理
    pool.on('error', (err, client) => {
      console.error('PostgreSQL连接池发生错误:', err);
    });

    console.log('PostgreSQL连接池已创建');
  }
  return pool;
}

/**
 * 执行SQL查询
 * @param {string} text - SQL语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 查询结果
 */
async function query(text, params) {
  if (!pool) createPool();
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  // 记录较慢的查询以便优化
  if (duration > 500) {
    console.log('慢查询:', { text, duration, rows: res.rowCount });
  }

  return res;
}

/**
 * 获取客户端连接
 * @returns {Promise<PoolClient>} 客户端连接
 */
async function getClient() {
  if (!pool) createPool();
  const client = await pool.connect();

  // 添加查询方法封装，方便记录和管理
  const originalQuery = client.query;
  client.query = async (text, params) => {
    try {
      return await originalQuery.call(client, text, params);
    } catch (err) {
      console.error('查询出错:', err.message);
      throw err;
    }
  };

  return client;
}

// 定义酒店系统需要的表
const tables = [
  require('./tables/account'),
  require('./tables/room_type'),
  require('./tables/room'),
  require('./tables/order'),
  require('./tables/bill'),
  require('./tables/review_invitation'),
  require('./tables/change_order'),
  require('./tables/handover'),
].filter(Boolean); // 确保只加载存在的表

/**
 * 创建所有数据库表
 */
async function createTables() {
  for (let table of tables) {
    if (table.createQuery) {
      console.log(`创建表: ${table.tableName}`);
      await query(table.createQuery);

      // 创建索引
      if (table.createIndexQueryStrings) {
        for (let indexQuery of table.createIndexQueryStrings) {
          await query(indexQuery);
        }
      }
    }
  }
}

/**
 * 启用数据库扩展
 */
async function enableExtensions() {
  const extensions = ["ltree", "pg_trgm"]; // 常用的PostgreSQL扩展

  for (let extension of extensions) {
    try {
      await query(`CREATE EXTENSION IF NOT EXISTS ${extension};`);
      console.log(`扩展 ${extension} 已启用`);
    } catch (err) {
      console.warn(`启用扩展 ${extension} 失败:`, err.message);
    }
  }
}


/**
 * 初始化酒店管理系统数据库
 */
async function initializeHotelDB() {
  try {
    createPool();

    // 1. 启用扩展
    await enableExtensions();

    // 2. 创建表结构
    await createTables();

    console.log('酒店管理系统数据库初始化完成');
    return true;
  } catch (err) {
    console.error('数据库初始化失败:', err);
    return false;
  }
}


/**
 * 关闭连接池
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('数据库连接池已关闭');
  }
}

// 导出数据库操作模块
module.exports = {
  query,           // 执行SQL查询
  getClient,       // 获取客户端连接
  createPool,      // 创建连接池
  initializeHotelDB, // 初始化数据库
  closePool,       // 关闭连接池
  pool             // 导出连接池实例
};
