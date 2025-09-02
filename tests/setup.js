const db = require('../backend/database/postgreDB/pg');

// 全局测试设置
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await db.initializeHotelDB();
});

// 全局测试清理
afterAll(async () => {
  // 清理所有测试数据，按正确的顺序删除以避免外键约束违反
  try {
    await db.query('DELETE FROM bills WHERE order_id LIKE $1', ['TEST_%']);
    await db.query('DELETE FROM orders WHERE order_id LIKE $1', ['TEST_%']);
    await db.query('DELETE FROM rooms WHERE room_number LIKE $1', ['T%']);
    await db.query('DELETE FROM room_types WHERE type_code LIKE $1', ['TEST_%']);
    await db.query('DELETE FROM shift_handover WHERE cashier_name LIKE $1', ['TEST_%']);
  } catch (error) {
    console.warn('清理测试数据时出现警告:', error.message);
  }

  await db.closePool();
});

// 提供给各个测试文件使用的清理函数
global.cleanupTestData = async () => {
  try {
    // 按正确的顺序删除数据以避免外键约束违反
    await db.query('DELETE FROM bills WHERE order_id LIKE $1', ['ORDER_%']);
    await db.query('DELETE FROM orders WHERE order_id LIKE $1', ['ORDER_%']);
    await db.query('DELETE FROM shift_handover WHERE cashier_name LIKE $1 OR cashier_name LIKE $2', ['TEST_%', '%test%']);

    // 先删除房间，再删除房型，避免外键约束
    await db.query('DELETE FROM rooms WHERE room_number LIKE $1 OR room_number LIKE $2', ['R_%', '1%']);
    await db.query('DELETE FROM room_types WHERE type_code LIKE $1', ['T_%']);
  } catch (error) {
    // 忽略外键约束警告，这些是正常的清理过程
    if (!error.message.includes('外键约束')) {
      console.warn('清理测试数据时出现警告:', error.message);
    }
  }
};
