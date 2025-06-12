// 调试时间计算逻辑
const { initializeHotelDB, query, closePool } = require('../backend/database/postgreDB/pg');

async function debugTimeCalculation() {
  try {
    await initializeHotelDB();

    const today = new Date().toISOString().split('T')[0];

    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'DEBUG_%\'');

    // 插入一个明确的8小时订单
    const testOrder = {
      order_id: 'DEBUG_001',
      id_source: 'system',
      order_source: 'front_desk',
      guest_name: '调试客人',
      phone: '13800000001',
      id_number: '110101199001011001',
      room_type: 'standard',
      room_number: '101',
      room_price: 288.00,
      deposit: 200.00,
      payment_method: '现金',
      status: 'checked_out',
      check_in_date: `${today} 10:00:00`,
      check_out_date: `${today} 18:00:00`, // 8小时差
      create_time: `${today} 10:00:00`,
      remarks: '调试数据'
    };

    await query(`
      INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone, id_number,
        room_type, room_number, room_price, deposit, payment_method,
        status, check_in_date, check_out_date, create_time, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      testOrder.order_id, testOrder.id_source, testOrder.order_source, testOrder.guest_name,
      testOrder.phone, testOrder.id_number, testOrder.room_type, testOrder.room_number,
      testOrder.room_price, testOrder.deposit, testOrder.payment_method, testOrder.status,
      testOrder.check_in_date, testOrder.check_out_date, testOrder.create_time, testOrder.remarks
    ]);

    console.log('测试订单已插入，开始调试时间计算...');

    // 直接测试SQL查询
    const debugSql = `
      SELECT
        order_id,
        check_in_date,
        check_out_date,
        EXTRACT(EPOCH FROM (check_out_date::timestamp - check_in_date::timestamp))/3600 as hours_diff,
        DATE(check_in_date) as checkin_date,
        DATE(check_out_date) as checkout_date,
        (DATE(check_in_date) != DATE(check_out_date)) as is_cross_day,
        CASE
          WHEN (EXTRACT(EPOCH FROM (check_out_date::timestamp - check_in_date::timestamp))/3600 >= 6
                OR DATE(check_in_date) != DATE(check_out_date)
                OR check_out_date IS NULL) THEN 'hotel'
          ELSE 'rest'
        END as business_type
      FROM orders
      WHERE order_id = 'DEBUG_001'
    `;

    const result = await query(debugSql);
    const row = result.rows[0];

    console.log('调试结果:');
    console.log(`订单ID: ${row.order_id}`);
    console.log(`入住时间: ${row.check_in_date}`);
    console.log(`退房时间: ${row.check_out_date}`);
    console.log(`时长(小时): ${row.hours_diff}`);
    console.log(`入住日期: ${row.checkin_date}`);
    console.log(`退房日期: ${row.checkout_date}`);
    console.log(`是否跨日: ${row.is_cross_day}`);
    console.log(`业务类型: ${row.business_type}`);

    // 清理
    await query('DELETE FROM orders WHERE order_id = \'DEBUG_001\'');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await closePool();
  }
}

debugTimeCalculation();
