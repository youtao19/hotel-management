"use strict";
const { Pool } = require("pg");
const setup = require("../../../appSettings/setup");
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
  require('./tables/shift_handover'),
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
 * 执行SQL脚本文件
 * @param {string} filePath - SQL文件路径
 */
// async function executeSqlFile(filePath) {
//   try {
//     console.log(`执行SQL文件: ${filePath}`);
//     const sqlContent = fs.readFileSync(filePath, 'utf8');

//     // 移除注释和将文件内容分割成单独的SQL语句
//     const cleanedSql = sqlContent
//       .replace(/--.*$/gm, '') // 移除单行注释
//       .replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释

//     // 按分号分割SQL语句
//     const statements = cleanedSql.split(';')
//       .map(stmt => stmt.trim())
//       .filter(stmt => stmt.length > 0 && !stmt.startsWith('\\'));

//     // 逐条执行SQL语句
//     for (let stmt of statements) {
//       // 跳过PostgreSQL特定命令
//       if (stmt.toLowerCase().includes('create database') ||
//           stmt.toLowerCase().includes('\\') ||
//           stmt.trim().startsWith('\\')) {
//         console.log('跳过不支持的命令:', stmt.substring(0, 50) + (stmt.length > 50 ? '...' : ''));
//         continue;
//       }

//       // console.log('执行SQL语句:', stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''));
//       try {
//         await query(stmt);
//       } catch (err) {
//         console.error(`执行语句出错: ${err.message}`);
//         // 判断是否应该继续执行
//         // 如果是关键的创建表语句失败了，可能需要中断整个过程
//         if (stmt.toLowerCase().includes('create table') && !stmt.toLowerCase().includes('if not exists')) {
//           throw err;
//         }
//       }
//     }

//     // console.log(`SQL文件 ${filePath} 执行完成`);
//   } catch (err) {
//     console.error(`执行SQL文件 ${filePath} 出错:`, err);
//     throw err;
//   }
// }

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
  closePool        // 关闭连接池
};
