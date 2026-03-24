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
const ota_order_relation = require("./tables/ota_order_relation");
const ota_roomType_relation = require("./tables/ota_roomType_relation");
const plugin_room_type_mapping = require("./tables/plugin_room_type_mapping");
const douyin_presale_order = require("./tables/douyin_presale_order");

//table order here is important
//since we have foreign key reference other table
tables.push(room_type);
tables.push(room);
tables.push(order);
tables.push(bill);
tables.push(ota_order_relation);
tables.push(ota_roomType_relation);
tables.push(plugin_room_type_mapping);
tables.push(douyin_presale_order);
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
    await pool.query(`ALTER TABLE ota_order_relation DROP COLUMN IF EXISTS latest_payload;`);
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
  // 抖音回写的是业务订单号 orders.order_id，历史上误建为 bigint 会导致同步状态回写失败。
  try {
    await pool.query(`
      ALTER TABLE douyin_orders
      ALTER COLUMN system_order_id TYPE VARCHAR(64)
      USING system_order_id::VARCHAR;
    `);
  } catch (err) {
    // 老库未创建 douyin_orders 或字段已正确时都允许跳过。
    console.warn('[initializePostgreDB] douyin_orders.system_order_id 字段升级跳过:', err.message);
  }
  // 抖音创单链路逐步对齐官方字段，老库需要幂等补齐关键列。
  try {
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS source_order_id VARCHAR(64);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS hotel_id VARCHAR(64);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS contact_name VARCHAR(128);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS contact_mobile VARCHAR(128);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS number_of_guests INTEGER;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS amount_before_tax DECIMAL(12, 2);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS rate_plan_id VARCHAR(64);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS biz_type INTEGER;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS remark_from_douyin TEXT;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS remark_from_guest TEXT;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS daily_rates JSONB;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS occupancies JSONB;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS member_info JSONB;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS douyin_log_id VARCHAR(128);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_id VARCHAR(64);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_type INTEGER;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS need_audit BOOLEAN;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS after_sale_type INTEGER;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS refund_type INTEGER;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12, 2);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS user_refund_amount DECIMAL(12, 2);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(12, 2);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_order_time VARCHAR(19);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS refund_order_detail JSONB;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_status VARCHAR(32);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_deadline VARCHAR(19);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_result INTEGER;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_reason TEXT;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_status VARCHAR(32);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_response JSONB;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_sent_at TIMESTAMP;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS cancel_audit_retry_count INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(32);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS fulfillment_action VARCHAR(32);`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS fulfillment_response JSONB;`);
    await pool.query(`ALTER TABLE douyin_orders ADD COLUMN IF NOT EXISTS fulfillment_sent_at TIMESTAMP;`);
  } catch (err) {
    // 老库未创建 douyin_orders 时允许跳过。
    console.warn('[initializePostgreDB] douyin_orders 创单字段升级跳过:', err.message);
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
