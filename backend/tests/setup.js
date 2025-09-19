const db = require('../database/postgreDB/pg');

// 全局测试设置
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await db.initializeHotelDB();
});

// 全局测试清理
afterAll(async () => {
  try {
    // 按依赖顺序删除测试表
    await db.query('DROP TABLE IF EXISTS bills CASCADE;');
    await db.query('DROP TABLE IF EXISTS order_changes CASCADE;');
    await db.query('DROP TABLE IF EXISTS review_invitations CASCADE;');
    await db.query('DROP TABLE IF EXISTS orders CASCADE;');
    await db.query('DROP TABLE IF EXISTS handover CASCADE;');
  } catch (e) {
    console.warn('清理测试数据时出现警告:', e.message);
  }
  await db.closePool();
});

// 提供给各个测试文件使用的清理函数
global.cleanupTestData = async () => {
  try {
    await db.query("DELETE FROM bills WHERE order_id LIKE ANY($1)", [['ORDER_%','TEST_%']]);
    await db.query("DELETE FROM order_changes WHERE order_id LIKE ANY($1)", [['ORDER_%','TEST_%']]).catch(()=>{});
    await db.query("DELETE FROM orders WHERE order_id LIKE ANY($1)", [['ORDER_%','TEST_%']]);
    await db.query("DELETE FROM shift_handover WHERE cashier_name LIKE ANY($1)", [['TEST_%']]);
    await db.query("DELETE FROM rooms WHERE room_number LIKE ANY($1)", [['R_%','TEST_%']]);
    await db.query("DELETE FROM room_types WHERE type_code LIKE ANY($1)", [['T_%','TEST_%']]);
  } catch (error) {
    if (!error.message.includes('外键约束')) {
      console.warn('清理测试数据时出现警告:', error.message);
    }
  }
};
