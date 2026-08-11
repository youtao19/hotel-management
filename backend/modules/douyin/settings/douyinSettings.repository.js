"use strict";

const { query } = require('../../../database/postgreDB/pg');

/** 查询当前抖音支持设置。 */
async function findSettings() {
  const result = await query(
    `SELECT auto_confirm_enabled, updated_by,
            to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
     FROM douyin_support_settings
     WHERE id = 1`
  );
  return result.rows[0] || null;
}

/** 保存自动接单开关并记录操作员工。 */
async function saveAutoConfirmEnabled(autoConfirmEnabled, accountId) {
  const result = await query(
    `INSERT INTO douyin_support_settings (id, auto_confirm_enabled, updated_by)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       auto_confirm_enabled = EXCLUDED.auto_confirm_enabled,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP
     RETURNING auto_confirm_enabled, updated_by,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at`,
    [autoConfirmEnabled, accountId || null]
  );
  return result.rows[0];
}

module.exports = {
  findSettings,
  saveAutoConfirmEnabled
};
