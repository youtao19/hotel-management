const { query } = require('../backend/database/postgreDB/pg');

// 插入测试数据
async function insertTestData() {
  try {
    // 删除现有的测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'TEST_%\'');

    // 今天的日期
    const today = new Date().toISOString().split('T')[0];

    // 插入测试订单数据
    const testOrders = [
      {
        order_id: 'TEST_001',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '张三',
        phone: '13812345678',
        id_number: '110101199001011234',
        room_type: 'standard',
        room_number: '101',
        room_price: 158.00,
        deposit: 100.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 14:30:00`,
        remarks: '测试数据'
      },
      {
        order_id: 'TEST_002',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '李四',
        phone: '13812345679',
        id_number: '110101199001011235',
        room_type: 'standard',
        room_number: '102',
        room_price: 128.00,
        deposit: 80.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 16:20:00`,
        remarks: '测试数据'
      },
      {
        order_id: 'TEST_003',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '王五',
        phone: '13812345680',
        id_number: '110101199001011236',
        room_type: 'deluxe',
        room_number: '105',
        room_price: 178.00,
        deposit: 120.00,
        payment_method: '支付宝',
        status: 'checked_in',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 20:10:00`,
        remarks: '测试数据'
      },
      {
        order_id: 'TEST_004',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '赵六',
        phone: '13812345681',
        id_number: '110101199001011237',
        room_type: 'rest',
        room_number: '201',
        room_price: 88.00,
        deposit: 50.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 13:00:00`,
        remarks: '测试数据'
      },
      {
        order_id: 'TEST_005',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '钱七',
        phone: '13812345682',
        id_number: '110101199001011238',
        room_type: 'rest',
        room_number: '202',
        room_price: 98.00,
        deposit: 60.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 15:45:00`,
        remarks: '测试数据'
      }
    ];

    for (const order of testOrders) {
      const sql = `
        INSERT INTO orders (
          order_id, id_source, order_source, guest_name, phone, id_number,
          room_type, room_number, room_price, deposit, payment_method,
          status, check_in_date, check_out_date, create_time, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;

      await query(sql, [
        order.order_id,
        order.id_source,
        order.order_source,
        order.guest_name,
        order.phone,
        order.id_number,
        order.room_type,
        order.room_number,
        order.room_price,
        order.deposit,
        order.payment_method,
        order.status,
        order.check_in_date,
        order.check_out_date,
        order.create_time,
        order.remarks
      ]);
    }

    console.log('测试数据插入成功！');
    console.log(`插入了 ${testOrders.length} 条订单记录`);

    // 显示数据汇总
    const hotelTotal = testOrders
      .filter(o => ['standard', 'deluxe', 'suite'].includes(o.room_type))
      .reduce((sum, o) => sum + o.room_price + o.deposit, 0);

    const restTotal = testOrders
      .filter(o => o.room_type === 'rest')
      .reduce((sum, o) => sum + o.room_price + o.deposit, 0);

    console.log(`客房收入总计: ¥${hotelTotal.toFixed(2)}`);
    console.log(`休息房收入总计: ¥${restTotal.toFixed(2)}`);

  } catch (error) {
    console.error('插入测试数据失败:', error);
  }
}

// 运行测试数据插入
insertTestData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
