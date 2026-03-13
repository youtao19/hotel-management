"use strict";
const postgre = require("pg");
const setup = require("../../appSettings/setup");
let pool = {};

// 设置日期类型解析器，保持日期为字符串格式，避免时区转换问题
// OID 1082 = DATE 类型
postgre.types.setTypeParser(1082, (val) => val);  // 保持 DATE 为原始字符串 YYYY-MM-DD

const connOpt1 = {
  user: setup.db.postgres.user,
  database: "postgres",
  password: setup.db.postgres.pw,
  port: setup.db.postgres.port,
  host: setup.db.postgres.host,
  // 扩展属性
  max: 30, // 连接池最大连接数
  idleTimeoutMillis: 5000, // 连接最大空闲时间 5s
};

const testconnOpt1 = {
  user: setup.db.postgres.user,
  database: setup.db.postgres.test_name,
  password: setup.db.postgres.pw,
  port: setup.db.postgres.port,
  host: setup.db.postgres.host,
};

const connOpt2 = { ...connOpt1 };
connOpt2.database = setup.db.postgres.name;

const testconnOpt2 = { ...testconnOpt1 };
testconnOpt2.database = setup.db.postgres.test_name;

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function connect(){
  const client = await pool.connect();
  return client;
}

async function getClient() {
  const client = await pool.connect();
  //in dev mode, we check to see if there is any client leak
  //this should be disabled in production
  //since sensitive data could leak through the log
  if (process.env.NODE_ENV === "dev") {
    const query = client.query;
    const release = client.release;
    // set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
      console.error("A client has been checked out for more than 5 seconds!");
      console.error(
        `The last executed query on this client was: ${client.lastQuery}`
      );
    }, 5000);
    // monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };
    client.release = () => {
      // clear our timeout
      clearTimeout(timeout);
      // set the methods back to their old un-monkey-patched version
      client.query = query;
      client.release = release;
      return release.apply(client);
    };
  }
  return client;
}
//createPool function is used when the postgres is running inside docker
//if you install postgres natively inside os
//use createDatabase
function createPool() {
  console.log("当前环境是:",process.env.NODE_ENV)
  if(process.env.NODE_ENV === "test"){
    pool = new postgre.Pool(testconnOpt2)
  } else{
    pool = new postgre.Pool(connOpt2);
  }
}

//this createDatabase is deprecated
async function createDatabase() {
  const query = {
    text: "select pg_database.datname from pg_database where pg_database.datname=$1",
    values: [connOpt2.database],
  };
  const posgrePool = new postgre.Pool(connOpt1);
  const dbFound = await posgrePool.query(query.text, query.values);
  if (dbFound.rowCount === 0) {
    //this means we need to create app database now
    const createDBQuery = {
      text: "create database " + connOpt2.database,
    };
    const createResult = await posgrePool.query(createDBQuery.text);
  }

  await posgrePool.end();
  pool = new postgre.Pool(connOpt2);
}

const extentions = ["ltree", "pg_trgm"];
const createExtensionQueries = extentions.map((extension) => {
  return `CREATE EXTENSION IF NOT EXISTS ${extension};`;
});
async function enableExtensions() {
  if (process.env.NODE_ENV === 'test') {
    console.warn('Skipping Postgres extensions in test environment');
    return;
  }
  for (let query of createExtensionQueries) {
    try {
      await pool.query(query);
    } catch (err) {
      console.warn(`跳过扩展 ${query}:`, err.message);
    }
  }
}

const tables = [];
const account = require("./tables/account.js");
const bill = require("./tables/bill");
const handover = require("./tables/handover");
const order = require("./tables/order");
const review_invitation = require("./tables/review_invitation");
const room_type = require("./tables/room_type");
const room = require("./tables/room");
const order_change = require("./tables/change_order");
const dashboard_memo = require("./tables/dashboard_memo");
const douyin_account_config = require("./tables/douyin_account_config");
const douyin_room_mapping = require("./tables/douyin_room_mapping");
const douyin_order = require("./tables/douyin_order");
const douyin_order_event = require("./tables/douyin_order_event");
const douyin_outbox = require("./tables/douyin_outbox");
const ota_order_relation = require("./tables/ota_order_relation");
const ota_roomType_relation = require("./tables/ota_roomType_relation");

//table order here is important
//since we have foreign key reference other table
tables.push(room_type);
tables.push(room);
tables.push(order);
tables.push(bill);
tables.push(douyin_account_config);
tables.push(douyin_room_mapping);
tables.push(douyin_order);
tables.push(douyin_order_event);
tables.push(douyin_outbox);
tables.push(ota_order_relation);
tables.push(ota_roomType_relation);
tables.push(handover);
tables.push(dashboard_memo);
tables.push(review_invitation);
tables.push(account);
tables.push(order_change);

