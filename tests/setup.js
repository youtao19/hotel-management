const db = require('../backend/database/postgreDB/pg');

// 全局测试设置
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await db.initializeHotelDB();
});

// 全局测试清理
afterAll(async () => {
  // 使用受控会话+本地超时，避免因锁阻塞导致的长时间挂起
  try {
    console.log('[tests/setup] afterAll: truncate tables (with local timeouts)');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '4000ms'");
      await client.query("SET LOCAL lock_timeout = '1500ms'");
      await client.query('TRUNCATE TABLE bills, orders, rooms, room_types, shift_handover RESTART IDENTITY CASCADE');
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.warn('[tests/setup] afterAll: truncate failed (ignored):', error.message);
    } finally {
      client.release();
    }
  } catch (outerErr) {
    console.warn('[tests/setup] afterAll: cleanup session failed (ignored):', outerErr.message);
  }

  // 无论清理是否成功，均尝试关闭连接池，避免 Jest 打开句柄
  await db.closePool();
});

// 提供给各个测试文件使用的清理函数
global.cleanupTestData = async () => {
  try {
    console.log('[tests/setup] cleanup: truncate tables (with local timeouts)');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '4000ms'");
      await client.query("SET LOCAL lock_timeout = '1500ms'");
      await client.query('TRUNCATE TABLE bills, orders, rooms, room_types, shift_handover RESTART IDENTITY CASCADE');
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (!/foreign key|外键约束/i.test(error.message)) {
        console.warn('清理测试数据时出现警告:', error.message);
      }
    } finally {
      client.release();
    }
  } catch (outerErr) {
    console.warn('[tests/setup] cleanup: session failed (ignored):', outerErr.message);
  }
};
