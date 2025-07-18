const { query, createPool } = require('./database/postgreDB/pg');

async function addRefundFields() {
  try {
    console.log('开始添加退押金字段...');
    
    // 创建数据库连接池
    createPool();
    
    // 检查并添加 refunded_deposit 字段
    const checkRefundedDeposit = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'refunded_deposit'
    `);
    
    if (checkRefundedDeposit.rows.length === 0) {
      console.log('添加 refunded_deposit 字段...');
      await query(`
        ALTER TABLE orders
        ADD COLUMN refunded_deposit DECIMAL(10,2) DEFAULT 0
      `);
      console.log('✅ refunded_deposit 字段添加成功');
    } else {
      console.log('✅ refunded_deposit 字段已存在');
    }
    
    // 检查并添加 refund_records 字段
    const checkRefundRecords = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'refund_records'
    `);
    
    if (checkRefundRecords.rows.length === 0) {
      console.log('添加 refund_records 字段...');
      await query(`
        ALTER TABLE orders
        ADD COLUMN refund_records JSONB DEFAULT '[]'::jsonb
      `);
      console.log('✅ refund_records 字段添加成功');
    } else {
      console.log('✅ refund_records 字段已存在');
    }
    
    console.log('🎉 所有退押金字段添加完成');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 添加退押金字段失败:', error);
    process.exit(1);
  }
}

addRefundFields();
