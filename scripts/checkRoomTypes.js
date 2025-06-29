const { query } = require('../backend/database/postgreDB/pg');

async function getRoomTypes() {
  try {
    console.log('查询所有房型信息：');
    const result = await query('SELECT * FROM room_types');
    console.table(result.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

getRoomTypes();
