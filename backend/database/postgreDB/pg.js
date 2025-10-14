"use strict";
const postgre = require("pg");
const setup = require("../../appSettings/setup");
let pool = {};

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
  for (let query of createExtensionQueries) {
    await pool.query(query);
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

//table order here is important
//since we have foreign key reference other table
tables.push(account);
tables.push(bill);
tables.push(handover);
tables.push(order);
tables.push(review_invitation);
tables.push(room_type);
tables.push(room);

async function createTables() {
  for (let table of tables) {
    console.log(`create table : ${table.tableName}`);
    await pool.query(table.createQuery);
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
        await pool.query(indexQuery);
      }
    }
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
  await createIndex();
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
  initializePostgreDB,
  getClient,
  tearDownPostgreDB,
  createPool,
  closePool,
};
module.exports = db;
