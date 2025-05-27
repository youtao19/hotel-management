"use strict";

const { query } = require('../pg');

/**
 * 执行迁移 - 从orders表删除actual_check_in_time和actual_check_out_time字段
 */
async function migrate() {
  try {
    console.log('正在检查orders表中的actual_check_in_time和actual_check_out_time字段...');

    // 检查actual_check_in_time字段是否存在
    const checkInTimeResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'actual_check_in_time'
    `);

    // 检查actual_check_out_time字段是否存在
    const checkOutTimeResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'actual_check_out_time'
    `);

    // 删除actual_check_in_time字段
    if (checkInTimeResult.rows.length > 0) {
      console.log('actual_check_in_time字段存在，删除中...');
      await query(`
        ALTER TABLE orders
        DROP COLUMN IF EXISTS actual_check_in_time
      `);
      console.log('成功删除actual_check_in_time字段');
    } else {
      console.log('actual_check_in_time字段不存在，跳过删除');
    }

    // 删除actual_check_out_time字段
    if (checkOutTimeResult.rows.length > 0) {
      console.log('actual_check_out_time字段存在，删除中...');
      await query(`
        ALTER TABLE orders
        DROP COLUMN IF EXISTS actual_check_out_time
      `);
      console.log('成功删除actual_check_out_time字段');
    } else {
      console.log('actual_check_out_time字段不存在，跳过删除');
    }

    console.log('orders表字段删除迁移完成');
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

/**
 * 回滚迁移 - 重新添加actual_check_in_time和actual_check_out_time字段
 */
async function rollback() {
  try {
    console.log('正在回滚orders表字段删除迁移...');

    // 重新添加actual_check_in_time字段
    await query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS actual_check_in_time TIMESTAMP
    `);

    // 重新添加actual_check_out_time字段
    await query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS actual_check_out_time TIMESTAMP
    `);

    console.log('orders表字段删除迁移回滚完成');
  } catch (error) {
    console.error('回滚失败:', error);
    throw error;
  }
}

module.exports = {
  migrate,
  rollback
};
