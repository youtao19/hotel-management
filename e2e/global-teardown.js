// e2e/global-teardown.js
const db = require('../backend/database/postgreDB/pg');

// 需要清理的测试表清单（与后端测试保持一致）
const tables = [
  'room_types',
  'rooms',
  'orders',
  'bills',
  'review_invitations',
  'order_changes',
  'handover',
  'dashboard_memos'
];

module.exports = async () => {
  try {
    // 先禁用外键约束
    await db.query('SET session_replication_role = replica;');

    // 清空所有测试表数据（保留表结构，避免影响复用中的后端服务）
    for (const table of tables) {
      await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
    }

    // 恢复外键约束
    await db.query('SET session_replication_role = DEFAULT;');

    console.log('✅ 所有测试表已清空');
  } catch (err) {
    console.error('❌ 清空测试表时出错:', err);
  } finally {
    // 关闭数据库连接
    await db.closePool();

    console.log('✅ 测试环境清理完成');
  }
};
