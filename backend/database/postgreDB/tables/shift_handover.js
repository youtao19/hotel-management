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

// 创建交接班表函数
async function createShiftHandoverTable() {
  try {
    await query(createQuery);

    // 创建索引
    for (let indexQuery of createIndexQueryStrings) {
      await query(indexQuery);
    }

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
  createShiftHandoverTable
};
