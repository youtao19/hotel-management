// 所有测试表，统一管理
const tables = [
  'bills',
  'order_changes',
  'orders',
  'ota_order_relation',
  'ota_room_type_relation',
  'plugin_room_type_mapping',
  'douyin_orders',
  'douyin_presale_orders',
  'ota_channel_mappings',
  'rate_plans',
  'rooms',
  'douyin_room_type_mapping',
  'douyin_physical_rooms',
  'room_types',
  'review_invitations',
  'handover',
  'dashboard_memos',
  'account'
];

/**
 * 判断当前测试文件是否属于不依赖数据库/App 的模块单元测试。
 * 说明：
 * 1. 这类测试不会访问真实数据库、Redis 或 Express 应用；
 * 2. 跳过全局初始化后，可以避免测试环境建表逻辑干扰单元测试断言。
 *
 * @returns {boolean} 当前测试是否应跳过全局初始化。
 */
function shouldSkipGlobalBootstrap() {
  const testPath = expect.getState().testPath || '';

  return (testPath.includes('/backend/modules/douyin/') && testPath.includes('/__tests__/'))
    || (testPath.includes('/backend/modules/order-create/__tests__/') && testPath.endsWith('.test.js'))
    ;
}

function shouldSkipAppBootstrap() {
  const testPath = expect.getState().testPath || '';

  return testPath.endsWith('/backend/tests/rate_plan.test.js')
    || testPath.endsWith('/backend/tests/douyin_room_type_mapping.test.js')
    || testPath.endsWith('/backend/tests/douyin_external_route.test.js')
    || testPath.endsWith('/backend/tests/douyin_ari_notify.test.js');
}

// 全局测试设置
beforeAll(async () => {
  if (shouldSkipGlobalBootstrap()) {
    console.log('⏭️ 跳过模块单元测试的全局初始化');
    return;
  }

  const db = require('../database/postgreDB/pg');
  const app = require('../app');

  // 初始化数据库结构
  await db.initializePostgreDB();

  if (shouldSkipAppBootstrap()) {
    console.log('⏭️ 当前用例使用独立 Express App，跳过全量路由初始化');
    return;
  }

  // ✅ 初始化 app 的 session 和路由（重要！）
  await app.initializeSession();

  console.log('✅ 测试环境初始化完成');
});

afterAll(async () => {
  if (shouldSkipGlobalBootstrap()) {
    console.log('⏭️ 跳过模块单元测试的全局清理');
    return;
  }

  const db = require('../database/postgreDB/pg');
  const redisDB = require('../database/redis/redis');

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
