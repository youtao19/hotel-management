"use strict";
const tableName = "account";
const dataShape = {
  id: 1, //serial primary key
  name: "dev", //unique text type
  email: "sth@sth.com", //unique text type
  email_verified: true, //boolean
  pw: "hashedpw", //hashed pw text type
  created_at: new Date(), //date
};

//"create table if not exists failReason (id serial PRIMARY KEY,reason text,company_id text,isdel boolean)"
const createQuery = `CREATE table if not exists ${tableName} \
(id serial PRIMARY KEY,
    name text,
    email text UNIQUE,
    email_verified boolean,
    created_at timestamptz,\
    pw text\)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [];
const createEmailIndexQuery = `CREATE INDEX if not exists accountEmailIndex ON ${tableName} (email)`;
createIndexQueryStrings.push(createEmailIndexQuery);

const table = {
  tableName,
  dataShape,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
};
module.exports = table;
