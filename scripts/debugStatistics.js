const { query } = require('../backend/database/postgreDB/pg');
const shiftHandoverModule = require('../backend/modules/shiftHandoverModule');

async function debugStatistics() {
  try {
    console.log('开始调试统计功能...');

    const today = new Date().toISOString().split('T')[0];
    console.log('Today date:', today);

    // 查看数据库中的订单数据
    const ordersResult = await query(
      "SELECT * FROM orders WHERE order_id LIKE 'MODULE_TEST_%'",
      []
    );
    console.log('Orders in database:', ordersResult.rows);

    // 查看今天的订单
    const todayOrdersResult = await query(
      "SELECT *, DATE(create_time) as create_date FROM orders WHERE DATE(create_time) = $1",
      [today]
    );
    console.log('Orders created today:', todayOrdersResult.rows);

    // 测试统计计算
    const statistics = await shiftHandoverModule.getStatistics(today, today);
    console.log('Statistics result:', statistics);

  } catch (error) {
    console.error('调试失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  debugStatistics().then(() => {
    console.log('调试完成');
    process.exit(0);
  }).catch(error => {
    console.error('调试错误:', error);
    process.exit(1);
  });
}

module.exports = debugStatistics;
