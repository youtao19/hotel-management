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
    html_snapshot TEXT,
    handover_person VARCHAR(100),
    receive_person VARCHAR(100),
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

// 数据库迁移函数 - 安全地添加新字段
async function migrateShiftHandoverTable() {
  try {
    console.log('开始迁移交接班表...');

    // 检查并添加html_snapshot字段
    const checkHtmlSnapshotColumn = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name = 'html_snapshot';
    `;

    const htmlSnapshotResult = await query(checkHtmlSnapshotColumn);

    if (htmlSnapshotResult.rows.length === 0) {
      await query(`ALTER TABLE shift_handover ADD COLUMN html_snapshot TEXT;`);
      console.log('✓ 添加html_snapshot字段成功');
    } else {
      console.log('✓ html_snapshot字段已存在');
    }

    // 检查并添加handover_person字段
    const checkHandoverPersonColumn = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name = 'handover_person';
    `;

    const handoverPersonResult = await query(checkHandoverPersonColumn);

    if (handoverPersonResult.rows.length === 0) {
      await query(`ALTER TABLE shift_handover ADD COLUMN handover_person VARCHAR(100);`);
      console.log('✓ 添加handover_person字段成功');
    } else {
      console.log('✓ handover_person字段已存在');
    }

    // 检查并添加receive_person字段
    const checkReceivePersonColumn = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shift_handover'
      AND column_name = 'receive_person';
    `;

    const receivePersonResult = await query(checkReceivePersonColumn);

    if (receivePersonResult.rows.length === 0) {
      await query(`ALTER TABLE shift_handover ADD COLUMN receive_person VARCHAR(100);`);
      console.log('✓ 添加receive_person字段成功');
    } else {
      console.log('✓ receive_person字段已存在');
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
