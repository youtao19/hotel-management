"use strict";

const { query } = require("../../database/postgreDB/pg");

const MEMO_COLUMNS = "memo_id, memo_date, title, priority, completed, created_at, updated_at";
const UPDATE_FIELDS = ["title", "priority", "completed", "memo_date"];

async function findMemosByDate(memoDate) {
  const { rows } = await query(
    `
      SELECT ${MEMO_COLUMNS}
      FROM dashboard_memos
      WHERE memo_date = $1
      ORDER BY created_at ASC, memo_id ASC
    `,
    [memoDate]
  );
  return rows;
}

async function insertMemo({ memo_date, title, priority, completed }) {
  const { rows } = await query(
    `
      INSERT INTO dashboard_memos (memo_date, title, priority, completed)
      VALUES ($1, $2, $3, $4)
      RETURNING ${MEMO_COLUMNS}
    `,
    [memo_date, title, priority, completed]
  );
  return rows[0];
}

async function updateMemoById(memoId, updates = {}) {
  const setClauses = [];
  const values = [];
  let index = 1;

  Object.keys(updates).forEach((key) => {
    if (UPDATE_FIELDS.includes(key) && updates[key] !== undefined) {
      setClauses.push(`${key} = $${index}`);
      values.push(updates[key]);
      index += 1;
    }
  });

  if (setClauses.length === 0) {
    throw new Error("没有提供有效的更新字段");
  }

  setClauses.push("updated_at = NOW()");

  const { rows } = await query(
    `
      UPDATE dashboard_memos
      SET ${setClauses.join(", ")}
      WHERE memo_id = $${index}
      RETURNING ${MEMO_COLUMNS}
    `,
    [...values, memoId]
  );

  return rows.length > 0 ? rows[0] : null;
}

async function deleteMemoById(memoId) {
  const { rowCount } = await query(
    "DELETE FROM dashboard_memos WHERE memo_id = $1",
    [memoId]
  );
  return rowCount > 0;
}

module.exports = {
  deleteMemoById,
  findMemosByDate,
  insertMemo,
  updateMemoById
};
