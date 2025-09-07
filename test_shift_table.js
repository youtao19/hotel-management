const { getShiftTable } = require('./backend/modules/shiftHandoverModule');

async function testShiftTable() {
  try {
    console.log('🧪 测试交接班表格数据 - 退押金显示...\n');

    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 测试日期: ${today}`);

    const tableData = await getShiftTable(today);

    console.log('\n📊 表格数据结构:');
    console.log(`日期: ${tableData.date}`);
    console.log(`订单记录数: ${Object.keys(tableData.records).length}`);
    console.log(`退押金记录数: ${tableData.refunds.length}`);

    if (Object.keys(tableData.records).length > 0) {
      console.log('\n💰 订单记录示例:');
      const firstRecord = Object.values(tableData.records)[0];
      console.log('  示例订单:', {
        order_id: firstRecord.order_id,
        guest_name: firstRecord.guest_name,
        stay_type: firstRecord.stay_type,
        deposit: firstRecord.deposit,
        payment_method: firstRecord.payment_method
      });
    }

    if (tableData.refunds.length > 0) {
      console.log('\n🔄 退押金记录:');
      tableData.refunds.forEach((refund, index) => {
        console.log(`  ${index + 1}. 订单${refund.order_id} (${refund.stay_type}): ${refund.change_price}元, 支付方式: ${refund.pay_way}, 客户: ${refund.guest_name}`);
      });

      // 按住宿类型分类统计
      const hotelRefunds = tableData.refunds.filter(r => r.stay_type === '客房');
      const restRefunds = tableData.refunds.filter(r => r.stay_type === '休息房');

      console.log('\n📈 退押金分类统计:');
      console.log(`  客房退押: ${hotelRefunds.length} 条记录, 总金额: ${hotelRefunds.reduce((sum, r) => sum + Math.abs(r.change_price), 0)} 元`);
      console.log(`  休息房退押: ${restRefunds.length} 条记录, 总金额: ${restRefunds.reduce((sum, r) => sum + Math.abs(r.change_price), 0)} 元`);
    } else {
      console.log('\n⚠️  今天没有退押金记录');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testShiftTable()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 测试过程出错:', error);
    process.exit(1);
  });
