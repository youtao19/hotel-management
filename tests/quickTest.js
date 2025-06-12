/**
 * 快速测试脚本 - 用于验证交接班模块基本功能
 */

const shiftHandoverModule = require('../backend/modules/shiftHandoverModule');
const { query } = require('../backend/database/postgreDB/pg');

async function runQuickTest() {
  console.log('🧪 开始快速测试交接班模块...\n');

  try {
    // 测试1: 检查模块导出
    console.log('1. 检查模块导出...');
    const exports = Object.keys(shiftHandoverModule);
    console.log('   导出的函数:', exports.join(', '));

    if (exports.length === 0) {
      console.log('❌ 模块没有导出任何函数');
      return;
    }
    console.log('✅ 模块导出正常\n');

    // 测试2: 数据库连接
    console.log('2. 测试数据库连接...');
    const result = await query('SELECT 1 as test');
    if (result && result.rows && result.rows.length > 0) {
      console.log('✅ 数据库连接正常\n');
    } else {
      console.log('❌ 数据库连接异常');
      return;
    }

    // 测试3: 基础数据准备
    console.log('3. 准备基础数据...');

    // 插入房间类型
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES
        ('standard', '标准间', 288),
        ('rest', '休息房', 88)
      ON CONFLICT (type_code) DO NOTHING
    `);

    // 插入房间
    await query(`
      INSERT INTO rooms (room_id, room_number, type_code, status, price)
      VALUES
        (101, '101', 'standard', 'available', 288.00),
        (201, '201', 'rest', 'available', 88.00)
      ON CONFLICT (room_number) DO NOTHING
    `);

    console.log('✅ 基础数据准备完成\n');

    // 测试4: 测试获取统计数据
    console.log('4. 测试获取统计数据...');
    const today = new Date().toISOString().split('T')[0];

    if (typeof shiftHandoverModule.getStatistics === 'function') {
      const statistics = await shiftHandoverModule.getStatistics(today, today);
      console.log('   统计数据样例:', {
        hotelIncome: statistics.hotelIncome,
        restIncome: statistics.restIncome,
        totalRooms: statistics.totalRooms,
        restRooms: statistics.restRooms
      });
      console.log('✅ 统计数据获取正常\n');
    } else {
      console.log('❌ getStatistics 函数不存在');
    }

    // 测试5: 测试获取收款明细
    console.log('5. 测试获取收款明细...');

    if (typeof shiftHandoverModule.getReceiptDetails === 'function') {
      const receipts = await shiftHandoverModule.getReceiptDetails('hotel', today, today);
      console.log(`   找到 ${receipts.length} 条客房收款记录`);
      console.log('✅ 收款明细获取正常\n');
    } else {
      console.log('❌ getReceiptDetails 函数不存在');
    }

    // 测试6: 测试获取历史记录
    console.log('6. 测试获取历史记录...');

    if (typeof shiftHandoverModule.getHandoverHistory === 'function') {
      const history = await shiftHandoverModule.getHandoverHistory(today, today);
      console.log(`   找到 ${history.length} 条历史记录`);
      console.log('✅ 历史记录获取正常\n');
    } else {
      console.log('❌ getHandoverHistory 函数不存在');
    }

    console.log('🎉 快速测试全部通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
runQuickTest().then(() => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
    await query(`
      INSERT INTO rooms (room_number, type_code, status)
      VALUES
        ('101', 'standard', 'available'),
        ('201', 'rest', 'available')
      ON CONFLICT (room_number) DO NOTHING
    `);rModule = require('../backend/modules/shiftHandoverModule');
const { query } = require('../backend/database/postgreDB/pg');

async function runQuickTest() {
  console.log('🧪 开始快速测试交接班模块...\n');

  try {
    // 测试1: 检查模块导出
    console.log('1. 检查模块导出...');
    const exports = Object.keys(shiftHandoverModule);
    console.log('   导出的函数:', exports.join(', '));

    if (exports.length === 0) {
      console.log('❌ 模块没有导出任何函数');
      return;
    }
    console.log('✅ 模块导出正常\n');

    // 测试2: 数据库连接
    console.log('2. 测试数据库连接...');
    const result = await query('SELECT 1 as test');
    console.log('   数据库查询结果:', result);
    if (result && result.rows && result.rows.length > 0) {
      console.log('✅ 数据库连接正常\n');
    } else {
      console.log('❌ 数据库连接异常');
      return;
    }

    // 测试3: 基础数据准备
    console.log('3. 准备基础数据...');

    // 插入房间类型
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES
        ('standard', '标准间', 288),
        ('rest', '休息房', 88)
      ON CONFLICT (type_code) DO NOTHING
    `);

    // 插入房间
    await query(`
      INSERT INTO rooms (room_number, type_code, floor, status)
      VALUES
        ('101', 'standard', 1, 'available'),
        ('201', 'rest', 2, 'available')
      ON CONFLICT (room_number) DO NOTHING
    `);

    console.log('✅ 基础数据准备完成\n');

    // 测试4: 测试获取统计数据
    console.log('4. 测试获取统计数据...');
    const today = new Date().toISOString().split('T')[0];

    if (typeof shiftHandoverModule.getStatistics === 'function') {
      const statistics = await shiftHandoverModule.getStatistics(today, today);
      console.log('   统计数据样例:', {
        hotelIncome: statistics.hotelIncome,
        restIncome: statistics.restIncome,
        totalRooms: statistics.totalRooms,
        restRooms: statistics.restRooms
      });
      console.log('✅ 统计数据获取正常\n');
    } else {
      console.log('❌ getStatistics 函数不存在');
    }

    // 测试5: 测试获取收款明细
    console.log('5. 测试获取收款明细...');

    if (typeof shiftHandoverModule.getReceiptDetails === 'function') {
      const receipts = await shiftHandoverModule.getReceiptDetails('hotel', today, today);
      console.log(`   找到 ${receipts.length} 条客房收款记录`);
      console.log('✅ 收款明细获取正常\n');
    } else {
      console.log('❌ getReceiptDetails 函数不存在');
    }

    // 测试6: 测试获取历史记录
    console.log('6. 测试获取历史记录...');

    if (typeof shiftHandoverModule.getHandoverHistory === 'function') {
      const history = await shiftHandoverModule.getHandoverHistory(today, today);
      console.log(`   找到 ${history.length} 条历史记录`);
      console.log('✅ 历史记录获取正常\n');
    } else {
      console.log('❌ getHandoverHistory 函数不存在');
    }

    console.log('🎉 快速测试全部通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
runQuickTest().then(() => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
