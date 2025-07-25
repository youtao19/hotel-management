/**
 * 修复bills表中pay_way字段长度限制问题
 * 
 * 问题：当前数据库中pay_way字段长度为VARCHAR(20)，但测试中需要存储JSON字符串
 * 解决：将字段长度扩展为VARCHAR(50)
 * 
 * 使用方法：
 * node scripts/fixPayWayFieldLength.js
 */

const { query, initializeHotelDB, closePool } = require('../backend/database/postgreDB/pg');

async function fixPayWayFieldLength() {
  try {
    console.log('🚀 开始修复bills表中pay_way字段长度...');
    
    // 初始化数据库连接
    await initializeHotelDB();
    
    // 1. 检查当前字段长度
    console.log('📋 检查当前字段长度...');
    
    const checkFieldQuery = `
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'bills' AND column_name = 'pay_way';
    `;
    
    const currentField = await query(checkFieldQuery);
    
    if (currentField.rows.length === 0) {
      console.log('❌ 未找到pay_way字段');
      return;
    }
    
    const currentLength = currentField.rows[0].character_maximum_length;
    console.log(`📝 当前pay_way字段长度: ${currentLength}`);
    
    if (currentLength >= 50) {
      console.log('✅ 字段长度已经足够，无需修改');
      return;
    }
    
    // 2. 备份可能受影响的数据
    console.log('💾 检查可能受影响的数据...');
    
    const checkDataQuery = `
      SELECT order_id, pay_way, LENGTH(pay_way) as pay_way_length
      FROM bills 
      WHERE LENGTH(pay_way) > 20
      ORDER BY LENGTH(pay_way) DESC
      LIMIT 10;
    `;
    
    const longData = await query(checkDataQuery);
    
    if (longData.rows.length > 0) {
      console.log('⚠️ 发现超长数据:');
      longData.rows.forEach(row => {
        console.log(`   订单ID: ${row.order_id}, 长度: ${row.pay_way_length}, 内容: ${row.pay_way.substring(0, 50)}...`);
      });
    } else {
      console.log('✅ 没有发现超长数据');
    }
    
    // 3. 修改字段长度
    console.log('🔧 开始修改字段长度...');
    
    const alterQuery = `ALTER TABLE bills ALTER COLUMN pay_way TYPE VARCHAR(50);`;
    await query(alterQuery);
    
    console.log('✅ 成功将pay_way字段长度修改为VARCHAR(50)');
    
    // 4. 验证修改结果
    console.log('🔍 验证修改结果...');
    
    const verifyQuery = `
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'bills' AND column_name = 'pay_way';
    `;
    
    const updatedField = await query(verifyQuery);
    const newLength = updatedField.rows[0].character_maximum_length;
    
    console.log(`📋 修改后pay_way字段长度: ${newLength}`);
    
    if (newLength >= 50) {
      console.log('✅ 字段长度修改成功');
    } else {
      console.log('❌ 字段长度修改失败');
    }
    
    // 5. 检查其他可能需要修改的字段
    console.log('🔍 检查其他可能需要修改的字段...');
    
    const checkOtherFieldsQuery = `
      SELECT table_name, column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND data_type = 'character varying' 
      AND character_maximum_length < 20
      AND table_name IN ('bills', 'orders', 'rooms', 'room_types', 'shift_handover')
      ORDER BY table_name, column_name;
    `;
    
    const otherFields = await query(checkOtherFieldsQuery);
    
    if (otherFields.rows.length > 0) {
      console.log('📋 发现其他可能需要注意的短字段:');
      otherFields.rows.forEach(row => {
        console.log(`   ${row.table_name}.${row.column_name}: ${row.data_type}(${row.character_maximum_length})`);
      });
    } else {
      console.log('✅ 没有发现其他需要注意的短字段');
    }
    
    console.log('\n🎉 pay_way字段长度修复完成!');
    
  } catch (error) {
    console.error('❌ 修复pay_way字段长度失败:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  fixPayWayFieldLength()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  fixPayWayFieldLength
};
