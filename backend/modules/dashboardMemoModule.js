"use strict";
const { query } = require("../database/postgreDB/pg");

/**
 * 获取指定日期的备忘录列表
 * @param {string} memoDate - 日期字符串 YYYY-MM-DD
 * @returns {Promise<Array>} 备忘录数组
 */
async function getMemosByDate(memoDate) {
  const { rows } = await query(
    `
      SELECT memo_id, memo_date, title, priority, completed, created_at, updated_at
      FROM dashboard_memos
      WHERE memo_date = $1
      ORDER BY created_at ASC, memo_id ASC
    `,
    [memoDate]
  );
  return rows;
}

/**
 * 创建新的备忘录
 * @param {Object} memo
 * @param {string} memo.memo_date - 日期 YYYY-MM-DD
 * @param {string} memo.title - 内容
 * @param {string} [memo.priority] - 优先级
 * @param {boolean} [memo.completed] - 是否完成
 * @returns {Promise<Object>} 创建后的备忘录
 */
async function createMemo({ memo_date, title, priority = "medium", completed = false }) {
  const { rows } = await query(
    `
      INSERT INTO dashboard_memos (memo_date, title, priority, completed)
      VALUES ($1, $2, $3, $4)
      RETURNING memo_id, memo_date, title, priority, completed, created_at, updated_at
    `,
    [memo_date, title, priority, completed]
  );
  return rows[0];
}

/**
 * 更新备忘录
 * @param {number} memoId - 备忘录ID
 * @param {Object} updates - 更新字段
 * @returns {Promise<Object|null>} 更新后的备忘录
 */
async function updateMemo(memoId, updates = {}) {
  const allowedFields = ["title", "priority", "completed", "memo_date"];
  const setClauses = [];
  const values = [];
  let index = 1;

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      setClauses.push(`${key} = $${index}`);
      values.push(updates[key]);
      index += 1;
    }
  });

  if (setClauses.length === 0) {
    throw new Error("没有提供有效的更新字段");
  }

  setClauses.push(`updated_at = NOW()`);

  const { rows } = await query(
    `
      UPDATE dashboard_memos
      SET ${setClauses.join(", ")}
      WHERE memo_id = $${index}
      RETURNING memo_id, memo_date, title, priority, completed, created_at, updated_at
    `,
    [...values, memoId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 删除备忘录
 * @param {number} memoId - 备忘录ID
 * @returns {Promise<boolean>} 是否删除成功
 */
async function deleteMemo(memoId) {
  const { rowCount } = await query(
    `DELETE FROM dashboard_memos WHERE memo_id = $1`,
    [memoId]
  );
  return rowCount > 0;
}

module.exports = {
  getMemosByDate,
  createMemo,
  updateMemo,
  deleteMemo
};
