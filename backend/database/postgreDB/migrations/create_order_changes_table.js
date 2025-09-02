"use strict";

const { query } = require('../pg');

/**
 * 创建 order_changes 表（若不存在）
 */
async function migrate() {
  try {
    // 检查表是否已存在
    const check = await query(`
      SELECT to_regclass('public.order_changes') AS exists;
    `);
    if (check.rows[0].exists) {
      console.log('order_changes 表已存在，跳过创建');
      return true;
    }

    console.log('创建 order_changes 表...');
    await query(`
      CREATE TABLE IF NOT EXISTS order_changes (
        change_id SERIAL PRIMARY KEY,
        order_id VARCHAR(30) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        changed_by VARCHAR(64) NOT NULL DEFAULT 'system',
        changes JSONB NOT NULL,
        reason TEXT
      );
    `);

    await query(`COMMENT ON TABLE order_changes IS '记录订单信息的修改历史';`);
    await query(`COMMENT ON COLUMN order_changes.change_id IS '变更记录的唯一ID';`);
    await query(`COMMENT ON COLUMN order_changes.order_id IS '关联的订单ID';`);
    await query(`COMMENT ON COLUMN order_changes.changed_at IS '变更发生的时间戳';`);
    await query(`COMMENT ON COLUMN order_changes.changed_by IS '执行变更的操作员';`);
    await query(`COMMENT ON COLUMN order_changes.changes IS '一个JSON对象，记录字段的新旧值';`);
    await query(`COMMENT ON COLUMN order_changes.reason IS '执行变更的原因';`);

    console.log('order_changes 表创建完成');
    return true;
  } catch (err) {
    console.error('创建 order_changes 表失败:', err);
    throw err;
  }
}

module.exports = { migrate };
