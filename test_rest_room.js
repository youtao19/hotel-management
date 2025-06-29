/**
 * 休息房功能测试
 * 测试休息房的创建、识别和处理逻辑
 */

// 模拟isRestRoom函数
function isRestRoom(orderData) {
  const checkInDate = new Date(orderData.check_in_date);
  const checkOutDate = new Date(orderData.check_out_date);

  // 比较日期部分，忽略时间
  const checkInDateStr = checkInDate.toISOString().split('T')[0];
  const checkOutDateStr = checkOutDate.toISOString().split('T')[0];

  return checkInDateStr === checkOutDateStr;
}

// 测试数据
const testOrders = [
  // 休息房订单（同一天入住和退房）
  {
    check_in_date: '2025-06-29',
    check_out_date: '2025-06-29',
    guest_name: '张休息',
    room_number: '101'
  },
  // 普通订单（跨夜）
  {
    check_in_date: '2025-06-29',
    check_out_date: '2025-06-30',
    guest_name: '李住宿',
    room_number: '102'
  },
  // 多天订单
  {
    check_in_date: '2025-06-29',
    check_out_date: '2025-07-01',
    guest_name: '王多天',
    room_number: '103'
  }
];

console.log('=== 休息房识别测试 ===');
testOrders.forEach((order, index) => {
  const isRest = isRestRoom(order);
  console.log(`订单 ${index + 1}:`);
  console.log(`  客人: ${order.guest_name}`);
  console.log(`  入住: ${order.check_in_date}`);
  console.log(`  退房: ${order.check_out_date}`);
  console.log(`  类型: ${isRest ? '休息房' : '住宿'}`);
  console.log('');
});

console.log('=== 休息房备注处理测试 ===');
function processRestRoomRemarks(orderData) {
  let processedRemarks = orderData.remarks || '';
  if (isRestRoom(orderData)) {
    if (!processedRemarks.includes('【休息房】')) {
      processedRemarks = '【休息房】' + (processedRemarks ? ' ' + processedRemarks : '');
    }
  }
  return processedRemarks;
}

const testRemarksOrders = [
  {
    check_in_date: '2025-06-29',
    check_out_date: '2025-06-29',
    remarks: ''
  },
  {
    check_in_date: '2025-06-29',
    check_out_date: '2025-06-29',
    remarks: '客人要求安静房间'
  },
  {
    check_in_date: '2025-06-29',
    check_out_date: '2025-06-30',
    remarks: '普通住宿订单'
  }
];

testRemarksOrders.forEach((order, index) => {
  const processed = processRestRoomRemarks(order);
  console.log(`测试 ${index + 1}:`);
  console.log(`  原备注: "${order.remarks}"`);
  console.log(`  处理后: "${processed}"`);
  console.log(`  是否休息房: ${isRestRoom(order)}`);
  console.log('');
});

console.log('测试完成！');
