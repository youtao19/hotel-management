const express = require('express');
const router = express.Router();
// 使用统一的数据库连接模块
const { query } = require('../database/postgreDB/pg');

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
    }

    const { rows } = await query('SELECT * FROM room_types');
    console.log(`成功获取 ${rows.length} 条房型数据`);
    res.json({ data: rows });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

// 根据类型代码获取房型
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    console.log(`获取房型代码: ${code}`);

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
      return res.status(500).json({ message: '房型表不存在' });
    }

    const { rows } = await query('SELECT * FROM room_types WHERE type_code = $1', [code]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房型' });
    }

    res.json({ data: rows[0] });
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
