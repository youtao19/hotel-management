"use strict";
const postgre = require("pg"); // 引入 'pg' 模块，用于与 PostgreSQL 数据库交互
const setup = require("../../../appSettings/setup"); // 引入应用设置，包含数据库配置等
let pool = {}; // 初始化一个空对象，稍后将用于存储数据库连接池实例

// 连接选项对象 1: 用于连接到默认的 'postgres' 数据库，通常用于检查或创建目标数据库
const connOpt1 = {
  user: setup.db.postgres.user, // 数据库用户名
  database: "hotel_management", // 目标数据库名 (此处为 'postgres')
  password: setup.db.postgres.pw, // 数据库密码
  port: setup.db.postgres.port, // 数据库端口
  host: setup.db.postgres.host, // 数据库主机地址
  // 扩展属性
  max: 30, // 连接池最大连接数
  idleTimeoutMillis: 5000, // 连接在池中保持空闲的最长时间（毫秒）
};

// 连接选项对象 2: 基于 connOpt1，但指定了应用所需的数据库名称
const connOpt2 = { ...connOpt1 }; // 复制 connOpt1 的所有属性
connOpt2.database = setup.db.postgres.name; // 设置为应用特定的数据库名称

/**
 * 执行 SQL 查询的异步函数
 * @param {string} text SQL 查询语句字符串
 * @param {Array} [params] 查询参数数组 (可选, 用于防止 SQL 注入)
 * @returns {Promise<QueryResult>} 查询结果
 */
async function query(text, params) {
  const start = Date.now(); // 记录查询开始时间
  try {
    const res = await pool.query(text, params); // 使用连接池执行查询
    const duration = Date.now() - start; // 计算查询耗时
    // console.log('executed query', { text, duration: `${duration}ms`, rows: res.rowCount }); // 可以取消注释以记录查询信息
    return res; // 返回查询结果
  } catch (error) {
    console.error('数据库查询出错:', { text, params, error });
    throw error; // 重新抛出错误，以便上层调用者处理
  }
}

/**
 * 从连接池获取一个客户端连接的异步函数
 * @returns {Promise<PoolClient>} 客户端连接实例
 */
async function connect(){
  try {
    const client = await pool.connect(); // 从池中获取一个客户端
    return client; // 返回客户端实例
  } catch (error) {
    console.error('获取数据库连接出错:', error);
    throw error;
  }
}

/**
 * 获取一个客户端连接，并在开发模式下添加调试逻辑以检测连接泄漏
 * @returns {Promise<PoolClient>} 客户端连接实例
 */
async function getClient() {
  const client = await pool.connect(); // 从池中获取一个客户端

  // 在开发模式下，检查客户端是否被占用过久 (可能表示连接未正确释放)
  // 注意：这不应在生产环境中使用，因为日志可能包含敏感信息
  // 使用 process.env.NODE_ENV 判断环境更标准
  if (process.env.NODE_ENV === "development") {
    const originalQuery = client.query;
    const originalRelease = client.release;
    let lastQueryArgs = null; // 用于存储最后一次查询的参数

    // 设置一个 5 秒的超时计时器
    const timeout = setTimeout(() => {
      console.error("警告: 一个数据库客户端已被签出超过 5 秒!");
      console.error(
        `此客户端上最后执行的查询可能是: ${JSON.stringify(lastQueryArgs)}` // 打印最后记录的查询参数
      );
    }, 5000);

    // 修改 (monkey patch) query 方法以记录最后执行的查询
    client.query = (...args) => {
      lastQueryArgs = args; // 记录查询参数
      return originalQuery.apply(client, args); // 执行原始的 query 方法
    };

    // 修改 (monkey patch) release 方法以在释放连接时清除超时计时器并恢复原始方法
    client.release = (err) => { // release 方法可能接收一个错误参数
      // 清除超时计时器
      clearTimeout(timeout);
      // 恢复原始的 query 和 release 方法
      client.query = originalQuery;
      client.release = originalRelease;
      // 调用原始的 release 方法释放连接
      return originalRelease.call(client, err);
    };
  }
  return client; // 返回客户端实例
}

/**
 * 创建数据库连接池 (主要用于 PostgreSQL 在 Docker 中运行的场景)
 * 如果 PostgreSQL 是原生安装在操作系统中，则可能需要使用 createDatabase (虽然它已被标记为弃用)
 */
