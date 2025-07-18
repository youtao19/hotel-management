const { query, createPool } = require('./database/postgreDB/pg');

async function debugHandoverData() {
  try {
    console.log('开始调试交接班数据...');
    
    // 创建数据库连接池
    createPool();
    
    // 查询最近的交接班记录
    const handoverQuery = `
      SELECT id, shift_date, type, details, cashier_name, created_at, updated_at
      FROM shift_handover 
      WHERE shift_date >= '2025-07-18'
      ORDER BY shift_date DESC, updated_at DESC
    `;
    
    const handoverResult = await query(handoverQuery);
    
    console.log(`\n📋 找到 ${handoverResult.rows.length} 条交接班记录:`);
    
    handoverResult.rows.forEach((record, index) => {
      console.log(`\n--- 记录 ${index + 1} ---`);
      console.log(`ID: ${record.id}`);
      console.log(`日期: ${record.shift_date}`);
      console.log(`类型: ${record.type}`);
      console.log(`收银员: ${record.cashier_name}`);
      console.log(`创建时间: ${record.created_at}`);
      console.log(`更新时间: ${record.updated_at}`);
      
      if (record.details) {
        const details = record.details;
        console.log(`详情:`);
        
        // 检查退押金记录
        if (details.refundDeposits && details.refundDeposits.length > 0) {
          console.log(`  退押金记录 (${details.refundDeposits.length} 条):`);
          details.refundDeposits.forEach((refund, i) => {
            console.log(`    ${i + 1}. 订单: ${refund.orderNumber}, 金额: ¥${refund.actualRefundAmount}, 方式: ${refund.method}, 时间: ${refund.refundTime}`);
          });
        } else {
          console.log(`  退押金记录: 无`);
        }
        
        // 检查支付数据
        if (details.paymentData) {
          console.log(`  支付数据:`);
          Object.keys(details.paymentData).forEach(method => {
            const data = details.paymentData[method];
            console.log(`    ${method}: 总计=¥${data.total || 0}, 退押金=¥${data.refundDeposit || 0}`);
          });
        } else {
          console.log(`  支付数据: 无`);
        }
      } else {
        console.log(`详情: 无`);
      }
    });
    
    // 查询最近的退押金订单
    console.log(`\n💰 查询最近的退押金订单:`);
    const orderQuery = `
      SELECT order_id, guest_name, deposit, refunded_deposit, refund_records
      FROM orders 
      WHERE refunded_deposit > 0
      ORDER BY order_id DESC
      LIMIT 5
    `;
    
    const orderResult = await query(orderQuery);
    
    orderResult.rows.forEach((order, index) => {
      console.log(`\n--- 订单 ${index + 1} ---`);
      console.log(`订单号: ${order.order_id}`);
      console.log(`客人: ${order.guest_name}`);
      console.log(`押金: ¥${order.deposit}`);
      console.log(`已退押金: ¥${order.refunded_deposit}`);
      
      if (order.refund_records && order.refund_records.length > 0) {
        console.log(`退押金记录:`);
        order.refund_records.forEach((record, i) => {
          console.log(`  ${i + 1}. 金额: ¥${record.actualRefundAmount}, 方式: ${record.method}, 时间: ${record.refundTime}`);
        });
      }
    });
    
    console.log('\n🎉 调试完成');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
    process.exit(1);
  }
}

debugHandoverData();
