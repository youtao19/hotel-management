const express = require('express');
const router = express.Router();
const roomModule = require('../modules/roomModule');
const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require('ajv-formats');
addFormats(ajv);
const { query } = require('../database/postgreDB/pg');


const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

const RoomSchema = {
  type: 'object',
  properties: {
    room_number: { type: 'string' },
    type_code: { type: 'string' },
    status: { type: 'string', enum: VALID_ROOM_STATES },
    price: { type: 'number' }
  },
  required: ['room_number', 'type_code', 'status', 'price'],
  additionalProperties: false
};

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
    if (startDate > endDate) {
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
    if (err?.code === '22007') {
      return res.status(400).json({ message: '无效的日期' });
    }
    res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
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

// 添加新房间
router.post('/', async (req, res) => {
  try {
    const { room_number, type_code, status, price } = req.body;

    // 验证必要字段
    const validate = ajv.compile(RoomSchema);
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式错误', errors: validate.errors });
    }

    // 使用roomModule的addRoom方法
    const newRoom = await roomModule.addRoom({ room_number, type_code, status, price });
    console.log('成功添加房间:', newRoom);
    res.status(201).json({ data: newRoom });
  } catch (err) {
    console.error('添加房间错误:', err);
    if (err.code === 'ROOM_EXISTS' || err.message === '房间号已存在') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'ROOM_TYPE_NOT_FOUND') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === '23505') {
      return res.status(400).json({ message: '房间号已存在' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ message: '关联的房型不存在或已删除' });
    }
    if (err.code === '23502' && err.column === 'room_id') {
      return res.status(500).json({ message: '房间表缺少 room_id 默认值，请联系管理员配置数据库' });
    }
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 更新房间信息
router.put('/:room_number', async (req, res) => {
  try {
    const { room_number } = req.params;
    const { type_code, status, price } = req.body;

    // 验证必要字段
    const validate = ajv.compile(RoomSchema);
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式错误', errors: validate.errors });
    }

    // 检查房间是否存在
    const existingRoom = await roomModule.getRoomByNumber(room_number);
    if (!existingRoom) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 更新房间信息
    const { rows } = await query(
      'UPDATE rooms SET type_code = $1, status = $2, price = $3 WHERE room_number = $4 RETURNING *',
      [type_code, status, price, room_number]
    );

    console.log('成功更新房间:', rows[0]);
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新房间错误:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 删除房间
router.delete('/:room_number', async (req, res) => {
  try {
    const { room_number } = req.params;

    // 检查房间是否存在
    const existingRoom = await roomModule.getRoomByNumber(room_number);
    if (!existingRoom) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 检查房间是否有活跃订单
    const orderCheck = await query(
      'SELECT COUNT(*) as count FROM orders WHERE room_number = $1 AND status IN ($2, $3)',
      [room_number, 'pending', 'checked-in']
    );

    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: '无法删除，房间有活跃订单' });
    }

    // 删除房间
    await query('DELETE FROM rooms WHERE room_number = $1', [room_number]);

    console.log('成功删除房间:', existingRoom.room_number);
    res.json({ message: '房间删除成功' });
  } catch (err) {
    console.error('删除房间错误:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
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
