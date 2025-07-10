const { saveHandover, exportNewHandoverToExcel } = require('../backend/modules/shiftHandoverModule');
const fs = require('fs');

async function testNewShiftHandover() {
  console.log('🧪 开始测试新版交接班功能...');

  // 测试数据
  const testHandoverData = {
    date: '2024-01-15',
    shift: '白班',
    handoverPerson: '张三',
    receivePerson: '李四',
    cashierName: '王五',
    notes: '今日客流量较大，需要注意房间清洁速度',
    paymentData: {
      cash: {
        reserveCash: 320,
        hotelIncome: 1200,
        restIncome: 100,
        total: 1620,
        hotelDeposit: 80,
        restDeposit: 20,
        retainedAmount: 320
      },
      wechat: {
        reserveCash: 0,
        hotelIncome: 2523,
        restIncome: 0,
        total: 2523,
        hotelDeposit: 20,
        restDeposit: 0,
        retainedAmount: 2503
      },
      digital: {
        reserveCash: 0,
        hotelIncome: 300,
        restIncome: 160,
        total: 460,
        hotelDeposit: 0,
        restDeposit: 0,
        retainedAmount: 460
      },
      other: {
        reserveCash: 0,
        hotelIncome: 150,
        restIncome: 50,
        total: 200,
        hotelDeposit: 0,
        restDeposit: 0,
        retainedAmount: 200
      }
    },
    totalSummary: {
      reserveCash: 320,
      hotelIncome: 4173,
      restIncome: 310,
      grandTotal: 4803,
      hotelDeposit: 100,
      restDeposit: 20,
      retainedAmount: 3483
    },
    handoverAmount: 1200,
    specialStats: {
      totalRooms: 29,
      restRooms: 3,
      vipCards: 6
    }
  };

  try {
    // 测试保存功能
    console.log('💾 测试保存交接班记录...');
    const savedRecord = await saveHandover(testHandoverData);
    console.log('✅ 保存成功，记录ID:', savedRecord.id);

    // 测试导出功能
    console.log('📊 测试导出Excel功能...');
    const excelBuffer = await exportNewHandoverToExcel(testHandoverData);

    // 保存Excel文件到本地进行验证
    const fileName = `test_shift_handover_${testHandoverData.date}_${testHandoverData.shift}.xlsx`;
    fs.writeFileSync(fileName, excelBuffer);
    console.log('✅ Excel导出成功，文件名:', fileName);

    console.log('🎉 所有测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testNewShiftHandover().then(() => {
    console.log('测试完成');
    process.exit(0);
  }).catch(error => {
    console.error('测试出错:', error);
    process.exit(1);
  });
}

module.exports = { testNewShiftHandover };
