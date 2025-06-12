const { query } = require('../backend/database/postgreDB/pg');

// 生成演示数据
async function generateDemoData() {
  try {
    console.log('开始生成交接班演示数据...');

    // 清理现有测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'DEMO_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%演示数据%\'');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 生成今日订单数据
    const todayOrders = [
      // 客房订单
      {
        order_id: 'DEMO_H001',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '张先生',
        phone: '13800138001',
        id_number: '110101199001011001',
        room_type: 'standard',
        room_number: '101',
        room_price: 288.00,
        deposit: 200.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 14:30:00`,
        remarks: '演示数据'
      },
      {
        order_id: 'DEMO_H002',
        id_source: 'system',
        order_source: 'online',
        guest_name: '李女士',
        phone: '13800138002',
        id_number: '110101199002022002',
        room_type: 'deluxe',
        room_number: '105',
        room_price: 388.00,
        deposit: 300.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 16:15:00`,
        remarks: '演示数据'
      },
      {
        order_id: 'DEMO_H003',
        id_source: 'system',
        order_source: 'phone',
        guest_name: '王总',
        phone: '13800138003',
        id_number: '110101199003033003',
        room_type: 'suite',
        room_number: '301',
        room_price: 588.00,
        deposit: 500.00,
        payment_method: '支付宝',
        status: 'checked_in',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 20:30:00`,
        remarks: '演示数据'
      },
      {
        order_id: 'DEMO_H004',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '赵经理',
        phone: '13800138004',
        id_number: '110101199004044004',
        room_type: 'standard',
        room_number: '102',
        room_price: 288.00,
        deposit: 200.00,
        payment_method: '银行卡',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 18:45:00`,
        remarks: '演示数据'
      },
      // 休息房订单
      {
        order_id: 'DEMO_R001',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '陈先生',
        phone: '13800138005',
        id_number: '110101199005055005',
        room_type: 'rest',
        room_number: '201',
        room_price: 88.00,
        deposit: 50.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 13:20:00`,
        remarks: '演示数据'
      },
      {
        order_id: 'DEMO_R002',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '刘女士',
        phone: '13800138006',
        id_number: '110101199006066006',
        room_type: 'rest',
        room_number: '202',
        room_price: 88.00,
        deposit: 50.00,
        payment_method: '微信',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 15:40:00`,
        remarks: '演示数据'
      },
      {
        order_id: 'DEMO_R003',
        id_source: 'system',
        order_source: 'front_desk',
        guest_name: '周先生',
        phone: '13800138007',
        id_number: '110101199007077007',
        room_type: 'rest',
        room_number: '201',
        room_price: 88.00,
        deposit: 50.00,
        payment_method: '现金',
        status: 'checked_out',
        check_in_date: today,
        check_out_date: today,
        create_time: `${today} 19:10:00`,
        remarks: '演示数据'
      }
    ];

    // 插入订单数据
    for (const order of todayOrders) {
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

    // 生成历史交接班记录
    const historyRecords = [
      {
        type: 'hotel',
        cashier_name: '张收银',
        shift_time: '08:00',
        shift_date: yesterday,
        statistics: {
          reserveCash: 1000,
          hotelIncome: 1200,
          restIncome: 0,
          carRentalIncome: 0,
          totalIncome: 2200,
          hotelDeposit: 300,
          restDeposit: 0,
          retainedAmount: 100,
          handoverAmount: 1800,
          goodReviews: 5,
          vipCards: 2,
          totalRooms: 4,
          restRooms: 0
        },
        details: [],
        remarks: '演示数据 - 昨日早班交接'
      },
      {
        type: 'rest',
        cashier_name: '李收银',
        shift_time: '16:00',
        shift_date: yesterday,
        statistics: {
          reserveCash: 800,
          hotelIncome: 0,
          restIncome: 350,
          carRentalIncome: 50,
          totalIncome: 1200,
          hotelDeposit: 0,
          restDeposit: 80,
          retainedAmount: 50,
          handoverAmount: 1070,
          goodReviews: 3,
          vipCards: 1,
          totalRooms: 0,
          restRooms: 4
        },
        details: [],
        remarks: '演示数据 - 昨日晚班交接'
      }
    ];

    for (const record of historyRecords) {
      const sql = `
        INSERT INTO shift_handover (
          type, cashier_name, shift_time, shift_date,
          statistics, details, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await query(sql, [
        record.type, record.cashier_name, record.shift_time, record.shift_date,
        JSON.stringify(record.statistics), JSON.stringify(record.details), record.remarks
      ]);
    }

    console.log('✅ 演示数据生成完成！');
    console.log('\n📊 数据摘要：');

    // 统计今日数据
    const hotelIncome = todayOrders
      .filter(o => ['standard', 'deluxe', 'suite'].includes(o.room_type))
      .reduce((sum, o) => sum + o.room_price + o.deposit, 0);

    const restIncome = todayOrders
      .filter(o => o.room_type === 'rest')
      .reduce((sum, o) => sum + o.room_price + o.deposit, 0);

    const hotelCount = todayOrders.filter(o => ['standard', 'deluxe', 'suite'].includes(o.room_type)).length;
    const restCount = todayOrders.filter(o => o.room_type === 'rest').length;

    console.log(`📈 今日客房收入：¥${hotelIncome.toFixed(2)} (${hotelCount}间)`);
    console.log(`📈 今日休息房收入：¥${restIncome.toFixed(2)} (${restCount}间)`);
    console.log(`📋 历史记录：${historyRecords.length}条`);

    // 按支付方式统计
    const paymentStats = {};
    todayOrders.forEach(order => {
      const method = order.payment_method;
      const amount = order.room_price + order.deposit;
      paymentStats[method] = (paymentStats[method] || 0) + amount;
    });

    console.log('\n💳 支付方式统计：');
    Object.entries(paymentStats).forEach(([method, amount]) => {
      console.log(`   ${method}: ¥${amount.toFixed(2)}`);
    });

    console.log('\n🎯 现在可以访问系统的交接班页面查看演示效果！');
    console.log('   地址: http://localhost:9000/#/shift-handover');

  } catch (error) {
    console.error('❌ 生成演示数据失败:', error);
  }
}

// 运行演示数据生成
generateDemoData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
