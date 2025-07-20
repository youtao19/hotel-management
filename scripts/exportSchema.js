#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../backend/database/postgreDB/pg');

// 需要导出的表（如果不指定则自动发现）
const predefinedTables = [
  'account',
  'room_types',
  'rooms',
  'orders',
  'bills',
  'shift_handover', // 新增交接班表
];

// 自动发现所有表
async function discoverTables() {
  try {
    const result = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows.map(row => row.table_name);
  } catch (err) {
    console.log('自动发现表失败，使用预定义表列表:', err.message);
    return predefinedTables;
  }
}

// 改进的INSERT语句生成
function toInsertSQL(table, row) {
  const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
  const values = Object.values(row).map(val => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    // 日期类型转字符串
    if (val instanceof Date) return `'${val.toISOString()}'`;
    // JSON/JSONB 类型处理
    if (typeof val === 'object' && val !== null) {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    }
    // 字符串转义单引号
    return `'${String(val).replace(/'/g, "''")}'`;
  }).join(', ');
  return `INSERT INTO "${table}" (${columns}) VALUES (${values});`;
}

async function exportAll() {
  let sqls = [];

  // 添加文件头注释
  sqls.push('-- 酒店管理系统数据导出');
  sqls.push(`-- 导出时间: ${new Date().toISOString()}`);
  sqls.push('-- 注意：导入前请确保目标数据库已创建相应的表结构');
  sqls.push('');

  // 发现所有表
  const tables = await discoverTables();
  console.log('发现的表:', tables);

  for (const table of tables) {
    try {
      const res = await query(`SELECT * FROM "${table}" ORDER BY 1`);
      if (res.rows.length > 0) {
        sqls.push(`-- ${table} 表数据 (${res.rows.length} 条记录)`);
        for (const row of res.rows) {
          sqls.push(toInsertSQL(table, row));
        }
        sqls.push('');
      } else {
        sqls.push(`-- ${table} 表无数据`);
        sqls.push('');
      }
    } catch (err) {
      console.error(`导出表 ${table} 失败:`, err.message);
      sqls.push(`-- 导出表 ${table} 失败: ${err.message}`);
      sqls.push('');
    }
  }

  const outPath = path.join(__dirname, 'export.sql');
  fs.writeFileSync(outPath, sqls.join('\n'));
  console.log('数据已导出到', outPath);
  console.log(`共导出 ${tables.length} 个表的数据`);
  await closePool();
}

exportAll();

