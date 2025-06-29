// 测试后端订单创建功能（修复后）
const { createOrder } = require('./backend/modules/orderModule');

async function testOrderCreation() {
  console.log('=== 后端订单创建测试 ===');

  // 测试数据1：休息房订单
  const restRoomOrder = {
    order_id: `TEST_REST_${Date.now()}`,
    id_source: 'local',
    order_source: 'front_desk',
    guest_name: '测试客人',
    phone: '13800138001',
    id_number: '110101199001011234',
    room_type: 'standard_room',
    room_number: '101',
    check_in_date: '2025-01-20',
    check_out_date: '2025-01-20', // 同一天，应该是休息房
    status: 'pending',
    payment_method: 'cash',
    room_price: 88.0,
    deposit: 100.0,
    remarks: '客人要求安静房间'
  };

  // 测试数据2：普通住宿订单
  const normalOrder = {
    order_id: `TEST_NORMAL_${Date.now()}`,
    id_source: 'local',
    order_source: 'online',
    guest_name: '住宿客人',
    phone: '13800138002',
    id_number: '110101199001012345',
    room_type: 'standard_room',
    room_number: '102',
    check_in_date: '2025-01-21',
    check_out_date: '2025-01-22', // 不同天，普通住宿
    status: 'pending',
    payment_method: 'wechat_pay',
    room_price: 168.0,
    deposit: 200.0,
    remarks: '普通住宿订单'
  };

  try {
    // 测试1：创建休息房订单
    console.log('\n测试1：创建休息房订单');
    console.log('订单数据:', JSON.stringify(restRoomOrder, null, 2));

    try {
      const result1 = await createOrder(restRoomOrder);
      console.log('✅ 休息房订单创建成功');
      console.log('返回数据:', JSON.stringify(result1, null, 2));
      console.log('备注字段:', result1.remarks);
      console.log('是否包含【休息房】标识:', result1.remarks.includes('【休息房】'));
    } catch (error) {
      console.log('❌ 休息房订单创建失败:', error.message);
      if (error.code === 'INVALID_ROOM_TYPE' || error.code === 'INVALID_ROOM_NUMBER') {
        console.log('⚠️  这是因为测试环境中没有对应的房间数据，属于正常情况');
      }
    }

    // 测试2：创建普通住宿订单
    console.log('\n测试2：创建普通住宿订单');
    console.log('订单数据:', JSON.stringify(normalOrder, null, 2));

    try {
      const result2 = await createOrder(normalOrder);
      console.log('✅ 普通住宿订单创建成功');
      console.log('返回数据:', JSON.stringify(result2, null, 2));
      console.log('备注字段:', result2.remarks);
      console.log('是否包含【休息房】标识:', result2.remarks.includes('【休息房】'));
    } catch (error) {
      console.log('❌ 普通住宿订单创建失败:', error.message);
      if (error.code === 'INVALID_ROOM_TYPE' || error.code === 'INVALID_ROOM_NUMBER') {
        console.log('⚠️  这是因为测试环境中没有对应的房间数据，属于正常情况');
      }
    }

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }

  console.log('\n=== 测试完成 ===');
}

// 运行测试
testOrderCreation().then(() => {
  console.log('所有测试完成');
}).catch(error => {
  console.error('测试失败:', error);
});
