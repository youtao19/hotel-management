// 测试新的交接班分类逻辑
const { initializeHotelDB, query, closePool } = require('../backend/database/postgreDB/pg');
const { getReceiptDetails, getStatistics } = require('../backend/modules/shiftHandoverModule');

async function testNewClassification() {
  try {
    // 初始化数据库
    await initializeHotelDB();

    // 清理可能存在的测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'TEST_CLASS_%\'');

    const today = new Date().toISOString().split('T')[0];

    // 插入测试数据
    const testOrders = [
      {
        order_id: 'TEST_CLASS_001',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '客房测试客人',
        phone: '13800000001',
        id_number: '110101199001011001',
        room_type: 'standard',
        room_number: '101',
        room_price: 288.00,
        deposit: 200.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: `${today} 10:00:00`,  // 入住时间
        check_out_date: `${today} 18:00:00`, // 退房时间，8小时，应归类为客房
        create_time: `${today} 10:00:00`,
        remarks: '客房测试数据'
      },
      {
        order_id: 'TEST_CLASS_002',
        id_source: 'system',
        order_source: 'online',
        guest_name: '休息房测试客人',
        phone: '13800000002',
        id_number: '110101199002022002',
        room_type: 'standard',  // 注意：房间类型仍是standard，但会被归类为休息房
        room_number: '102',
        room_price: 88.00,
        deposit: 50.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: `${today} 14:00:00`,  // 入住时间
        check_out_date: `${today} 17:00:00`, // 退房时间，3小时，应归类为休息房
        create_time: `${today} 14:00:00`,
        remarks: '休息房测试数据'
      },
      {
        order_id: 'TEST_CLASS_003',
        id_source: 'system',
        order_source: 'phone',
        guest_name: '跨日客房测试',
        phone: '13800000003',
        id_number: '110101199003033003',
        room_type: 'standard',
        room_number: '103',
        room_price: 388.00,
        deposit: 300.00,
        payment_method: '支付宝',
        status: 'checked_out',
        check_in_date: `${today} 22:00:00`,
        check_out_date: new Date(new Date(today).getTime() + 24*60*60*1000).toISOString().slice(0,10) + ' 10:00:00', // 次日退房，应归类为客房
        create_time: `${today} 22:00:00`,
        remarks: '跨日客房测试数据'
      }
    ];

    // 插入测试订单
    for (const order of testOrders) {
      const sql = `
        INSERT INTO orders (
          order_id, id_source, order_source, guest_name, phone, id_number,
          room_type, room_number, room_price, deposit, payment_method,
          status, check_in_date, check_out_date, create_time, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;

      await query(sql, [
        order.order_id, order.id_source, order.order_source, order.guest_name,
        order.phone, order.id_number, order.room_type, order.room_number,
        order.room_price, order.deposit, order.payment_method, order.status,
        order.check_in_date, order.check_out_date, order.create_time, order.remarks
      ]);
    }

    console.log('测试数据插入完成，开始测试分类逻辑...');

    // 测试客房分类
    console.log('\n=== 测试客房分类 ===');
    const hotelReceipts = await getReceiptDetails('hotel', today, today);
    console.log(`客房订单数量: ${hotelReceipts.length}`);
    hotelReceipts.forEach(receipt => {
      console.log(`- 订单 ${receipt.order_number}: 房间 ${receipt.room_number}, 客人 ${receipt.guest_name}`);
    });

    // 测试休息房分类
    console.log('\n=== 测试休息房分类 ===');
    const restReceipts = await getReceiptDetails('rest', today, today);
    console.log(`休息房订单数量: ${restReceipts.length}`);
    restReceipts.forEach(receipt => {
      console.log(`- 订单 ${receipt.order_number}: 房间 ${receipt.room_number}, 客人 ${receipt.guest_name}`);
    });

    // 测试统计数据
    console.log('\n=== 测试统计数据 ===');
    const statistics = await getStatistics(today);
    console.log(`客房收入: ¥${statistics.hotelIncome.toFixed(2)}`);
    console.log(`休息房收入: ¥${statistics.restIncome.toFixed(2)}`);
    console.log(`客房数量: ${statistics.totalRooms}`);
    console.log(`休息房数量: ${statistics.restRooms}`);

    // 验证结果
    console.log('\n=== 验证结果 ===');
    const expectedHotelCount = 2; // TEST_CLASS_001 (8小时) 和 TEST_CLASS_003 (跨日)
    const expectedRestCount = 1;  // TEST_CLASS_002 (3小时)

    if (hotelReceipts.length === expectedHotelCount) {
      console.log('✅ 客房分类正确');
    } else {
      console.log(`❌ 客房分类错误，期望 ${expectedHotelCount}，实际 ${hotelReceipts.length}`);
    }

    if (restReceipts.length === expectedRestCount) {
      console.log('✅ 休息房分类正确');
    } else {
      console.log(`❌ 休息房分类错误，期望 ${expectedRestCount}，实际 ${restReceipts.length}`);
    }

    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'TEST_CLASS_%\'');
    console.log('\n测试数据已清理');

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await closePool();
  }
}

testNewClassification();
