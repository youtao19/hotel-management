/**
 * 应用数据库迁移脚本
 * 使用方法: node scripts/applyMigration.js scripts/migrations/20250901_add_order_changes_table.sql
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../backend/database/postgreDB/pg');

// 获取迁移脚本路径
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('请指定迁移脚本文件');
  console.error('使用方法: node scripts/applyMigration.js <迁移脚本路径>');
  process.exit(1);
}

// 验证文件是否存在
if (!fs.existsSync(migrationFile)) {
  console.error(`文件不存在: ${migrationFile}`);
  process.exit(1);
}

// 读取迁移脚本
const sql = fs.readFileSync(path.resolve(migrationFile), 'utf8');
console.log(`读取迁移脚本: ${migrationFile}`);

// 应用迁移脚本
async function applyMigration() {
  try {
    console.log('开始执行迁移...');
    await query(sql);
    console.log('✅ 迁移成功完成!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

// 执行迁移
applyMigration();
