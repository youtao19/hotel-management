const { initializeHotelDB, query, closePool } = require('../backend/database/postgreDB/pg');
const { getStatistics } = require('../backend/modules/shiftHandoverModule');

async function debugStatistics() {
  try {
    await initializeHotelDB();

    const today = new Date().toISOString().split('T')[0];
    console.log('查询日期:', today);

    // 查看测试数据
    const orders = await query('SELECT * FROM orders WHERE order_id LIKE \'MOD_STAT_%\'');
    console.log('找到订单数据:', orders.rows.length);
    orders.rows.forEach(order => {
      console.log('订单:', order.order_id, order.room_price, order.deposit, order.check_in_date, order.check_out_date);
    });

    const bills = await query('SELECT * FROM bills WHERE order_id LIKE \'MOD_STAT_%\'');
    console.log('找到账单数据:', bills.rows.length);
    bills.rows.forEach(bill => {
      console.log('账单:', bill.order_id, bill.total_income, bill.room_fee, bill.deposit);
    });

    // 获取统计数据
    const statistics = await getStatistics(today, today);
    console.log('统计结果:', statistics);

    // 计算预期值
    const expectedTotal = statistics.reserveCash + statistics.hotelIncome + statistics.restIncome + statistics.carRentalIncome;
    console.log('预期总计:', expectedTotal, '实际总计:', statistics.totalIncome);

  } catch (error) {
    console.error('调试出错:', error);
  } finally {
    await closePool();
  }
}

debugStatistics();