function createPool() {
  if (pool && pool.totalCount > 0) {
    console.log("连接池已存在，无需重复创建。");
    return;
  }
  try {
    pool = new postgre.Pool(connOpt2); // 使用 connOpt2 (连接到应用数据库) 创建连接池
    console.log(`数据库连接池已创建，目标数据库: ${connOpt2.database}, 最大连接数: ${connOpt2.max}`);

    // 监听连接池错误事件
    pool.on('error', (err, client) => {
      console.error('数据库连接池发生未预期的错误:', err);
      // process.exit(-1); // 考虑在严重错误时退出进程
    });

  } catch (error) {
    console.error("创建数据库连接池失败:", error);
    throw error;
  }
}

/**
 * [已弃用] 创建应用数据库的函数 (如果尚不存在)
 * 注意：此函数已被标记为弃用，推荐使用 createPool。
 *       现代应用通常期望数据库已由 DBA 或迁移脚本创建好。
 */
async function createDatabase() {
  console.warn("警告：createDatabase 函数已被弃用。请确保数据库已预先创建。");
  let tempPool;
  try {
    // 使用 connOpt1 (连接到 'postgres' 数据库) 创建临时连接池
    tempPool = new postgre.Pool(connOpt1);
    const checkDbQuery = {
      text: "SELECT 1 FROM pg_database WHERE datname = $1",
      values: [connOpt2.database],
    };
    const dbFound = await tempPool.query(checkDbQuery);

    if (dbFound.rowCount === 0) {
      // 如果数据库不存在，则创建它
      console.log(`数据库 '${connOpt2.database}' 不存在，正在尝试创建...`);
      const createDBQuery = `CREATE DATABASE "${connOpt2.database}"`; // 使用双引号以支持特殊字符的数据库名
      await tempPool.query(createDBQuery);
      console.log(`数据库 '${connOpt2.database}' 创建成功。`);
    } else {
      console.log(`数据库 '${connOpt2.database}' 已存在。`);
    }
  } catch (error) {
     console.error(`处理数据库 '${connOpt2.database}' 时出错:`, error);
     throw error;
  } finally {
    if (tempPool) {
      await tempPool.end(); // 确保关闭临时连接池
    }
  }
  // 弃用此函数后，不再在此处创建主连接池
  // createPool(); // 调用 createPool 来创建主连接池
}

// 需要启用的 PostgreSQL 扩展列表
const extensions = ["ltree", "pg_trgm"]; // ltree 用于处理层级数据，pg_trgm 用于进行模糊字符串匹配
// 生成创建扩展的 SQL 语句数组 (如果扩展不存在则创建)
const createExtensionQueries = extensions.map((extension) => {
  // 使用双引号确保扩展名正确处理，即使包含特殊字符
  return `CREATE EXTENSION IF NOT EXISTS "${extension}";`;
});

/**
 * 启用所有必要的数据库扩展
 */
async function enableExtensions() {
  console.log("正在启用数据库扩展...");
  for (const queryText of createExtensionQueries) {
    try {
      await query(queryText); // 使用封装的 query 函数执行
      console.log(`执行: ${queryText} - 成功`);
    } catch (error) {
      // 忽略 "already exists" 错误，但记录其他错误
      if (!error.message.includes('already exists')) {
          console.error(`执行: ${queryText} - 失败: ${error.message}`);
      } else {
          console.log(`执行: ${queryText} - 已存在`);
      }
    }
  }
  console.log("数据库扩展启用完成。");
}

// ----- 表管理 -----
// 用于存储所有表定义的数组
const tables = [];
const accountTable = require("./tables/account.js"); // 引入账户表的定义
// 注意：表定义的添加顺序可能很重要，特别是当存在外键约束时
tables.push(accountTable);
// 如果有其他表定义，可以在这里继续引入和 push
// const otherTable = require("./tables/otherTable.js");
// tables.push(otherTable);

/**
 * 遍历 tables 数组，执行每个表的创建语句
 */
async function createTables() {
  console.log("正在创建数据库表...");
  for (const table of tables) {
    console.log(`尝试创建表: ${table.tableName}`);
    try {
      await query(table.createQuery); // 使用封装的 query 函数执行
      console.log(`表 '${table.tableName}' 创建成功或已存在。`);
    } catch (error) {
      console.error(`创建表 '${table.tableName}' 失败: ${error.message}`);
      // 考虑是否在表创建失败时抛出错误或继续执行
    }
  }
  console.log("数据库表创建完成。");
}

