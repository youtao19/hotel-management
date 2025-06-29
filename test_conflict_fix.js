// 测试房间冲突检查修复
const { createOrder } = require('./backend/modules/orderModule');

async function testRoomConflictFix() {
  console.log('=== 测试房间冲突检查修复 ===');

  // 尝试创建一个使用房间110的订单（今天）
  const testOrder = {
    order_id: `T110${Date.now().toString().slice(-8)}`, // 缩短订单ID
    id_source: 'local',
    order_source: 'front_desk',
    guest_name: '测试客人110',
    phone: '13800138010',
    id_number: '110101199001011999',
    room_type: 'asu_xiao_zhu',
    room_number: '110',
    check_in_date: '2025-06-29',
    check_out_date: '2025-06-29', // 休息房
    status: 'pending',
    payment_method: 'cash',
    room_price: 144.0,  // 休息房半价
    deposit: 50.0,
    remarks: '测试房间110冲突修复'
  };

  console.log('\n📍 测试创建房间110的订单');
  console.log('房间110目前应该是已退房状态，可以重新预订');
  console.log('订单信息:');
  console.log(`  客人: ${testOrder.guest_name}`);
  console.log(`  房间: ${testOrder.room_number}`);
  console.log(`  日期: ${testOrder.check_in_date} (休息房)`);

  try {
    const result = await createOrder(testOrder);
    console.log('✅ 房间110订单创建成功！');
    console.log(`📝 订单ID: ${result.order_id}`);
    console.log(`📝 备注: "${result.remarks}"`);
    console.log(`💰 价格: ${result.room_price}元`);
    console.log(`🏷️  状态: ${result.status}`);

    console.log('\n🎉 修复成功！已退房的房间现在可以重新预订了。');

  } catch (error) {
    console.log('❌ 房间110订单创建失败:', error.message);
    console.log('错误代码:', error.code);

    if (error.message.includes('已被其他订单占用') || error.message.includes('已被预订')) {
      console.log('⚠️  仍然存在冲突检查问题，需要进一步调试');
    }
  }

  console.log('\n🔍 总结:');
  console.log('1. 修改了冲突检查SQL，排除已退房(checked-out)和已取消(cancelled)的订单');
  console.log('2. 确保已退房的房间可以重新预订');
  console.log('3. 保持对待入住(pending)和已入住(checked-in)订单的冲突检查');
}

// 运行测试
testRoomConflictFix().then(() => {
  console.log('\n✨ 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 测试失败:', error);
  process.exit(1);
});
