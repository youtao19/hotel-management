const { query } = require('../backend/database/postgreDB/pg');

async function getTableStructure() {
  try {
    console.log('获取房间表结构:');

    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'rooms'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);

    // 查询一条示例房间数据
    const roomSample = await query(`SELECT * FROM rooms LIMIT 1`);
    console.log('\n房间示例数据:');
    console.log(roomSample.rows[0]);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

getTableStructure();
