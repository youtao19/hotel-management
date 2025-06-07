#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../backend/database/postgreDB/pg');

// 需要导出的表
const tables = [
  'account',
  'room_types',
  'rooms',
  'orders',
  'bills',
];

// 生成INSERT语句
function toInsertSQL(table, row) {
  const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
  const values = Object.values(row).map(val => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    // 日期类型转字符串
    if (val instanceof Date) return `'${val.toISOString()}'`;
    // 字符串转义单引号
    return `'${String(val).replace(/'/g, "''")}'`;
  }).join(', ');
  return `INSERT INTO "${table}" (${columns}) VALUES (${values});`;
}

async function exportAll() {
  let sqls = [];
  for (const table of tables) {
    try {
      const res = await query(`SELECT * FROM "${table}"`);
      if (res.rows.length > 0) {
        sqls.push(`-- ${table} 数据`);
        for (const row of res.rows) {
          sqls.push(toInsertSQL(table, row));
        }
        sqls.push('');
      }
    } catch (err) {
      console.error(`导出表 ${table} 失败:`, err.message);
    }
  }
  const outPath = path.join(__dirname, 'export.sql');
  fs.writeFileSync(outPath, sqls.join('\n'));
  console.log('数据已导出到', outPath);
  await closePool();
}

exportAll();

