const db = require('../database/postgreDB/pg');
const redisDB = require('../database/redis/redis');
const app = require('../app');

// 所有测试表，统一管理
const tables = [
  'room_types',
  'rooms',
  'orders',
  'bills',
  'douyin_outbox',
  'douyin_order_event',
  'douyin_order',
  'douyin_room_mapping',
  'douyin_account_config',
  'review_invitations',
  'order_changes',
  'handover',
  'dashboard_memos'
];

// 全局测试设置
beforeAll(async () => {
  // 初始化数据库结构
  await db.initializePostgreDB();

  // ✅ 初始化 app 的 session 和路由（重要！）
  await app.initializeSession();

  console.log('✅ 测试环境初始化完成');
});

afterAll(async () => {
  try {
    // 先禁用外键约束
    await db.query('SET session_replication_role = replica;');

    // 清空所有测试表数据
    for (const table of tables) {
      await db.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }

    // 恢复外键约束
    await db.query('SET session_replication_role = DEFAULT;');

    console.log('✅ 所有测试表已清空');
  } catch (err) {
    console.error('❌ 清空测试表时出错:', err);
  } finally {
    // 关闭数据库连接
    await db.closePool();
    await redisDB.close();

    console.log('✅ 测试环境清理完成');
  }
});
