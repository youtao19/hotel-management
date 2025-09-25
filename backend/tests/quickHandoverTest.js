#!/usr/bin/env node

/**
 * 快速交接班金额测试脚本
 *
 * 这个脚本可以快速创建测试数据并验证交接班金额计算
 * 用于调试和验证特定场景下的计算逻辑
 *
 * 使用方法：
 * node backend/tests/quickHandoverTest.js
 */

const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

/**
 * 快速测试特定场景
 */
async function quickTest() {
  console.log('🚀 开始快速交接班金额测试...\n');

  try {
    // 清理测试数据
    await query('TRUNCATE TABLE bills, orders, handover, rooms, room_types RESTART IDENTITY CASCADE');
    console.log('✅ 测试数据已清理\n');

    // 测试日期
    const testDate = '2024-01-15';
    const prevDate = '2024-01-14';

    console.log(`📅 测试日期: ${testDate}`);
    console.log(`📅 前一天日期: ${prevDate}\n`);

    // 1. 设置前一天的交接款
    await query(`
      INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
      ('${prevDate}', 1, 1000, '测试交班人', '测试接班人'),
      ('${prevDate}', 2, 1500, '测试交班人', '测试接班人'),
      ('${prevDate}', 3, 500, '测试交班人', '测试接班人'),
      ('${prevDate}', 4, 200, '测试交班人', '测试接班人')
    `);
    console.log('💰 前日交接款已设置：');
    console.log('  现金: 1000, 微信: 1500, 微邮付: 500, 其他: 200\n');

    // 2. 创建房型和房间
    const roomType1 = await createTestRoomType({
      type_code: 'STD',
      type_name: '标准间',
      base_price: '288.00'
    });
    const roomType2 = await createTestRoomType({
      type_code: 'DLX',
      type_name: '豪华间',
      base_price: '388.00'
    });

    const room1 = await createTestRoom(roomType1.type_code, { room_number: '201' });
    const room2 = await createTestRoom(roomType1.type_code, { room_number: '202' });
    const room3 = await createTestRoom(roomType2.type_code, { room_number: '301' });

    console.log('🏨 房型和房间已创建\n');

    // 3. 创建测试订单
    const orders = [
      {
        room: room1,
        type: roomType1.type_code,
        price: 450,
        deposit: 100,
        stay_type: '客房',
        pay_way: '现金'
      },
      {
        room: room2,
        type: roomType1.type_code,
        price: 320,
        deposit: 80,
        stay_type: '休息房',
        pay_way: '微信'
      },
      {
        room: room3,
        type: roomType2.type_code,
        price: 580,
        deposit: 150,
        stay_type: '客房',
        pay_way: '微邮付'
      }
    ];

    console.log('📝 创建测试订单：');
    const createdOrders = [];
    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];
      const order = await createTestOrder({
        room_number: orderData.room.room_number,
        room_type: orderData.type,
        check_in_date: testDate,
        total_price: orderData.price,
        deposit: orderData.deposit
      }, { insert: true });

      // 创建账单
      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time)
        VALUES ($1, $2, $3, $4, '订单账单', $5, $6, $7, $8, NOW())
      `, [
        order.order_id,
        orderData.room.room_number,
        orderData.pay_way,
        orderData.price,
        orderData.deposit,
        orderData.stay_type,
        orderData.price - orderData.deposit,
        testDate
      ]);

      createdOrders.push({ ...order, ...orderData });
      console.log(`  订单${i+1}: ${orderData.room.room_number}房间, ${orderData.pay_way}支付${orderData.price}元, ${orderData.stay_type}`);
    }

    // 4. 添加退押金记录
    await query(`
      INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time)
      VALUES ($1, $2, '现金', 50, '退押', 0, '客房', 0, $3, NOW())
    `, [createdOrders[0].order_id, createdOrders[0].room.room_number, testDate]);

    console.log('  退押: 201房间退现金50元\n');

    // 5. 调用API获取计算结果
    console.log('🔄 调用交接班API计算金额...\n');
    const res = await request(app)
      .get(`/api/handover/table?date=${testDate}`);

    if (res.status !== 200) {
      throw new Error(`API调用失败: ${res.status} - ${res.body.message}`);
    }

    const data = res.body.data;

    // 6. 显示计算结果
    console.log('📊 计算结果：\n');

    console.log('💰 备用金：');
    Object.keys(data.reserve).forEach(key => {
      console.log(`  ${key}: ${data.reserve[key]}`);
    });

    console.log('\n🏨 客房收入：');
    Object.keys(data.hotelIncome).forEach(key => {
      if (data.hotelIncome[key] > 0) {
        console.log(`  ${key}: ${data.hotelIncome[key]}`);
      }
    });

    console.log('\n🛏️ 休息房收入：');
    Object.keys(data.restIncome).forEach(key => {
      if (data.restIncome[key] > 0) {
        console.log(`  ${key}: ${data.restIncome[key]}`);
      }
    });

    console.log('\n📈 总收入：');
    Object.keys(data.totalIncome).forEach(key => {
      console.log(`  ${key}: ${data.totalIncome[key]}`);
    });

    console.log('\n↩️ 客房退押：');
    Object.keys(data.hotelDeposit).forEach(key => {
      if (data.hotelDeposit[key] > 0) {
        console.log(`  ${key}: ${data.hotelDeposit[key]}`);
      }
    });

    console.log('\n💼 交接款：');
    Object.keys(data.handoverAmount).forEach(key => {
      console.log(`  ${key}: ${data.handoverAmount[key]}`);
    });

    // 7. 手动验证计算
    console.log('\n🔍 手动验证计算：');

    const expectedResults = {
      '现金': {
        reserve: 1000,
        hotelIncome: 450,
        totalIncome: 1450,
        hotelDeposit: 50,
        handover: 1450 - 50 - 320 // 总收入 - 退押 - 留存款
      },
      '微信': {
        reserve: 1500,
        restIncome: 320,
        totalIncome: 1820,
        handover: 1820
      },
      '微邮付': {
        reserve: 500,
        hotelIncome: 580,
        totalIncome: 1080,
        handover: 1080
      },
      '其他': {
        reserve: 200,
        totalIncome: 200,
        handover: 200
      }
    };

    let allCorrect = true;
    Object.keys(expectedResults).forEach(paymentMethod => {
      const expected = expectedResults[paymentMethod];
      const actual = data;

      console.log(`\n${paymentMethod}：`);

      // 验证备用金
      if (actual.reserve[paymentMethod] === expected.reserve) {
        console.log(`  ✅ 备用金: ${actual.reserve[paymentMethod]} (正确)`);
      } else {
        console.log(`  ❌ 备用金: ${actual.reserve[paymentMethod]}, 期望: ${expected.reserve}`);
        allCorrect = false;
      }

      // 验证总收入
      if (actual.totalIncome[paymentMethod] === expected.totalIncome) {
        console.log(`  ✅ 总收入: ${actual.totalIncome[paymentMethod]} (正确)`);
      } else {
        console.log(`  ❌ 总收入: ${actual.totalIncome[paymentMethod]}, 期望: ${expected.totalIncome}`);
        allCorrect = false;
      }

      // 验证交接款
      if (actual.handoverAmount[paymentMethod] === expected.handover) {
        console.log(`  ✅ 交接款: ${actual.handoverAmount[paymentMethod]} (正确)`);
      } else {
        console.log(`  ❌ 交接款: ${actual.handoverAmount[paymentMethod]}, 期望: ${expected.handover}`);
        allCorrect = false;
      }
    });

    console.log(`\n${allCorrect ? '🎉' : '⚠️'} 测试${allCorrect ? '通过' : '失败'}！`);

  } catch (error) {
    console.error('❌ 测试过程中出现错误：', error.message);
    console.error(error.stack);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('欢迎使用快速交接班金额测试脚本！\n');

  quickTest()
    .then(() => {
      console.log('\n🏁 测试完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 测试失败：', error);
      process.exit(1);
    });
}

module.exports = { quickTest };
