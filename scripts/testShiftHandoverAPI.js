const axios = require('axios');

// 测试交接班API接口
async function testShiftHandoverAPI() {
  const baseURL = 'http://localhost:3000/api/shift-handover';
  const today = new Date().toISOString().split('T')[0];

  console.log('=== 测试交接班API接口 ===');
  console.log(`测试日期: ${today}`);

  try {
    // 1. 测试获取收款明细
    console.log('\n1. 测试获取客房收款明细...');
    const receiptsResponse = await axios.get(`${baseURL}/receipts`, {
      params: {
        type: 'hotel',
        startDate: today,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${receiptsResponse.data.length} 条客房明细`);
    if (receiptsResponse.data.length > 0) {
      console.log('  示例明细:', receiptsResponse.data[0]);
    }

    // 2. 测试获取休息房明细
    console.log('\n2. 测试获取休息房收款明细...');
    const restReceiptsResponse = await axios.get(`${baseURL}/receipts`, {
      params: {
        type: 'rest',
        startDate: today,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${restReceiptsResponse.data.length} 条休息房明细`);

    // 3. 测试获取统计数据
    console.log('\n3. 测试获取统计数据...');
    const statisticsResponse = await axios.get(`${baseURL}/statistics`, {
      params: { date: today }
    });
    console.log('✓ 统计数据:', statisticsResponse.data);

    // 4. 测试保存交接班记录
    console.log('\n4. 测试保存交接班记录...');
    const handoverData = {
      type: 'hotel',
      details: receiptsResponse.data,
      statistics: statisticsResponse.data,
      remarks: '测试交接班记录',
      cashier_name: '测试收银员',
      shift_time: '09:00',
      shift_date: today
    };

    const saveResponse = await axios.post(`${baseURL}/save`, handoverData);
    console.log('✓ 保存结果:', saveResponse.data);

    // 5. 测试获取历史记录
    console.log('\n5. 测试获取历史记录...');
    const historyResponse = await axios.get(`${baseURL}/history`, {
      params: {
        startDate: today,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${historyResponse.data.length} 条历史记录`);

    console.log('\n=== 所有测试通过 ===');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

// 运行测试
testShiftHandoverAPI();
