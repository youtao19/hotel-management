"use strict";

const { query } = require('../pg');

/**
 * 执行迁移 - 为orders表添加退押金相关字段
 */
async function migrate() {
  try {
    console.log('正在检查orders表是否存在退押金相关字段...');

    // 检查refunded_deposit字段是否已存在
    const checkRefundedDepositResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'refunded_deposit'
    `);

    // 检查refund_records字段是否已存在
    const checkRefundRecordsResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'refund_records'
    `);

    // 添加refunded_deposit字段
    if (checkRefundedDepositResult.rows.length === 0) {
      console.log('refunded_deposit字段不存在，添加中...');
      await query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS refunded_deposit DECIMAL(10,2) DEFAULT 0
      `);
      console.log('成功添加refunded_deposit字段到orders表');
    } else {
      console.log('refunded_deposit字段已存在，无需添加');
    }

    // 添加refund_records字段
    if (checkRefundRecordsResult.rows.length === 0) {
      console.log('refund_records字段不存在，添加中...');
      await query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS refund_records JSONB DEFAULT '[]'::jsonb
      `);
      console.log('成功添加refund_records字段到orders表');
    } else {
      console.log('refund_records字段已存在，无需添加');
    }

    console.log('orders表退押金字段迁移完成');
    return true;
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

/**
 * 回滚迁移 - 删除退押金相关字段
 */
async function rollback() {
  try {
    console.log('正在回滚orders表退押金字段迁移...');

    // 删除refunded_deposit字段
    await query(`
      ALTER TABLE orders
      DROP COLUMN IF EXISTS refunded_deposit
    `);

    // 删除refund_records字段
    await query(`
      ALTER TABLE orders
      DROP COLUMN IF EXISTS refund_records
    `);

    console.log('orders表退押金字段迁移回滚完成');
  } catch (error) {
    console.error('回滚失败:', error);
    throw error;
  }
}

module.exports = {
  migrate,
  rollback
};
