const express = require('express');
const router = express.Router();
// 使用统一的数据库连接模块
const { query } = require('../database/postgreDB/pg');

// 获取所有房间
router.get('/', async (req, res) => {
  try {
    console.log('获取所有房间请求');

    // 检查rooms表是否存在
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'rooms'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('rooms表不存在，返回模拟数据');
      // 返回一些模拟数据
      return res.json({
        data: [
          { room_id: 1, room_number: '101', type_code: 'standard', status: 'available', price: 288 },
          { room_id: 2, room_number: '102', type_code: 'standard', status: 'occupied', price: 288 },
          { room_id: 3, room_number: '201', type_code: 'deluxe', status: 'available', price: 388 }
        ]
      });
    }

    const { rows } = await query('SELECT * FROM rooms');
    console.log(`成功获取 ${rows.length} 条房间数据`);
    res.json({ data: rows });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// 获取特定ID的房间
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM rooms WHERE room_id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定房间号的房间
router.get('/number/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const { rows } = await query('SELECT * FROM rooms WHERE room_number = $1', [number]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新房间状态
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '无效的房间状态' });
    }

    const { rows } = await query(
      'UPDATE rooms SET status = $1 WHERE room_id = $2 RETURNING *',
      [status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新房间状态错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新房间
router.post('/', async (req, res) => {
  try {
    const { room_number, type_code, status, price } = req.body;

    // 验证必要字段
    if (!room_number || !type_code || !status || !price) {
      return res.status(400).json({ message: '缺少必要字段' });
    }

    // 检查房间号是否已存在
    const checkResult = await query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: '房间号已存在' });
    }

    // 生成新的room_id
    const idResult = await query('SELECT MAX(room_id) as max_id FROM rooms');
    const newId = (idResult.rows[0].max_id || 0) + 1;

    const { rows } = await query(
      'INSERT INTO rooms (room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [newId, room_number, type_code, status, price]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('添加房间错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
