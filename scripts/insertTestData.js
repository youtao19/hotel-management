const { query } = require('../backend/database/postgreDB/pg');

// 插入测试订单数据
async function insertTestData() {
  try {
    // 删除现有的测试数据
    await query('DELETE FROM orders WHERE order_number LIKE \'TEST_%\'');

    // 今天的日期
    const today = new Date().toISOString().split('T')[0];

    // 插入测试订单数据
    const testOrders = [
      {
        order_number: 'TEST_001',
        room_number: '101',
        room_price: 158.00,
        deposit: 100.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: `${today} 14:30:00`,
        check_out_date: `${today} 18:45:00`,
        created_at: `${today} 14:30:00`
      },
      {
        order_number: 'TEST_002',
        room_number: '102',
        room_price: 128.00,
        deposit: 80.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: `${today} 16:20:00`,
        check_out_date: `${today} 22:15:00`,
        created_at: `${today} 16:20:00`
      },
      {
        order_number: 'TEST_003',
        room_number: '105',
        room_price: 178.00,
        deposit: 120.00,
        payment_method: '支付宝',
        status: 'checked_in',
        check_in_date: `${today} 20:10:00`,
        check_out_date: null,
        created_at: `${today} 20:10:00`
      },
      {
        order_number: 'TEST_004',
        room_number: '201',
        room_price: 88.00,
        deposit: 50.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: `${today} 13:00:00`,
        check_out_date: `${today} 17:30:00`,
        created_at: `${today} 13:00:00`
      },
      {
        order_number: 'TEST_005',
        room_number: '202',
        room_price: 98.00,
        deposit: 60.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: `${today} 15:45:00`,
        check_out_date: `${today} 19:20:00`,
        created_at: `${today} 15:45:00`
      }
    ];

    for (const order of testOrders) {
      const sql = `
        INSERT INTO orders (
          order_number, room_number, room_price, deposit,
          payment_method, status, check_in_date, check_out_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await query(sql, [
        order.order_number,
        order.room_number,
        order.room_price,
        order.deposit,
        order.payment_method,
        order.status,
        order.check_in_date,
        order.check_out_date,
        order.created_at
      ]);
    }

    console.log('测试数据插入成功！');
    console.log(`插入了 ${testOrders.length} 条订单记录`);

    // 显示数据汇总
    const hotelTotal = testOrders
      .filter(o => ['101', '102', '105'].includes(o.room_number))
      .reduce((sum, o) => sum + o.room_price + o.deposit, 0);

    const restTotal = testOrders
      .filter(o => ['201', '202'].includes(o.room_number))
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
