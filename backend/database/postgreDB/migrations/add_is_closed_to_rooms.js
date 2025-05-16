"use strict";

const { query } = require('../pg');

/**
 * 执行迁移 - 为rooms表添加is_closed字段
 */
async function migrate() {
  try {
    console.log('正在检查rooms表是否存在is_closed字段...');

    // 检查字段是否已存在
    const checkResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'rooms' AND column_name = 'is_closed'
    `);

    // 如果字段不存在，添加它
    if (checkResult.rows.length === 0) {
      console.log('is_closed字段不存在，添加中...');

      // 添加is_closed字段，默认值为false
      await query(`
        ALTER TABLE rooms
        ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE
      `);

      console.log('成功添加is_closed字段到rooms表');

      // 更新维修和清洁中房间的is_closed值为true
      const updateResult = await query(`
        UPDATE rooms
        SET is_closed = TRUE
        WHERE status IN ('repair', 'cleaning')
      `);

      console.log(`更新了 ${updateResult.rowCount} 个房间的is_closed值为true`);
    } else {
      console.log('is_closed字段已存在，无需添加');
    }

    console.log('迁移完成');
    return true;
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

module.exports = {
  migrate
};
