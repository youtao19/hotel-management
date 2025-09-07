const { getStatistics } = require('./backend/modules/shiftHandoverModule');
const { query } = require('./backend/database/postgreDB/pg');

async function testDepositRefundDisplay() {
  try {
    console.log('🧪 测试交接班系统中退押金显示逻辑...\n');

    // 首先查看数据库中是否有测试数据
    const ordersCheck = await query(`
      SELECT
        order_id,
        guest_name,
        stay_type,
        check_in_date,
        check_out_date,
        deposit,
        payment_method
      FROM orders
      WHERE order_id LIKE 'ORDER_%'
      LIMIT 5
    `);

    console.log('📋 现有订单数据:');
    ordersCheck.rows.forEach(order => {
      console.log(`  - ${order.order_id}: ${order.guest_name}, ${order.stay_type}, 押金: ${order.deposit}, 支付: ${order.payment_method}`);
    });

    // 检查是否有退押金记录
    const billsCheck = await query(`
      SELECT
        b.bill_id,
        b.order_id,
        b.change_type,
        b.change_price,
        b.pay_way,
        o.stay_type
      FROM bills b
      JOIN orders o ON b.order_id = o.order_id
      WHERE b.change_type = '退押'
      LIMIT 5
    `);

    console.log('\n💰 现有退押金记录:');
    if (billsCheck.rows.length === 0) {
      console.log('  暂无退押金记录');
    } else {
      billsCheck.rows.forEach(bill => {
        console.log(`  - ${bill.bill_id}: 订单${bill.order_id} (${bill.stay_type}), 金额: ${bill.change_price}, 支付: ${bill.pay_way}`);
      });
    }

    // 测试统计功能
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📊 测试日期 ${today} 的统计数据:`);

    const stats = await getStatistics(today);

    console.log('\n✅ 统计结果:');
    console.log(`客房退押: ${stats.hotelDeposit}`);
    console.log(`休息房退押: ${stats.restDeposit}`);

    console.log('\n📋 按支付方式分类的退押金:');
    Object.entries(stats.paymentDetails).forEach(([method, details]) => {
      if (details.hotelDeposit > 0 || details.restDeposit > 0) {
        console.log(`  ${method}:`);
        console.log(`    - 客房退押: ${details.hotelDeposit}`);
        console.log(`    - 休息房退押: ${details.restDeposit}`);
      }
    });

    if (stats.hotelDeposit === 0 && stats.restDeposit === 0) {
      console.log('\n⚠️  注意: 当天没有退押金记录，这是正常的');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testDepositRefundDisplay()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 测试过程出错:', error);
    process.exit(1);
  });
