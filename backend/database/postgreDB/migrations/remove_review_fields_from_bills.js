"use strict";

const { query } = require('../pg');

/**
 * 从 bills 表删除好评邀请相关字段（已迁移到 review_invitations）
 */
async function migrate() {
  try {
    console.log('检查 bills 好评字段是否存在...');

    const columns = [
      'review_invited',
      'positive_review',
      'review_invite_time',
      'review_update_time'
    ];

    for (const col of columns) {
      const check = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'bills' AND column_name = $1
      `, [col]);
      if (check.rows.length > 0) {
        console.log(`删除列 bills.${col} ...`);
        await query(`ALTER TABLE bills DROP COLUMN IF EXISTS ${col}`);
      }
    }

    console.log('bills 表好评字段删除完成');
  } catch (error) {
    console.error('删除 bills 好评字段失败:', error);
    throw error;
  }
}

/**
 * 回滚：为 bills 表重新添加好评字段（结构与原先一致，不回填数据）
 */
async function rollback() {
  try {
    await query(`
      ALTER TABLE bills
        ADD COLUMN IF NOT EXISTS review_invited BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS positive_review BOOLEAN DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS review_invite_time TIMESTAMP DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS review_update_time TIMESTAMP DEFAULT NULL
    `);
  } catch (error) {
    console.error('回滚删除 bills 好评字段失败:', error);
    throw error;
  }
}

module.exports = { migrate, rollback };

