const db = require('../database/postgreDB/pg');

// 所有测试表，统一管理
const tables = [
  'account',
  'room_types',
  'rooms',
  'orders',
  'bills',
  'review_invitations',
  'order_changes',
  'handover'
];

// 生成 TRUNCATE SQL
const truncateTablesSQL = () => `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`;

// 全局测试设置
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await db.initializeHotelDB(); // 初始化数据库结构
});

// 全局测试清理
afterAll(async () => {
  try {
    await db.query(truncateTablesSQL()); // 清空数据
  } catch (e) {
    console.warn('清理测试数据时出现警告:', e.message);
  } finally {
    await db.closePool(); // 关闭连接池
  }
});

// 提供给各个测试文件使用的清理函数
global.cleanupTestData = async () => {
  try {
    await db.query(truncateTablesSQL());
  } catch (error) {
    console.warn('cleanupTestData 警告:', error.message);
  }
};
