/**
 * 交接班金额验证脚本
 *
 * 这个脚本可以帮助您验证特定日期的交接班金额计算是否正确
 * 使用方法：node backend/tests/validateHandoverAmount.js [日期]
 *
 * 示例：
 * node backend/tests/validateHandoverAmount.js 2024-01-01
 */

const { query } = require('../database/postgreDB/pg');

/**
 * 验证指定日期的交接班金额计算
 * @param {string} date - 日期 YYYY-MM-DD
 */
async function validateHandoverAmount(date) {
  console.log(`\n🔍 验证日期 ${date} 的交接班金额计算...\n`);

  try {
    // 1. 获取前一天日期
    const prevDate = getPreviousDateString(date);
    console.log(`📅 前一天日期：${prevDate}`);

    // 2. 查询前一天的交接款（作为今天的备用金）
    const reserveQuery = `
      SELECT payment_type, handover
      FROM handover
      WHERE date = $1::date AND payment_type IN (1,2,3,4)
      ORDER BY payment_type
    `;
    const reserveResult = await query(reserveQuery, [prevDate]);

    console.log(`\n💰 备用金（来自前日交接款）：`);
    const paymentTypes = { 1: '现金', 2: '微信', 3: '微邮付', 4: '其他' };
    let reserve = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };

    if (reserveResult.rows.length > 0) {
      reserveResult.rows.forEach(row => {
        const paymentName = paymentTypes[row.payment_type];
        reserve[paymentName] = Number(row.handover) || 0;
        console.log(`  ${paymentName}: ${reserve[paymentName]}`);
      });
    } else {
      console.log(`  无前日交接款数据，备用金全部为0`);
    }

    // 3. 查询当天的账单数据
    const billQuery = `
      SELECT
        pay_way,
        change_price,
        change_type,
        deposit,
        stay_type,
        room_fee
      FROM bills
      WHERE stay_date::date = $1::date
      ORDER BY bill_id
    `;
    const billResult = await query(billQuery, [date]);

    console.log(`\n📊 当天账单数据：`);
    console.log(`  共找到 ${billResult.rows.length} 条账单记录`);

    // 4. 计算各项收入和支出
    let hotelIncome = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };
    let restIncome = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };
    let hotelDeposit = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };
    let restDeposit = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };

    billResult.rows.forEach(row => {
      const { pay_way, change_price, change_type, deposit, stay_type, room_fee } = row;
      const amount = Number(change_price) || 0;

      if (change_type === '订单账单') {
        if (stay_type === '客房') {
          hotelIncome[pay_way] += amount;
        } else if (stay_type === '休息房') {
          restIncome[pay_way] += amount;
        }
      } else if (change_type === '退押') {
        if (stay_type === '客房') {
          hotelDeposit[pay_way] += amount;
        } else if (stay_type === '休息房') {
          restDeposit[pay_way] += amount;
        }
      }
    });

    // 5. 显示收入统计
    console.log(`\n🏨 客房收入：`);
    Object.keys(hotelIncome).forEach(key => {
      if (hotelIncome[key] > 0) {
        console.log(`  ${key}: ${hotelIncome[key]}`);
      }
    });

    console.log(`\n🛏️ 休息房收入：`);
    Object.keys(restIncome).forEach(key => {
      if (restIncome[key] > 0) {
        console.log(`  ${key}: ${restIncome[key]}`);
      }
    });

    console.log(`\n↩️ 客房退押：`);
    Object.keys(hotelDeposit).forEach(key => {
      if (hotelDeposit[key] > 0) {
        console.log(`  ${key}: ${hotelDeposit[key]}`);
      }
    });

    console.log(`\n↩️ 休息房退押：`);
    Object.keys(restDeposit).forEach(key => {
      if (restDeposit[key] > 0) {
        console.log(`  ${key}: ${restDeposit[key]}`);
      }
    });

    // 6. 计算总收入和交接款
    console.log(`\n📈 计算结果：`);
    console.log(`${'支付方式'.padEnd(8)} ${'备用金'.padEnd(8)} ${'客房收入'.padEnd(8)} ${'休息房收入'.padEnd(10)} ${'总收入'.padEnd(8)} ${'客房退押'.padEnd(8)} ${'休息房退押'.padEnd(10)} ${'留存款'.padEnd(8)} ${'交接款'.padEnd(8)}`);
    console.log(`${'─'.repeat(100)}`);

    let totalHandover = 0;
    Object.keys(reserve).forEach(paymentMethod => {
      const reserveAmount = reserve[paymentMethod];
      const hotelIncomeAmount = hotelIncome[paymentMethod];
      const restIncomeAmount = restIncome[paymentMethod];
      const totalIncomeAmount = reserveAmount + hotelIncomeAmount + restIncomeAmount;
      const hotelDepositAmount = hotelDeposit[paymentMethod];
      const restDepositAmount = restDeposit[paymentMethod];

      // 现金留存款320，其他为0
      const retainedAmount = paymentMethod === '现金' ? 320 : 0;
      const handoverAmount = totalIncomeAmount - hotelDepositAmount - restDepositAmount - retainedAmount;

      totalHandover += handoverAmount;

      console.log(
        `${paymentMethod.padEnd(8)} ` +
        `${reserveAmount.toString().padEnd(8)} ` +
        `${hotelIncomeAmount.toString().padEnd(8)} ` +
        `${restIncomeAmount.toString().padEnd(10)} ` +
        `${totalIncomeAmount.toString().padEnd(8)} ` +
        `${hotelDepositAmount.toString().padEnd(8)} ` +
        `${restDepositAmount.toString().padEnd(10)} ` +
        `${retainedAmount.toString().padEnd(8)} ` +
        `${handoverAmount.toString().padEnd(8)}`
      );
    });

    console.log(`${'─'.repeat(100)}`);
    console.log(`💰 总交接款：${totalHandover}`);

    // 7. 对比数据库中的记录（如果存在）
    const dbHandoverQuery = `
      SELECT payment_type, handover, reserve_cash, room_income, rest_income,
             total_income, room_refund, rest_refund, retained
      FROM handover
      WHERE date = $1::date AND payment_type IN (1,2,3,4)
      ORDER BY payment_type
    `;
    const dbHandoverResult = await query(dbHandoverQuery, [date]);

    if (dbHandoverResult.rows.length > 0) {
      console.log(`\n📋 数据库中的交接班记录：`);
      console.log(`${'支付方式'.padEnd(8)} ${'数据库交接款'.padEnd(12)} ${'计算交接款'.padEnd(12)} ${'差异'.padEnd(8)}`);
      console.log(`${'─'.repeat(50)}`);

      dbHandoverResult.rows.forEach(row => {
        const paymentName = paymentTypes[row.payment_type];
        const dbHandoverAmount = Number(row.handover) || 0;

        // 重新计算这个支付方式的交接款
        const reserveAmount = reserve[paymentName];
        const hotelIncomeAmount = hotelIncome[paymentName];
        const restIncomeAmount = restIncome[paymentName];
        const totalIncomeAmount = reserveAmount + hotelIncomeAmount + restIncomeAmount;
        const hotelDepositAmount = hotelDeposit[paymentName];
        const restDepositAmount = restDeposit[paymentName];
        const retainedAmount = paymentName === '现金' ? 320 : 0;
        const calculatedHandoverAmount = totalIncomeAmount - hotelDepositAmount - restDepositAmount - retainedAmount;

        const difference = dbHandoverAmount - calculatedHandoverAmount;
        const status = difference === 0 ? '✅' : '❌';

        console.log(
          `${paymentName.padEnd(8)} ` +
          `${dbHandoverAmount.toString().padEnd(12)} ` +
          `${calculatedHandoverAmount.toString().padEnd(12)} ` +
          `${difference.toString().padEnd(8)} ${status}`
        );
      });
    } else {
      console.log(`\n📋 数据库中无该日期的交接班记录`);
    }

    console.log(`\n✅ 验证完成！`);

  } catch (error) {
    console.error(`❌ 验证过程中出现错误：`, error.message);
  }
}

/**
 * 获取前一天的日期字符串
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string} YYYY-MM-DD
 */
function getPreviousDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

// 命令行执行
if (require.main === module) {
  const args = process.argv.slice(2);
  const date = args[0];

  if (!date) {
    console.log(`
使用方法：
  node backend/tests/validateHandoverAmount.js [日期]

示例：
  node backend/tests/validateHandoverAmount.js 2024-01-01
  node backend/tests/validateHandoverAmount.js $(date -v-1d +%Y-%m-%d)  # 昨天
  node backend/tests/validateHandoverAmount.js $(date +%Y-%m-%d)        # 今天
    `);
    process.exit(1);
  }

  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`❌ 日期格式错误，请使用 YYYY-MM-DD 格式`);
    process.exit(1);
  }

  // 执行验证
  validateHandoverAmount(date)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(`❌ 执行失败：`, error);
      process.exit(1);
    });
}

module.exports = { validateHandoverAmount };
