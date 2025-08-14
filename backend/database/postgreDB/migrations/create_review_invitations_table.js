"use strict";

const { query } = require('../pg');

/**
 * 创建 review_invitations 表，并从 bills 迁移邀请相关数据
 */
async function migrate() {
  try {
    console.log('创建表 review_invitations...');
    await query(`
      CREATE TABLE IF NOT EXISTS review_invitations (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL UNIQUE,
        invited BOOLEAN NOT NULL DEFAULT FALSE,
        positive_review BOOLEAN DEFAULT NULL,
        invite_time TIMESTAMP DEFAULT NULL,
        update_time TIMESTAMP DEFAULT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      );
    `);

    console.log('创建索引...');
    await query(`CREATE INDEX IF NOT EXISTS idx_review_invitations_order_id ON review_invitations(order_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_review_invitations_invited ON review_invitations(invited);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_review_invitations_positive_review ON review_invitations(positive_review);`);

    console.log('从 bills 迁移邀请数据到 review_invitations ...');
    const colCheck = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='bills' AND column_name='review_invited'`);
    if (colCheck.rows.length > 0) {
      await query(`
        INSERT INTO review_invitations(order_id, invited, positive_review, invite_time, update_time)
        SELECT order_id, COALESCE(review_invited, FALSE), positive_review, review_invite_time, review_update_time
        FROM bills
        ON CONFLICT (order_id) DO NOTHING;
      `);
      console.log('旧字段存在，已迁移历史邀请数据');
    } else {
      console.log('bills 表无旧邀请字段，跳过数据迁移');
    }

    console.log('完成数据迁移');
  } catch (error) {
    console.error('创建或迁移 review_invitations 失败:', error);
    throw error;
  }
}

/**
 * 回滚：删除 review_invitations 表
 */
async function rollback() {
  try {
    await query(`DROP TABLE IF EXISTS review_invitations`);
  } catch (error) {
    console.error('回滚 review_invitations 失败:', error);
    throw error;
  }
}

module.exports = { migrate, rollback };

