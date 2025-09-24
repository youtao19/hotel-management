// 在导入数据库之前先设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.REDIS_PW = process.env.REDIS_PW || '';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'test@example.com';
process.env.APP_NAME = process.env.APP_NAME || 'hotelManagement';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:9000';
process.env.EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.example.com';
process.env.EMAIL_PORT = process.env.EMAIL_PORT || '587';
process.env.EMAIL_USER = process.env.EMAIL_USER || 'test';
process.env.EMAIL_PW = process.env.EMAIL_PW || 'test';
process.env.OPENAI_KEY = process.env.OPENAI_KEY || 'test';
process.env.OPENAI_HOST = process.env.OPENAI_HOST || 'test';
process.env.OPENAI_CHAT_COMPLETION_PATH = process.env.OPENAI_CHAT_COMPLETION_PATH || 'test';

const db = require('../database/postgreDB/pg');
const redisDB = require('../database/redis/redis');

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
  await db.initializeHotelDB(); // 初始化数据库结构
  redisDB.initialize(); // 初始化Redis连接
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
