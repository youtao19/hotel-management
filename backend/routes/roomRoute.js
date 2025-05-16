const express = require('express');
const router = express.Router();
// 使用统一的数据库连接模块
const { query } = require('../database/postgreDB/pg');

// 获取所有房间
router.get('/', async (req, res) => {
  try {
    console.log('获取所有房间请求');

    const { rows } = await query('SELECT r.*, o.guest_name, o.check_out_date FROM rooms r LEFT JOIN orders o ON r.room_number = o.room_number AND o.status = \'已入住\'');
    console.log(`成功获取 ${rows.length} 条房间数据`);
    if (rows.length === 0) {
      res.json({ data: [], message: '没有查询到房间数据' });
    } else {
      res.json({ data: rows });
    }
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

// 测试维修端点
router.get('/test-repair/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`尝试设置房间 ${id} 为维修状态`);

    // 直接执行SQL更新，同时更新is_closed字段
    const { rows } = await query(
      'UPDATE rooms SET status = $1, is_closed = $2 WHERE room_id = $3 RETURNING *',
      ['repair', true, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    return res.json({
      message: '房间状态已更新为维修',
      data: rows[0]
    });
  } catch (err) {
    console.error('测试维修功能出错:', err);
    return res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 更新房间状态
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // 详细日志
    console.log('====== 房间状态更新请求 ======');
    console.log('请求参数ID:', id);
    console.log('请求体:', req.body);
    console.log('Content-Type:', req.get('Content-Type'));

    // 检查请求体是否为空
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('请求体为空');
      return res.status(400).json({ message: '请求体为空' });
    }

    const { status } = req.body;

    // 检查状态是否存在
    if (status === undefined) {
      console.log('状态值未提供');
      return res.status(400).json({ message: '状态值未提供' });
    }

    console.log('请求的状态值:', status);

    // 验证状态值 - 使用统一的状态常量
    const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];
    if (!VALID_ROOM_STATES.includes(status)) {
      console.log('无效的状态值:', status);
      console.log('有效的状态值:', VALID_ROOM_STATES);
      return res.status(400).json({
        message: '无效的房间状态',
        requestedStatus: status,
        validStatuses: VALID_ROOM_STATES
      });
    }

        // 这里改用尝试导入房间表模块的updateRoomStatus方法，绕过直接SQL查询
    const roomModule = require('../database/postgreDB/tables/room');
    console.log('尝试使用房间模块的updateRoomStatus方法');
    const result = await roomModule.updateRoomStatus(id, status);

    if (!result) {
      console.log('房间未找到:', id);
      return res.status(404).json({ message: '未找到房间' });
    }

    console.log('更新成功:', result);
    return res.json({ data: result });
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
