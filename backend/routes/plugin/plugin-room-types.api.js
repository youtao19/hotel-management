const express = require('express');
const router = express.Router();
const { query } = require('../../database/postgreDB/pg');

// 获取所有房型
router.get('/', async (req, res) => {
  try {
    console.log('获取所有房型请求');

    // 检查room_types表是否存在
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'room_types'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('room_types表不存在');
      return res.status(404).json({ message: '房型数据不存在' });
    }

    const { rows } = await query('SELECT * FROM room_types ORDER BY type_code');
    console.log(`成功获取 ${rows.length} 条房型数据`);
    res.status(200).json({ data: rows });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

module.exports = router;
