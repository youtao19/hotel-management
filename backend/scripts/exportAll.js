#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../database/postgreDB/pg');

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
    console.error('自动发现表失败:', err.message);
    return [];
  }
}

// 获取表结构
async function getTableStructure(tableName) {
  const columnsQuery = `
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      column_default,
      is_nullable,
      udt_name
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `;

  const constraintsQuery = `
    SELECT
      con.conname as constraint_name,
      con.contype as constraint_type,
      CASE
        WHEN con.contype = 'f' THEN (
          SELECT nspname || '.' || relname
          FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
          WHERE pg_class.oid = con.confrelid
        )
        ELSE NULL
      END as foreign_table,
      CASE
        WHEN con.contype = 'f' THEN (
          SELECT string_agg(attname, ', ')
          FROM pg_attribute
          WHERE attrelid = con.conrelid
          AND attnum = ANY(con.conkey)
        )
        ELSE (
          SELECT string_agg(attname, ', ')
          FROM pg_attribute
          WHERE attrelid = con.conrelid
          AND attnum = ANY(con.conkey)
        )
      END as constraint_columns,
      CASE
        WHEN con.contype = 'f' THEN (
          SELECT string_agg(attname, ', ')
          FROM pg_attribute
          WHERE attrelid = con.confrelid
          AND attnum = ANY(con.confkey)
        )
        ELSE NULL
      END as foreign_columns
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = $1;
  `;

  const indexesQuery = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = $1 AND indexname NOT LIKE '%_pkey';
  `;

  try {
    const columns = await query(columnsQuery, [tableName]);
    const constraints = await query(constraintsQuery, [tableName]);
    const indexes = await query(indexesQuery, [tableName]);

    return {
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows
    };
  } catch (err) {
    console.error(`获取表 ${tableName} 结构失败:`, err.message);
    return null;
  }
}

// 生成CREATE TABLE语句
function generateCreateTableSQL(tableName, structure) {
  let sql = `-- Table: ${tableName}\n`;
  sql += `CREATE TABLE ${tableName} (\n`;

  const columnDefs = structure.columns.map(col => {
    let def = `    ${col.column_name} `;

    if (col.data_type === 'character varying') {
      def += `character varying(${col.character_maximum_length})`;
    } else if (col.data_type === 'numeric') {
      if (col.numeric_precision && col.numeric_scale !== null) {
        def += `numeric(${col.numeric_precision},${col.numeric_scale})`;
      } else {
        def += 'numeric';
      }
    } else if (col.data_type === 'integer' && col.column_default && col.column_default.includes('nextval')) {
      def += 'integer(32,0)';
    } else if (col.data_type === 'timestamp without time zone') {
      def += 'timestamp without time zone';
    } else if (col.data_type === 'timestamp with time zone') {
      def += 'timestamp with time zone';
    } else {
      def += col.data_type;
    }

    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }

    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }

    return def;
  });

  sql += columnDefs.join(',\n');

  // 添加约束
  const constraintDefs = [];
  structure.constraints.forEach(con => {
    let constraintDef = '';
    switch (con.constraint_type) {
      case 'p':
        constraintDef = `    PRIMARY KEY (${con.constraint_columns})`;
        break;
      case 'f':
        constraintDef = `    FOREIGN KEY (${con.constraint_columns}) REFERENCES ${con.foreign_table}(${con.foreign_columns || con.constraint_columns})`;
        break;
      case 'u':
        constraintDef = `    UNIQUE (${con.constraint_columns})`;
        break;
    }
    if (constraintDef) {
      constraintDefs.push(constraintDef);
    }
  });

  if (constraintDefs.length > 0) {
    sql += ',\n' + constraintDefs.join(',\n');
  }

  sql += '\n);\n\n';

  // 添加索引
  structure.indexes.forEach(index => {
    sql += `${index.indexdef};\n`;
  });

  return sql;
}

// 生成INSERT语句
function toInsertSQL(table, row) {
  const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
  const values = Object.values(row).map(val => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (typeof val === 'object' && val !== null) {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
  }).join(', ');
  return `INSERT INTO "${table}" (${columns}) VALUES (${values});`;
}

// 主导出函数
async function exportAll() {
  console.log('开始导出酒店管理系统数据库...');

  const tables = await discoverTables();
  if (tables.length === 0) {
    console.error('未发现任何表');
    return;
  }

  console.log('发现的表:', tables);

  let allSQL = '';

  // 文件头
  allSQL += '-- 酒店管理系统完整数据库导出\n';
  allSQL += `-- 导出时间: ${new Date().toISOString()}\n`;
  allSQL += '-- 包含表结构和数据\n';
  allSQL += '-- PostgreSQL 数据库\n\n';

  // 导出表结构
  allSQL += '-- ==========================================\n';
  allSQL += '-- 表结构定义\n';
  allSQL += '-- ==========================================\n\n';

  for (const table of tables) {
    console.log(`导出表结构: ${table}`);
    const structure = await getTableStructure(table);
    if (structure) {
      allSQL += generateCreateTableSQL(table, structure);
    }
  }

  // 导出数据
  allSQL += '\n-- ==========================================\n';
  allSQL += '-- 数据插入\n';
  allSQL += '-- ==========================================\n\n';

  // 按依赖顺序导出数据
  const tableOrder = ['account', 'room_types', 'rooms', 'orders', 'bills', 'shift_handover'];
  const orderedTables = [...tableOrder.filter(t => tables.includes(t)), ...tables.filter(t => !tableOrder.includes(t))];

  for (const table of orderedTables) {
    console.log(`导出表数据: ${table}`);
    try {
      const res = await query(`SELECT * FROM "${table}" ORDER BY 1`);
      if (res.rows.length > 0) {
        allSQL += `-- ${table} 表数据 (${res.rows.length} 条记录)\n`;
        for (const row of res.rows) {
          allSQL += toInsertSQL(table, row) + '\n';
        }
        allSQL += '\n';
      } else {
        allSQL += `-- ${table} 表无数据\n\n`;
      }
    } catch (err) {
      console.error(`导出表 ${table} 数据失败:`, err.message);
      allSQL += `-- 导出表 ${table} 数据失败: ${err.message}\n\n`;
    }
  }

  // 写入文件
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outPath = path.join(__dirname, `hotel_db_backup_${timestamp}.sql`);
  fs.writeFileSync(outPath, allSQL);

  console.log(`\n导出完成！`);
  console.log(`文件位置: ${outPath}`);
  console.log(`共导出 ${tables.length} 个表`);

  await closePool();
}

// 运行导出
exportAll().catch(err => {
  console.error('导出失败:', err);
  process.exit(1);
});
