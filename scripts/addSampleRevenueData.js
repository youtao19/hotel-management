const { query } = require('../backend/database/postgreDB/pg');

// 添加示例收入数据
async function addSampleRevenueData() {
  console.log('🎯 开始添加示例收入数据...\n');

  try {
    // 首先获取现有的订单
    const existingOrders = await query('SELECT order_id, room_number, guest_name FROM orders ORDER BY create_time DESC');
    console.log(`找到 ${existingOrders.rows.length} 个现有订单`);

    if (existingOrders.rows.length === 0) {
      console.log('❌ 没有找到现有订单，无法创建账单数据');
      return;
    }

    // 为现有订单创建账单数据（如果还没有账单的话）
    const paymentMethods = ['现金', '微信', '支付宝', '信用卡'];
    const sampleBills = [];

    for (const order of existingOrders.rows) {
      // 检查是否已有账单
      const existingBill = await query('SELECT order_id FROM bills WHERE order_id = $1', [order.order_id]);

      if (existingBill.rows.length === 0) {
        const deposit = Math.floor(Math.random() * 200) + 100; // 100-300押金
        const roomFee = Math.floor(Math.random() * 300) + 200; // 200-500房费
        const totalIncome = roomFee + Math.floor(Math.random() * 100); // 房费+其他费用
        const payWay = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        const refundDeposit = Math.random() > 0.3; // 70%概率退押金

        // 创建时间设为过去几天的随机时间
        const createTime = new Date();
        createTime.setDate(createTime.getDate() - Math.floor(Math.random() * 30));
        createTime.setHours(Math.floor(Math.random() * 24));
        createTime.setMinutes(Math.floor(Math.random() * 60));

        sampleBills.push({
          orderId: order.order_id,
          roomNumber: order.room_number,
          guestName: order.guest_name,
          deposit,
          refundDeposit,
          roomFee,
          totalIncome,
          payWay,
          createTime,
          remarks: `示例账单数据 - ${createTime.toLocaleDateString()}`
        });
      }
    }

    console.log(`准备为 ${sampleBills.length} 个订单创建账单数据...`);

    // 批量插入账单数据
    let successCount = 0;
    for (const bill of sampleBills) {
      try {
        await query(`
          INSERT INTO bills (order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, create_time, remarks)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          bill.orderId,
          bill.roomNumber,
          bill.guestName,
          bill.deposit,
          bill.refundDeposit,
          bill.roomFee,
          bill.totalIncome,
          bill.payWay,
          bill.createTime,
          bill.remarks
        ]);
        successCount++;
      } catch (error) {
        console.error(`插入账单 ${bill.orderId} 失败:`, error.message);
      }
    }

    console.log(`✅ 成功创建 ${successCount} 条账单数据`);

    // 如果没有足够的数据，创建一些额外的历史账单数据（不依赖订单表）
    if (successCount < 20) {
      console.log('📈 创建额外的历史账单数据...');

      // 临时禁用外键约束检查，插入一些历史数据
      await query('SET session_replication_role = replica;');

      const additionalBills = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        // 每天1-3个账单
        const billsPerDay = Math.floor(Math.random() * 3) + 1;

        for (let j = 0; j < billsPerDay; j++) {
          const orderId = `HIST${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(j + 1).padStart(3, '0')}`;
          const roomNumber = `${Math.floor(Math.random() * 3) + 1}${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
          const guestName = `历史客人${Math.floor(Math.random() * 1000)}`;
          const deposit = Math.floor(Math.random() * 200) + 100;
          const roomFee = Math.floor(Math.random() * 300) + 200;
          const totalIncome = roomFee + Math.floor(Math.random() * 100);
          const payWay = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
          const refundDeposit = Math.random() > 0.3;

          const createTime = new Date(date);
          createTime.setHours(Math.floor(Math.random() * 24));
          createTime.setMinutes(Math.floor(Math.random() * 60));

          try {
            await query(`
              INSERT INTO bills (order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, create_time, remarks)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
              orderId,
              roomNumber,
              guestName,
              deposit,
              refundDeposit,
              roomFee,
              totalIncome,
              payWay,
              createTime,
              `历史数据 - ${date.toLocaleDateString()}`
            ]);
            successCount++;
          } catch (error) {
            // 忽略错误，继续插入
          }
        }
      }

      // 重新启用外键约束检查
      await query('SET session_replication_role = DEFAULT;');

      console.log(`✅ 总共创建了 ${successCount} 条账单数据`);
    }

    // 统计插入结果
    const totalBills = await query('SELECT COUNT(*) as count FROM bills');
    const recentBills = await query(`
      SELECT COUNT(*) as count
      FROM bills
      WHERE create_time >= $1
    `, [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]);

    console.log(`✅ 示例数据添加完成！`);
    console.log(`📊 数据库中总账单数: ${totalBills.rows[0].count}`);
    console.log(`📅 最近30天账单数: ${recentBills.rows[0].count}`);

    // 显示收入统计
    const revenueStats = await query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_income) as total_revenue,
        AVG(total_income) as avg_order_value
      FROM bills
      WHERE create_time >= $1
    `, [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]);

    const stats = revenueStats.rows[0];
    console.log(`💰 最近30天收入统计:`);
    console.log(`   总订单数: ${stats.total_orders}`);
    console.log(`   总收入: ¥${Number(stats.total_revenue || 0).toFixed(2)}`);
    console.log(`   平均订单价值: ¥${Number(stats.avg_order_value || 0).toFixed(2)}`);

    // 支付方式分布
    const paymentStats = await query(`
      SELECT
        pay_way,
        COUNT(*) as count,
        SUM(total_income) as revenue
      FROM bills
      WHERE create_time >= $1
      GROUP BY pay_way
      ORDER BY revenue DESC
    `, [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]);

    console.log(`💳 支付方式分布:`);
    paymentStats.rows.forEach(row => {
      console.log(`   ${row.pay_way}: ${row.count}单, ¥${Number(row.revenue).toFixed(2)}`);
    });

  } catch (error) {
    console.error('❌ 添加示例数据失败:', error);
  }
}

// 运行脚本
if (require.main === module) {
  addSampleRevenueData().then(() => {
    console.log('\n🎉 脚本执行完成！');
    process.exit(0);
  }).catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = addSampleRevenueData;
