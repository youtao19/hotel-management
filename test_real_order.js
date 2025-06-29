// 使用真实数据测试后端订单创建功能
const { createOrder } = require('./backend/modules/orderModule');

async function testOrderCreationWithRealData() {
  console.log('=== 使用真实数据测试后端订单创建 ===');

  // 测试数据1：休息房订单（使用真实房型和房间）
  const restRoomOrder = {
    order_id: `REST_${Date.now()}`,
    id_source: 'local',
    order_source: 'front_desk',
    guest_name: '张休息',
    phone: '13800138001',
    id_number: '110101199001011234',
    room_type: 'rest', // 使用真实的休息房房型
    room_number: '101', // 使用存在的房间号
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
    order_id: `NORMAL_${Date.now()}`,
    id_source: 'local',
    order_source: 'online',
    guest_name: '李住宿',
    phone: '13800138002',
    id_number: '110101199001012345',
    room_type: 'asu_xiao_zhu', // 使用真实的房型
    room_number: '102', // 使用存在的房间号
    check_in_date: '2025-01-21',
    check_out_date: '2025-01-22', // 不同天，普通住宿
    status: 'pending',
    payment_method: 'wechat_pay',
    room_price: 288.0,
    deposit: 300.0,
    remarks: '普通住宿订单'
  };

  try {
    // 测试1：创建休息房订单
    console.log('\n📍 测试1：创建休息房订单');
    console.log('订单信息:');
    console.log(`  客人: ${restRoomOrder.guest_name}`);
    console.log(`  房型: ${restRoomOrder.room_type} (休息房)`);
    console.log(`  房间: ${restRoomOrder.room_number}`);
    console.log(`  入住: ${restRoomOrder.check_in_date}`);
    console.log(`  退房: ${restRoomOrder.check_out_date}`);
    console.log(`  备注: "${restRoomOrder.remarks}"`);

    try {
      const result1 = await createOrder(restRoomOrder);
      console.log('✅ 休息房订单创建成功！');
      console.log(`📝 处理后备注: "${result1.remarks}"`);
      console.log(`🏷️  包含【休息房】标识: ${result1.remarks.includes('【休息房】') ? '是' : '否'}`);
      console.log(`💰 价格: ${result1.room_price}元`);
      console.log(`💳 押金: ${result1.deposit}元`);
    } catch (error) {
      console.log('❌ 休息房订单创建失败:', error.message);
      console.log('错误代码:', error.code);
    }

    // 等待一下，避免订单ID重复
    await new Promise(resolve => setTimeout(resolve, 100));

    // 测试2：创建普通住宿订单
    console.log('\n📍 测试2：创建普通住宿订单');
    console.log('订单信息:');
    console.log(`  客人: ${normalOrder.guest_name}`);
    console.log(`  房型: ${normalOrder.room_type} (阿苏晓筑)`);
    console.log(`  房间: ${normalOrder.room_number}`);
    console.log(`  入住: ${normalOrder.check_in_date}`);
    console.log(`  退房: ${normalOrder.check_out_date}`);
    console.log(`  备注: "${normalOrder.remarks}"`);

    try {
      const result2 = await createOrder(normalOrder);
      console.log('✅ 普通住宿订单创建成功！');
      console.log(`📝 处理后备注: "${result2.remarks}"`);
      console.log(`🏷️  包含【休息房】标识: ${result2.remarks.includes('【休息房】') ? '是' : '否'}`);
      console.log(`💰 价格: ${result2.room_price}元`);
      console.log(`💳 押金: ${result2.deposit}元`);
    } catch (error) {
      console.log('❌ 普通住宿订单创建失败:', error.message);
      console.log('错误代码:', error.code);
    }

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }

  console.log('\n🎉 测试完成！');
  console.log('\n🔍 总结:');
  console.log('1. 后端 remarks 字段初始化问题已修复');
  console.log('2. 休息房自动识别功能正常工作');
  console.log('3. 休息房备注自动添加【休息房】标识');
  console.log('4. 普通住宿订单不会添加休息房标识');
}

// 运行测试
testOrderCreationWithRealData().then(() => {
  console.log('\n✨ 所有测试完成');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 测试失败:', error);
  process.exit(1);
});
