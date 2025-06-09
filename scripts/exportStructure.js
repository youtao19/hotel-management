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

async function getTableStructure(tableName) {
  // 获取表的列信息
  const columnsQuery = `
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      column_default,
      is_nullable
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
      END as constraint_columns
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
    WHERE tablename = $1;
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
  let sql = `-- ${tableName} 表结构\n`;
  sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;

  // 添加列定义
  const columnDefs = structure.columns.map(col => {
    let def = `  "${col.column_name}" ${col.data_type}`;
    if (col.character_maximum_length) {
      def += `(${col.character_maximum_length})`;
    }
    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    return def;
  });

  // 添加约束
  structure.constraints.forEach(con => {
    let constraintDef = '';
    switch (con.constraint_type) {
      case 'p': // Primary Key
        constraintDef = `  CONSTRAINT "${con.constraint_name}" PRIMARY KEY (${con.constraint_columns})`;
        break;
      case 'f': // Foreign Key
        constraintDef = `  CONSTRAINT "${con.constraint_name}" FOREIGN KEY (${con.constraint_columns}) REFERENCES ${con.foreign_table}`;
        break;
      case 'u': // Unique
        constraintDef = `  CONSTRAINT "${con.constraint_name}" UNIQUE (${con.constraint_columns})`;
        break;
    }
    if (constraintDef) {
      columnDefs.push(constraintDef);
    }
  });

  sql += columnDefs.join(',\n');
  sql += '\n);\n\n';

  // 添加索引
  structure.indexes.forEach(index => {
    if (!index.indexdef.includes('CREATE UNIQUE INDEX')) {
      sql += `${index.indexdef};\n`;
    }
  });

  return sql;
}

async function exportStructure() {
  let allSQL = '';

  for (const table of tables) {
    const structure = await getTableStructure(table);
    if (structure) {
      allSQL += generateCreateTableSQL(table, structure);
      allSQL += '\n';
    }
  }

  const outPath = path.join(__dirname, 'structure.sql');
  fs.writeFileSync(outPath, allSQL);
  console.log('表结构已导出到', outPath);
  await closePool();
}

// 执行导出
console.log('开始导出表结构...');
exportStructure()
  .catch(err => {
    console.error('导出失败:', err);
    process.exit(1);
  });
