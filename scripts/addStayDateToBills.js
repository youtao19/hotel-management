/**
 * 为 bills 表增加 stay_date 字段 (DATE)
 * 从 orders.room_price JSONB 的第一个 key (最早日期) 推导，若为空则使用 orders.check_in_date
 * 使用: node scripts/addStayDateToBills.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../dev.env') });

// 最小环境兜底
process.env.APP_NAME = process.env.APP_NAME || 'hotelManagement';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:9000';
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';
process.env.NODE_PORT = process.env.NODE_PORT || '3000';
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'hotel_db';

const { query, initializeHotelDB, closePool } = require('../backend/database/postgreDB/pg');

async function addStayDate() {
  try {
    console.log('🚀 开始添加 stay_date 字段到 bills 表...');
    await initializeHotelDB();

    const exists = await query(`SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='stay_date' LIMIT 1;`);
    if (exists.rows.length) {
      console.log('✅ stay_date 字段已存在，跳过添加');
    } else {
      await query(`ALTER TABLE bills ADD COLUMN stay_date DATE;`);
      console.log('✅ 已添加 stay_date 字段');
    }

    // 为已存在的账单补数据：
    // 逻辑: 取对应订单 room_price JSON 对象的最早日期(key排序后的第一个)，为空则用 check_in_date
    console.log('🛠️ 开始补齐历史账单 stay_date...');
    const bills = await query(`SELECT bill_id, order_id, stay_date FROM bills WHERE stay_date IS NULL`);
    console.log(`待补齐记录: ${bills.rows.length}`);

    if (bills.rows.length) {
      const orderIds = [...new Set(bills.rows.map(b => b.order_id))];
      const ordersRes = await query(`SELECT order_id, check_in_date, room_price FROM orders WHERE order_id = ANY($1)`, [orderIds]);
      const orderMap = new Map();
      for (const o of ordersRes.rows) {
        // room_price 是 JSONB 对象
        let stayDate = o.check_in_date; // 默认 check_in_date
        if (o.room_price && typeof o.room_price === 'object') {
          const keys = Object.keys(o.room_price).sort();
            if (keys.length) stayDate = keys[0];
        }
        orderMap.set(o.order_id, stayDate);
      }
      let updated = 0;
      for (const b of bills.rows) {
        const sd = orderMap.get(b.order_id) || null;
        if (sd) {
          await query(`UPDATE bills SET stay_date=$1 WHERE bill_id=$2`, [sd, b.bill_id]);
          updated++;
        }
      }
      console.log(`✅ 已更新 ${updated} 条账单 stay_date`);
    }

    console.log('🎉 迁移完成');
  } catch (e) {
    console.error('❌ 添加/填充 stay_date 失败:', e);
    throw e;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  addStayDate().then(()=>process.exit(0)).catch(()=>process.exit(1));
}

module.exports = { addStayDate };