/**
 * 遍历 tables 数组，执行每个表的删除语句 (通常用于测试或重置环境)
 */
async function dropTables() {
  console.log("正在删除数据库表...");
  // 从后往前删除，以减少外键约束问题
  for (let i = tables.length - 1; i >= 0; i--) {
    const table = tables[i];
    console.log(`尝试删除表: ${table.tableName}`);
    try {
      await query(table.dropQuery); // 使用封装的 query 函数执行
      console.log(`表 '${table.tableName}' 删除成功。`);
    } catch (error) {
      console.error(`删除表 '${table.tableName}' 失败: ${error.message}`);
    }
  }
  console.log("数据库表删除完成。");
}

/**
 * 遍历 tables 数组，执行每个表定义的索引创建语句
 */
async function createIndex() {
  console.log("正在创建数据库索引...");
  for (const table of tables) {
    if (table.createIndexQueryStrings && table.createIndexQueryStrings.length > 0) {
      console.log(`为表 '${table.tableName}' 创建索引...`);
      for (const indexQuery of table.createIndexQueryStrings) {
        try {
          await query(indexQuery); // 使用封装的 query 函数执行
          console.log(`执行索引查询: ${indexQuery} - 成功`);
        } catch (error) {
           // 忽略 "already exists" 错误
           if (!error.message.includes('already exists')) {
               console.error(`执行索引查询: ${indexQuery} - 失败: ${error.message}`);
           } else {
               console.log(`执行索引查询: ${indexQuery} - 已存在`);
           }
        }
      }
    } else {
      // console.log(`表 '${table.tableName}' 没有需要创建的索引。`);
    }
  }
  console.log("数据库索引创建完成。");
}

// ----- 初始化与拆卸 -----

/**
 * 拆卸数据库：创建连接池，删除所有表，然后关闭连接池 (主要用于测试环境)
 */
async function tearDownPostgreDB() {
  console.log("开始拆卸 PostgreSQL 数据库...");
  try {
    createPool(); // 确保连接池已创建 (如果尚未创建)
    if (!pool.query) {
        console.warn("连接池无效，无法执行删除表操作。")
        return;
    }
    await dropTables(); // 删除所有定义的表
  } catch(error){
    console.error("拆卸数据库过程中发生错误:", error);
  } finally {
    if (pool && pool.end) {
      await pool.end(); // 关闭连接池，释放所有连接
      pool = {}; // 重置 pool 变量
      console.log("数据库连接池已关闭。");
    }
    console.log("PostgreSQL 数据库拆卸完成。");
  }
}

/**
 * 初始化数据库：创建连接池，启用扩展，创建表，创建索引
 */
async function initializePostgreDB() {
  console.log("开始初始化 PostgreSQL 数据库...");
  try {
    // 弃用: await createDatabase(); // 如果需要确保数据库存在，取消此行注释 (但 createPool 通常已足够)
    createPool(); // 创建连接池
    if (!pool.query) {
        console.error("连接池创建失败，无法继续初始化。");
        return; // 或者抛出错误
    }
    // 弃用: await dropTables(); // 通常不在初始化时删除表，除非需要完全重置
    await enableExtensions(); // 启用必要的扩展
    await createTables(); // 创建所有定义的表
    await createIndex(); // 创建所有定义的索引
    console.log("PostgreSQL 数据库初始化完成。");
  } catch (error) {
    console.error("数据库初始化过程中发生错误:", error);
    // 根据需要决定是否重新抛出错误
  }
}

// 导出的数据库操作对象
const db = {
  query, // 执行 SQL 查询
  connect, // 获取一个客户端连接 (无调试逻辑)
  initializePostgreDB, // 初始化数据库 (建池、建扩展、建表、建索引)
  getClient, // 获取一个客户端连接 (开发模式下带泄漏检测)
  tearDownPostgreDB, // 拆卸数据库 (建池、删表、关池)
  createPool, // 仅创建连接池
  // 添加对连接池本身的引用可能有用，例如用于直接监听事件或获取状态
  // pool: () => pool // 使用函数返回以避免直接暴露可修改的 pool 变量
};

module.exports = db; // 导出 db 对象供其他模块使用