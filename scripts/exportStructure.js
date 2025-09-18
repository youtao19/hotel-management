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
  'handover',
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

async function getTableStructure(tableName) {
  // 获取表的列信息
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

  // 获取表的约束信息
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

  // 获取表的索引信息
  const indexesQuery = `
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = $1
    AND indexname NOT LIKE '%_pkey';
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

function generateCreateTableSQL(tableName, structure) {
  let sql = `-- Table: ${tableName}\n`;
  sql += `CREATE TABLE ${tableName} (\n`;

  // 添加列定义
  const columnDefs = structure.columns.map(col => {
    let def = `    ${col.column_name} `;

    // 处理数据类型
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

    // 添加默认值
    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }

    // 添加NOT NULL约束
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
      case 'p': // Primary Key
        constraintDef = `    PRIMARY KEY (${con.constraint_columns})`;
        break;
      case 'f': // Foreign Key
        constraintDef = `    FOREIGN KEY (${con.constraint_columns}) REFERENCES ${con.foreign_table}(${con.foreign_columns || con.constraint_columns})`;
        break;
      case 'u': // Unique
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

  return sql + '\n';
}

async function exportStructure() {
  let allSQL = '';

  // 添加文件头注释
  allSQL += '-- 酒店管理系统数据库表结构导出\n';
  allSQL += `-- 导出时间: ${new Date().toISOString()}\n`;
  allSQL += '-- PostgreSQL 数据库\n\n';

  // 发现所有表
  const tables = await discoverTables();
  console.log('发现的表:', tables);

  for (const table of tables) {
    console.log(`正在导出表结构: ${table}`);
    const structure = await getTableStructure(table);
    if (structure) {
      allSQL += generateCreateTableSQL(table, structure);
    } else {
      allSQL += `-- 导出表 ${table} 结构失败\n\n`;
    }
  }

  const outPath = path.join(__dirname, 'structure.sql');
  fs.writeFileSync(outPath, allSQL);
  console.log('表结构已导出到', outPath);
  console.log(`共导出 ${tables.length} 个表的结构`);
  await closePool();
}

// 执行导出
console.log('开始导出表结构...');
exportStructure()
  .catch(err => {
    console.error('导出失败:', err);
    process.exit(1);
  });
