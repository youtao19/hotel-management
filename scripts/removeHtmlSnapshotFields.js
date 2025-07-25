/**
 * 删除交接班表中不再使用的HTML快照相关字段
 * 
 * 删除的字段：
 * - html_snapshot: HTML快照字段
 * - handover_person: 交班人字段  
 * - receive_person: 接班人字段
 * 
 * 使用方法：
 * node scripts/removeHtmlSnapshotFields.js
 */

const { query, initializeHotelDB, closePool } = require('../backend/database/postgreDB/pg');

async function removeHtmlSnapshotFields() {
  try {
    console.log('🚀 开始删除交接班表中的HTML快照相关字段...');
    
    // 初始化数据库连接
    await initializeHotelDB();
    
    // 1. 检查字段是否存在
    console.log('📋 检查字段存在性...');
    
    const checkFieldsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name IN ('html_snapshot', 'handover_person', 'receive_person')
      ORDER BY column_name;
    `;
    
    const existingFields = await query(checkFieldsQuery);
    const fieldsToRemove = existingFields.rows.map(row => row.column_name);
    
    if (fieldsToRemove.length === 0) {
      console.log('✅ 没有找到需要删除的字段，可能已经被删除了');
      return;
    }
    
    console.log(`📝 找到以下字段需要删除: ${fieldsToRemove.join(', ')}`);
    
    // 2. 备份数据（可选，但建议）
    console.log('💾 创建数据备份...');
    
    const backupTableName = `shift_handover_backup_${Date.now()}`;
    const createBackupQuery = `
      CREATE TABLE ${backupTableName} AS 
      SELECT * FROM shift_handover;
    `;
    
    await query(createBackupQuery);
    console.log(`✅ 数据已备份到表: ${backupTableName}`);
    
    // 3. 删除字段
    console.log('🗑️ 开始删除字段...');
    
    for (const fieldName of fieldsToRemove) {
      try {
        const dropColumnQuery = `ALTER TABLE shift_handover DROP COLUMN IF EXISTS ${fieldName};`;
        await query(dropColumnQuery);
        console.log(`✅ 成功删除字段: ${fieldName}`);
      } catch (error) {
        console.error(`❌ 删除字段 ${fieldName} 失败:`, error.message);
        throw error;
      }
    }
    
    // 4. 验证删除结果
    console.log('🔍 验证删除结果...');
    
    const verifyQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      ORDER BY ordinal_position;
    `;
    
    const remainingFields = await query(verifyQuery);
    console.log('📋 当前表结构中的字段:');
    remainingFields.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name}`);
    });
    
    // 5. 检查是否还有对删除字段的引用
    const deletedFields = fieldsToRemove.filter(field => 
      !remainingFields.rows.some(row => row.column_name === field)
    );
    
    if (deletedFields.length === fieldsToRemove.length) {
      console.log('✅ 所有目标字段已成功删除');
    } else {
      console.log('⚠️ 部分字段删除失败，请检查');
    }
    
    // 6. 提供清理备份表的说明
    console.log('\n📝 后续操作说明:');
    console.log(`1. 如果确认删除操作成功，可以删除备份表:`);
    console.log(`   DROP TABLE ${backupTableName};`);
    console.log(`2. 如果需要恢复数据，可以从备份表恢复相关字段`);
    console.log(`3. 建议在生产环境运行前先在测试环境验证`);
    
    console.log('\n🎉 HTML快照字段删除操作完成!');
    
  } catch (error) {
    console.error('❌ 删除HTML快照字段失败:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  removeHtmlSnapshotFields()
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
  removeHtmlSnapshotFields
};
