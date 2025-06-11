const { query } = require('../pg');

// 创建交接班表
async function createShiftHandoverTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS shift_handover (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      details JSONB NOT NULL,
      statistics JSONB NOT NULL,
      remarks TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      shift_date DATE NOT NULL
    );
  `;

  try {
    await query(sql);
    console.log('交接班表创建成功');
  } catch (error) {
    console.error('创建交接班表失败:', error);
    throw error;
  }
}

module.exports = {
  createShiftHandoverTable
};
