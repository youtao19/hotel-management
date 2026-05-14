"use strict";

const db = require("../../database/postgreDB/pg");
const account = require("../../database/postgreDB/tables/account");

function createAccount({ name, email, passwordHash }) {
  return db.query({
    text: `INSERT INTO ${account.tableName}(name,email,pw,created_at,email_verified) VALUES($1,$2,$3,$4,$5) RETURNING *`,
    values: [name, email, passwordHash, new Date(), false]
  });
}

function findAccountByEmail(email) {
  return db.query({
    text: `SELECT * FROM ${account.tableName} where email=$1`,
    values: [email]
  });
}

function findEmail(email) {
  return db.query({
    text: "SELECT email FROM account WHERE email=$1",
    values: [email]
  });
}

function markEmailVerified(email) {
  return db.query({
    text: `UPDATE ${account.tableName} SET email_verified=$1 WHERE email=$2`,
    values: [true, email]
  });
}

function updatePasswordByEmail({ email, passwordHash }) {
  return db.query({
    text: `UPDATE ${account.tableName} SET pw=$1 WHERE email=$2`,
    values: [passwordHash, email]
  });
}

function findAccountInfoById(accountId) {
  return db.query({
    text: `SELECT id, name, email, email_verified
           FROM ${account.tableName}
           WHERE id = $1`,
    values: [accountId]
  });
}

function findEmailVerifiedByAccountId(accountId) {
  return db.query({
    text: `SELECT email_verified FROM ${account.tableName} WHERE id = $1`,
    values: [accountId]
  });
}

module.exports = {
  createAccount,
  findAccountByEmail,
  findAccountInfoById,
  findEmail,
  findEmailVerifiedByAccountId,
  markEmailVerified,
  updatePasswordByEmail
};
