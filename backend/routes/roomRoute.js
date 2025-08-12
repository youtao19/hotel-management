const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const roomModule = require('../modules/roomModule');
const { authenticationMiddleware } = require('../modules/authentication');

const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

// 获取所有房间
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;

    // 如果提供了日期参数，验证日期格式
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ message: '日期格式必须为 YYYY-MM-DD' });
      }

      const queryDate = new Date(date);
      if (isNaN(queryDate.getTime())) {
        return res.status(400).json({ message: '无效的日期' });
      }

      console.log(`查询 ${date} 日期的房间状态`);
    }

    const rooms = await roomModule.getAllRooms(date);

    if (rooms.length === 0) {
      res.json({ data: [], message: '没有查询到房间数据' });
    } else {
      res.json({
        data: rooms,
        queryDate: date || null,
        message: date ? `查询到 ${date} 的房间状态` : '查询到当前房间状态'
      });
    }
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
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

    // 验证日期逻辑（允许同一天入住和退房，支持休息房）
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: '无效的日期' });
    }
    if (start > end) {
      return res.status(400).json({ message: '退房日期不能早于入住日期' });
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
router.post('/:id/status', async (req, res) => {
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

    // 使用roomModule的addRoom方法
    const newRoom = await roomModule.addRoom({ room_number, type_code, status, price });
    console.log('成功添加房间:', newRoom);
    res.status(201).json({ data: newRoom });
  } catch (err) {
    console.error('添加房间错误:', err);
    if (err.message === '房间号已存在') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 更新房间信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, type_code, status, price } = req.body;

    // 验证必要字段
    if (!room_number || !type_code || !status || price === undefined) {
      return res.status(400).json({ message: '缺少必要字段' });
    }

    // 检查房间是否存在
    const existingRoom = await roomModule.getRoomById(id);
    if (!existingRoom) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 如果房间号发生变化，检查新房间号是否已存在
    if (room_number !== existingRoom.room_number) {
      const checkResult = await roomModule.getRoomByNumber(room_number);
      if (checkResult) {
        return res.status(400).json({ message: '房间号已存在' });
      }
    }

    // 更新房间信息
    const { query } = require('../database/postgreDB/pg');
    const { rows } = await query(
      'UPDATE rooms SET room_number = $1, type_code = $2, status = $3, price = $4 WHERE room_id = $5 RETURNING *',
      [room_number, type_code, status, price, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '房间不存在' });
    }

    console.log('成功更新房间:', rows[0]);
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新房间错误:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 删除房间
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查房间是否存在
    const existingRoom = await roomModule.getRoomById(id);
    if (!existingRoom) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 检查房间是否有活跃订单
    const { query } = require('../database/postgreDB/pg');
    const orderCheck = await query(
      'SELECT COUNT(*) as count FROM orders WHERE room_number = $1 AND status IN ($2, $3)',
      [existingRoom.room_number, 'pending', 'checked-in']
    );

    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: '无法删除，房间有活跃订单' });
    }

    // 删除房间
    await query('DELETE FROM rooms WHERE room_id = $1', [id]);

    console.log('成功删除房间:', existingRoom.room_number);
    res.json({ message: '房间删除成功' });
  } catch (err) {
    console.error('删除房间错误:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 测试路由
router.post('/test-change-room', async (req, res) => {
  console.log('=== 测试更换房间路由 ===');
  console.log('请求到达了路由处理器');
  res.json({ message: '路由正常工作', timestamp: new Date().toISOString() });
});

// 更换房间
router.post('/change-room', async (req, res) => {
  try {
    console.log('=== 更换房间API请求 ===');
    console.log('请求体:', JSON.stringify(req.body, null, 2));
    console.log('Content-Type:', req.get('Content-Type'));

    const { orderNumber, oldRoomNumber, newRoomNumber } = req.body;

    // 验证必要参数
    if (!orderNumber || !oldRoomNumber || !newRoomNumber) {
      console.log('参数验证失败:', { orderNumber, oldRoomNumber, newRoomNumber });
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：订单号、原房间号或新房间号',
        received: { orderNumber, oldRoomNumber, newRoomNumber }
      });
    }

    console.log('更换房间请求参数:', { orderNumber, oldRoomNumber, newRoomNumber });

    // 调用房间模块的更换房间功能
    const result = await roomModule.changeOrderRoom(orderNumber, oldRoomNumber, newRoomNumber);

    console.log('更换房间成功:', result);
    res.json(result);
  } catch (error) {
    console.error('更换房间失败:', error.message);
    const clientErrorCodes = [
      'MISSING_PARAMS', 'SAME_ROOM', 'ORDER_STATUS_INVALID', 'NEW_ROOM_NOT_FOUND',
      'NEW_ROOM_CLOSED', 'NEW_ROOM_REPAIR', 'NEW_ROOM_NOT_AVAILABLE', 'NEW_ROOM_CONFLICT'
    ];
    const status = clientErrorCodes.includes(error.code) ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || '更换房间失败',
      code: error.code || (status === 400 ? 'ROOM_CHANGE_VALIDATION' : 'ROOM_CHANGE_SERVER'),
      stack: process.env.NODE_ENV === 'dev' ? error.stack : undefined
    });
  }
});

module.exports = router;
