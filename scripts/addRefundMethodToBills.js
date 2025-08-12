/**
 * 为 bills 表增加 refund_method 字段
 * 使用方法： node scripts/addRefundMethodToBills.js
 */
// 允许脚本独立运行：若未提前加载 dev.env，则尝试加载并填充最小必需变量
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../dev.env') });

// 若某些变量缺失（脚本只需要数据库相关 + APP_NAME/APP_URL + NODE_PORT），做兜底
process.env.APP_NAME = process.env.APP_NAME || 'hotelManagement';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:9000';
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';
process.env.NODE_PORT = process.env.NODE_PORT || '3000';

// 数据库兜底
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'hotel_db';

const { query, initializeHotelDB, closePool } = require('../backend/database/postgreDB/pg');

async function addRefundMethodColumn() {
  try {
    console.log('🚀 开始添加 refund_method 字段到 bills 表...');
    await initializeHotelDB();

    // 检查是否已存在
    const existsRes = await query(`SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='refund_method' LIMIT 1;`);
    if (existsRes.rows.length) {
      console.log('✅ refund_method 字段已存在，跳过');
      return;
    }

    // 添加字段
    await query(`ALTER TABLE bills ADD COLUMN refund_method VARCHAR(50);`);
    console.log('✅ 已添加 refund_method 字段');

    // 可选：对已存在已退款记录尝试推断退款方式（这里暂留为 NULL，后续可根据业务回填）

    // 验证
    const verify = await query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='bills' AND column_name='refund_method';`);
    console.log('📋 字段信息:', verify.rows[0]);
    console.log('🎉 迁移完成');
  } catch (e) {
    console.error('❌ 添加 refund_method 字段失败:', e);
    throw e;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  addRefundMethodColumn().then(()=>{process.exit(0)}).catch(()=>process.exit(1));
}

module.exports = { addRefundMethodColumn };
