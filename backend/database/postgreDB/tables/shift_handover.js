const { query } = require('../pg');

// 创建交接班表
const createQuery = `
  CREATE TABLE IF NOT EXISTS shift_handover (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'hotel',
    details JSONB NOT NULL DEFAULT '[]',
    statistics JSONB NOT NULL DEFAULT '{}',
    remarks TEXT,
    cashier_name VARCHAR(100) NOT NULL,
    shift_time VARCHAR(10) NOT NULL,
    shift_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

// 创建索引
const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_shift_handover_date ON shift_handover(shift_date);`,
  `CREATE INDEX IF NOT EXISTS idx_shift_handover_type ON shift_handover(type);`,
  `CREATE INDEX IF NOT EXISTS idx_shift_handover_cashier ON shift_handover(cashier_name);`,
];

// 数据库迁移函数 - 清理不再使用的字段
async function migrateShiftHandoverTable() {
  try {
    console.log('开始迁移交接班表...');

    // 检查并删除html_snapshot字段（如果存在）
    const checkHtmlSnapshotColumn = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name = 'html_snapshot';
    `;

    const htmlSnapshotResult = await query(checkHtmlSnapshotColumn);

    if (htmlSnapshotResult.rows.length > 0) {
      await query(`ALTER TABLE shift_handover DROP COLUMN html_snapshot;`);
      console.log('✓ 删除html_snapshot字段成功');
    } else {
      console.log('✓ html_snapshot字段不存在，无需删除');
    }

    // 检查并删除handover_person字段（如果存在）
    const checkHandoverPersonColumn = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name = 'handover_person';
    `;

    const handoverPersonResult = await query(checkHandoverPersonColumn);

    if (handoverPersonResult.rows.length > 0) {
      await query(`ALTER TABLE shift_handover DROP COLUMN handover_person;`);
      console.log('✓ 删除handover_person字段成功');
    } else {
      console.log('✓ handover_person字段不存在，无需删除');
    }

    // 检查并删除receive_person字段（如果存在）
    const checkReceivePersonColumn = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name = 'receive_person';
    `;

    const receivePersonResult = await query(checkReceivePersonColumn);

    if (receivePersonResult.rows.length > 0) {
      await query(`ALTER TABLE shift_handover DROP COLUMN receive_person;`);
      console.log('✓ 删除receive_person字段成功');
    } else {
      console.log('✓ receive_person字段不存在，无需删除');
    }

    console.log('交接班表迁移完成');
  } catch (error) {
    console.error('迁移交接班表失败:', error);
    throw error;
  }
}

// 创建交接班表函数
async function createShiftHandoverTable() {
  try {
    await query(createQuery);

    // 创建索引
    for (let indexQuery of createIndexQueryStrings) {
      await query(indexQuery);
    }

    // 执行迁移
    await migrateShiftHandoverTable();

    console.log('交接班表创建成功');
  } catch (error) {
    console.error('创建交接班表失败:', error);
    throw error;
  }
}

module.exports = {
  tableName: 'shift_handover',
  createQuery,
  createIndexQueryStrings,
  createShiftHandoverTable,
  migrateShiftHandoverTable
};
