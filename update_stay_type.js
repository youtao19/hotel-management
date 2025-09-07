const { query } = require('./backend/database/postgreDB/pg');

async function updateExistingOrdersStayType() {
  try {
    console.log('🔄 开始更新现有订单的 stay_type 字段...\n');

    // 首先检查有多少订单的 stay_type 为 null
    const nullStayTypeCount = await query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE stay_type IS NULL
    `);

    console.log(`📊 发现 ${nullStayTypeCount.rows[0].count} 个订单的 stay_type 为 null`);

    if (nullStayTypeCount.rows[0].count > 0) {
      // 更新 stay_type 字段 - 基于日期逻辑
      const updateResult = await query(`
        UPDATE orders
        SET stay_type = CASE
          WHEN check_in_date::date = check_out_date::date THEN '休息房'
          ELSE '客房'
        END
        WHERE stay_type IS NULL
        RETURNING order_id, check_in_date, check_out_date, stay_type
      `);

      console.log(`✅ 已更新 ${updateResult.rows.length} 个订单的 stay_type 字段:\n`);

      // 显示前10个更新的订单
      updateResult.rows.slice(0, 10).forEach(order => {
        console.log(`  - ${order.order_id}: ${order.check_in_date} -> ${order.check_out_date} = ${order.stay_type}`);
      });

      if (updateResult.rows.length > 10) {
        console.log(`  ... 还有 ${updateResult.rows.length - 10} 个订单已更新`);
      }
    }

    // 验证更新结果
    const verification = await query(`
      SELECT
        stay_type,
        COUNT(*) as count
      FROM orders
      GROUP BY stay_type
      ORDER BY stay_type
    `);

    console.log('\n📈 更新后的订单类型分布:');
    verification.rows.forEach(row => {
      console.log(`  ${row.stay_type || 'NULL'}: ${row.count} 个订单`);
    });

    // 现在重新测试交接班统计
    console.log('\n🧪 重新测试交接班统计...');

    const { getStatistics } = require('./backend/modules/shiftHandoverModule');
    const today = new Date().toISOString().split('T')[0];
    const stats = await getStatistics(today);

    console.log('\n✅ 更新后的统计结果:');
    console.log(`客房退押: ${stats.hotelDeposit}`);
    console.log(`休息房退押: ${stats.restDeposit}`);

    console.log('\n📋 按支付方式分类的退押金:');
    Object.entries(stats.paymentDetails).forEach(([method, details]) => {
      if (details.hotelDeposit > 0 || details.restDeposit > 0) {
        console.log(`  ${method}:`);
        console.log(`    - 客房退押: ${details.hotelDeposit}`);
        console.log(`    - 休息房退押: ${details.restDeposit}`);
      }
    });

  } catch (error) {
    console.error('❌ 更新失败:', error);
  }
}

// 运行更新
updateExistingOrdersStayType()
  .then(() => {
    console.log('\n✅ 更新完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 更新过程出错:', error);
    process.exit(1);
  });
