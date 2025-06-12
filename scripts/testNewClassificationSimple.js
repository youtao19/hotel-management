// 测试新的基于价格和日期的分类逻辑
const { initializeHotelDB, query, closePool } = require('../backend/database/postgreDB/pg');
const { getReceiptDetails, getStatistics } = require('../backend/modules/shiftHandoverModule');

async function testPriceBasedClassification() {
  try {
    // 初始化数据库
    await initializeHotelDB();

    // 清理可能存在的测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'PRICE_TEST_%\'');

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date().getTime() + 24*60*60*1000).toISOString().split('T')[0];

    // 插入测试数据
    const testOrders = [
      {
        order_id: 'PRICE_TEST_001',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '高价客房客人',
        phone: '13800000001',
        id_number: '110101199001011001',
        room_type: 'standard',
        room_number: '101',
        room_price: 288.00,  // >150，应归类为客房
        deposit: 200.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 10:00:00`,
        remarks: '高价客房测试数据'
      },
      {
        order_id: 'PRICE_TEST_002',
        id_source: 'system',
        order_source: 'online',
        guest_name: '低价休息房客人',
        phone: '13800000002',
        id_number: '110101199002022002',
        room_type: 'standard',
        room_number: '102',
        room_price: 88.00,   // <=150，应归类为休息房
        deposit: 50.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 14:00:00`,
        remarks: '低价休息房测试数据'
      },
      {
        order_id: 'PRICE_TEST_003',
        id_source: 'system',
        order_source: 'phone',
        guest_name: '跨日客房客人',
        phone: '13800000003',
        id_number: '110101199003033003',
        room_type: 'standard',
        room_number: '103',
        room_price: 120.00,  // <=150，但跨日期，应归类为客房
        deposit: 100.00,
        payment_method: '支付宝',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: tomorrow,
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

    console.log('测试数据插入完成，开始测试基于价格的分类逻辑...');

    // 测试客房分类
    console.log('\n=== 测试客房分类 ===');
    const hotelReceipts = await getReceiptDetails('hotel', today, today);
    console.log(`客房订单数量: ${hotelReceipts.length}`);
    const ourHotelOrders = hotelReceipts.filter(r => r.order_number.startsWith('PRICE_TEST_'));
    console.log(`我们的客房测试订单数量: ${ourHotelOrders.length}`);
    ourHotelOrders.forEach(receipt => {
      console.log(`- 订单 ${receipt.order_number}: 房间 ${receipt.room_number}, 房价 ¥${receipt.room_fee}, 入住 ${receipt.check_in_date}, 退房 ${receipt.check_out_date}`);
    });

    // 测试休息房分类
    console.log('\n=== 测试休息房分类 ===');
    const restReceipts = await getReceiptDetails('rest', today, today);
    console.log(`休息房订单数量: ${restReceipts.length}`);
    const ourRestOrders = restReceipts.filter(r => r.order_number.startsWith('PRICE_TEST_'));
    console.log(`我们的休息房测试订单数量: ${ourRestOrders.length}`);
    ourRestOrders.forEach(receipt => {
      console.log(`- 订单 ${receipt.order_number}: 房间 ${receipt.room_number}, 房价 ¥${receipt.room_fee}, 入住 ${receipt.check_in_date}, 退房 ${receipt.check_out_date}`);
    });

    // 验证结果
    console.log('\n=== 验证结果 ===');
    const expectedHotelCount = 2; // PRICE_TEST_001 (高价) 和 PRICE_TEST_003 (跨日)
    const expectedRestCount = 1;  // PRICE_TEST_002 (低价且当日)

    if (ourHotelOrders.length === expectedHotelCount) {
      console.log('✅ 客房分类正确');
      console.log('  - PRICE_TEST_001 (¥288，高价) 应在客房');
      console.log('  - PRICE_TEST_003 (¥120，跨日) 应在客房');
    } else {
      console.log(`❌ 客房分类错误，期望 ${expectedHotelCount}，实际 ${ourHotelOrders.length}`);
    }

    if (ourRestOrders.length === expectedRestCount) {
      console.log('✅ 休息房分类正确');
      console.log('  - PRICE_TEST_002 (¥88，当日低价) 应在休息房');
    } else {
      console.log(`❌ 休息房分类错误，期望 ${expectedRestCount}，实际 ${ourRestOrders.length}`);
    }

    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'PRICE_TEST_%\'');
    console.log('\n测试数据已清理');

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await closePool();
  }
}

testPriceBasedClassification();
