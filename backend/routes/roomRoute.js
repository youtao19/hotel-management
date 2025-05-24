const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const roomModule = require('../modules/roomModule');

const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

// 获取所有房间
router.get('/', async (req, res) => {
  try {
    const rooms = await roomModule.getAllRooms();

    if (rooms.length === 0) {
      res.json({ data: [], message: '没有查询到房间数据' });
    } else {
      res.json({ data: rooms });
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

// 获取指定日期范围内的可用房间
router.get('/available', async (req, res) => {
  try {
    const { startDate, endDate, typeCode } = req.query;

    // 验证日期参数
    if (!startDate || !endDate) {
      return res.status(400).json({ message: '必须提供入住日期和退房日期' });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ message: '日期格式必须为 YYYY-MM-DD' });
    }

    // 验证日期逻辑
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: '无效的日期' });
    }
    if (start >= end) {
      return res.status(400).json({ message: '退房日期必须晚于入住日期' });
    }

    console.log('查询可用房间:', { startDate, endDate, typeCode });
    const availableRooms = await roomModule.getAvailableRooms(startDate, endDate, typeCode);

    res.json({
      data: availableRooms,
      query: { startDate, endDate, typeCode }
    });
  } catch (err) {
    console.error('查询可用房间失败:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
});

// 获取特定ID的房间
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const room = await roomModule.getRoomById(id);

    if (!room) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: room });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定房间号的房间
router.get('/number/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const room = await roomModule.getRoomByNumber(number);

    if (!room) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: room });
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
    const room = await roomModule.updateRoomStatus(id, 'repair');

    if (!room) {
      return res.status(404).json({ message: '未找到房间' });
    }

    return res.json({
      message: '房间状态已更新为维修',
      data: room
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
