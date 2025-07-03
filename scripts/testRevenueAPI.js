const axios = require('axios');

// 测试收入统计API
async function testRevenueAPI() {
  const baseURL = 'http://localhost:3000/api/revenue';
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log('🧪 开始测试收入统计API...\n');

  try {
    // 1. 测试快速统计
    console.log('1. 测试快速统计...');
    const quickStatsResponse = await axios.get(`${baseURL}/quick-stats`);
    console.log('✓ 快速统计API正常');
    console.log('  今日收入:', quickStatsResponse.data.data.today?.total_revenue || 0);
    console.log('  本周收入:', quickStatsResponse.data.data.thisWeek?.total_revenue || 0);
    console.log('  本月收入:', quickStatsResponse.data.data.thisMonth?.total_revenue || 0);

    // 2. 测试每日收入统计
    console.log('\n2. 测试每日收入统计...');
    const dailyResponse = await axios.get(`${baseURL}/daily`, {
      params: {
        startDate: lastMonth,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${dailyResponse.data.data.length} 条每日收入数据`);
    if (dailyResponse.data.data.length > 0) {
      console.log('  示例数据:', dailyResponse.data.data[0]);
    }

    // 3. 测试每周收入统计
    console.log('\n3. 测试每周收入统计...');
    const weeklyResponse = await axios.get(`${baseURL}/weekly`, {
      params: {
        startDate: lastMonth,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${weeklyResponse.data.data.length} 条每周收入数据`);

    // 4. 测试每月收入统计
    console.log('\n4. 测试每月收入统计...');
    const monthlyResponse = await axios.get(`${baseURL}/monthly`, {
      params: {
        startDate: lastMonth,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${monthlyResponse.data.data.length} 条每月收入数据`);

    // 5. 测试收入概览
    console.log('\n5. 测试收入概览...');
    const overviewResponse = await axios.get(`${baseURL}/overview`, {
      params: {
        startDate: lastMonth,
        endDate: today
      }
    });
    console.log('✓ 收入概览API正常');
    console.log('  总订单数:', overviewResponse.data.data.total_orders);
    console.log('  总收入:', overviewResponse.data.data.total_revenue);
    console.log('  平均订单价值:', overviewResponse.data.data.avg_order_value);

    // 6. 测试房型收入统计
    console.log('\n6. 测试房型收入统计...');
    const roomTypeResponse = await axios.get(`${baseURL}/room-type`, {
      params: {
        startDate: lastMonth,
        endDate: today
      }
    });
    console.log(`✓ 获取到 ${roomTypeResponse.data.data.length} 条房型收入数据`);
    if (roomTypeResponse.data.data.length > 0) {
      console.log('  示例房型数据:', roomTypeResponse.data.data[0]);
    }

    console.log('\n🎉 所有收入统计API测试通过！');

  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    if (error.response) {
      console.error('  状态码:', error.response.status);
      console.error('  错误信息:', error.response.data);
    }
  }
}

// 运行测试
if (require.main === module) {
  testRevenueAPI();
}

module.exports = testRevenueAPI;
