const { migrateShiftHandoverTable } = require('../backend/database/postgreDB/tables/shift_handover');

/**
 * 交接班表迁移脚本
 * 用于添加html_snapshot、handover_person、receive_person字段
 */
async function runMigration() {
  console.log('🚀 开始交接班表迁移...');
  console.log('=====================================');

  try {
    await migrateShiftHandoverTable();

    console.log('=====================================');
    console.log('✅ 交接班表迁移完成！');
    console.log('');
    console.log('新增字段：');
    console.log('  - html_snapshot: 存储HTML快照');
    console.log('  - handover_person: 交班人姓名');
    console.log('  - receive_person: 接班人姓名');
    console.log('');
    console.log('现在可以启动服务器使用新功能了！');

    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    console.log('');
    console.log('请检查：');
    console.log('  1. 数据库连接是否正常');
    console.log('  2. 是否有足够的权限修改表结构');
    console.log('  3. shift_handover表是否存在');

    process.exit(1);
  }
}

// 运行迁移
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration
};