async function createTables() {
  for (let table of tables) {
    console.log(`create table : ${table.tableName}`);
    try {
      await pool.query(table.createQuery);
    } catch (err) {
      console.error(`创建表 ${table.tableName} 失败:`, err);
      throw err;
    }
  }
}

async function dropTables() {
  for (let table of tables) {
    await pool.query(table.dropQuery);
  }
}

async function createIndex() {
  for (let table of tables) {
    if (table.createIndexQueryStrings) {
      for (let indexQuery of table.createIndexQueryStrings) {
        try {
          await pool.query(indexQuery);
        } catch (err) {
          if (err.code === '42P07' || err.code === '23505') {
            console.warn('[createIndex] 索引已存在，跳过:', err.message);
            continue;
          }
          throw err;
        }
      }
    }
  }
}

async function createComments() {
  for (let table of tables) {
    if (table.createCommentQueryStrings) {
      for (let commentQuery of table.createCommentQueryStrings) {
        await pool.query(commentQuery);
      }
    }
  }
}

async function optimizeOtaTables() {
  try {
    await pool.query(`DROP INDEX IF EXISTS uniq_ota_order_relation_platform_order;`);
    await pool.query(`DROP INDEX IF EXISTS idx_ota_order_relation_local_order;`);
    await pool.query(`DROP INDEX IF EXISTS idx_ota_order_relation_status;`);
    await pool.query(`ALTER TABLE ota_order_relation ADD COLUMN IF NOT EXISTS ota_room_type VARCHAR(50);`);
    await pool.query(`ALTER TABLE ota_order_relation ADD COLUMN IF NOT EXISTS ota_guest_name VARCHAR(100);`);
    await pool.query(`ALTER TABLE ota_order_relation ADD COLUMN IF NOT EXISTS ota_check_in_date DATE;`);
    await pool.query(`ALTER TABLE ota_order_relation ADD COLUMN IF NOT EXISTS ota_check_out_date DATE;`);
    await pool.query(`ALTER TABLE ota_order_relation ADD COLUMN IF NOT EXISTS ota_total_price NUMERIC(10,2);`);
    await pool.query(`ALTER TABLE ota_order_relation ADD COLUMN IF NOT EXISTS ota_order_status VARCHAR(30);`);
      await pool.query(`
      ALTER TABLE ota_order_relation
      DROP COLUMN IF EXISTS channel_account_id,
      DROP COLUMN IF EXISTS ota_sub_order_id,
      DROP COLUMN IF EXISTS order_source,
      DROP COLUMN IF EXISTS current_order_status,
      DROP COLUMN IF EXISTS current_pay_status,
      DROP COLUMN IF EXISTS current_cancel_status,
      DROP COLUMN IF EXISTS first_request_at,
      DROP COLUMN IF EXISTS last_request_at;
    `);
    await pool.query(`DROP INDEX IF EXISTS idx_ota_order_relation_status;`);
  } catch (err) {
    console.warn('[initializePostgreDB] ota_order_relation 精简跳过:', err.message);
  }
}

async function tearDownPostgreDB() {
  createPool();
  //await createDatabase();
  await dropTables();
  await pool.end();
}

async function initializePostgreDB() {
  //await createDatabase();
  createPool();
  // await dropTables();
  await enableExtensions();
  await createTables();
  // schema 修复：历史上 bills.room_number 为 VARCHAR(10)，会导致测试用的 TEST_ROOM_101 写入失败。
  // 这里做一次幂等升级，避免因为 CREATE TABLE IF NOT EXISTS 而保留旧字段长度。
  try {
    await pool.query(`ALTER TABLE bills ALTER COLUMN room_number TYPE VARCHAR(20);`);
  } catch (err) {
    // 如果表不存在或字段不可变更，保留原错误信息用于排查；正常情况下不会触发。
    console.warn('[initializePostgreDB] bills.room_number 字段升级跳过:', err.message);
  }
  // 抖音 SDK 直连需要 account_id、hotel_id 两个业务标识，这里做幂等补列。
  try {
    await pool.query(`ALTER TABLE douyin_account_config ADD COLUMN IF NOT EXISTS account_id VARCHAR(100);`);
    await pool.query(`ALTER TABLE douyin_account_config ADD COLUMN IF NOT EXISTS hotel_id VARCHAR(100);`);
  } catch (err) {
    console.warn('[initializePostgreDB] douyin_account_config 字段升级跳过:', err.message);
  }
  await optimizeOtaTables();
  await createIndex();
  await createComments();
}

async function initializeHotelDB() {
  await initializePostgreDB();
}


// only used in test
async function closePool() {
  if (pool && pool.end) {
    await pool.end();
  }
}

const db = {
  query,
  connect,
  initializeHotelDB,
  initializePostgreDB,
  getClient,
  tearDownPostgreDB,
  createPool,
  closePool,
};
module.exports = db;
