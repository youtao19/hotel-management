const roomManageService = require('./roomManage.service');
const {
  validateDateRange,
  validateRoom,
  validateRoomType
} = require('./roomManage.validator');

function handleDateError(err, res, message = '无效的日期') {
  if (err?.code === '22007') {
    return res.status(400).json({ message });
  }
  return null;
}

/**
 * 给创建订单和换房流程查询可用房。
 * 同日入住退房按休息房处理，日期仍以 YYYY-MM-DD 字符串传给业务层。
 */
async function listAvailableRooms(req, res) {
  try {
    const { startDate, endDate, typeCode } = req.query;
    const validationError = validateDateRange(startDate, endDate);
    if (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    console.log('查询可用房间:', { startDate, endDate, typeCode });
    const availableRooms = await roomManageService.listAvailableRooms(startDate, endDate, typeCode);

    return res.json({
      data: availableRooms,
      query: { startDate, endDate, typeCode }
    });
  } catch (err) {
    console.error('查询可用房间失败:', err);
    const handled = handleDateError(err, res);
    if (handled) return handled;
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

async function getRoomByNumber(req, res) {
  try {
    const { number } = req.params;
    const room = await roomManageService.getRoomByNumber(number);

    if (!room) {
      return res.status(404).json({ message: '未找到房间' });
    }

    return res.json({ data: room });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
}

async function listRoomTypes(req, res) {
  try {
    console.log('获取所有房型请求');
    const roomTypes = await roomManageService.listRoomTypes();
    console.log(`成功获取 ${roomTypes.length} 条房型数据`);
    return res.status(200).json({ data: roomTypes });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
}

async function getRoomTypeByCode(req, res) {
  try {
    const { code } = req.params;
    console.log(`获取房型代码: ${code}`);

    const roomType = await roomManageService.getRoomTypeByCode(code);
    if (!roomType) {
      return res.status(404).json({ message: '未找到房型' });
    }

    return res.status(200).json({ data: roomType });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
}

async function addRoomType(req, res) {
  try {
    const { type_code, type_name, base_price, description } = req.body;

    const valid = validateRoomType(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式错误', errors: validateRoomType.errors });
    }

    const newRoomType = await roomManageService.addRoomType({
      type_code,
      type_name,
      base_price,
      description
    });

    console.log('成功添加房型:', newRoomType);
    return res.status(201).json({ data: newRoomType });
  } catch (err) {
    console.error('添加房型错误:', err);
    if (err.code === 'ROOM_TYPE_EXISTS') {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

async function updateRoomType(req, res) {
  try {
    const { code } = req.params;
    const { type_name, base_price, description } = req.body;

    const valid = validateRoomType(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式错误', errors: validateRoomType.errors });
    }

    const result = await roomManageService.updateRoomType(code, { type_name, base_price, description });
    if (!result.updatedRoomType) {
      return res.status(404).json({ message: '房型不存在' });
    }

    console.log('成功更新房型并同步房价:', {
      roomType: result.updatedRoomType,
      affectedRooms: result.syncedRooms
    });

    return res.status(200).json({
      data: result.updatedRoomType,
      syncedRooms: result.syncedRooms
    });
  } catch (err) {
    console.error('更新房型错误:', err);
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

async function deleteRoomType(req, res) {
  try {
    const { code } = req.params;

    const result = await roomManageService.deleteRoomType(code);
    if (result.reason === 'orders') {
      return res.status(400).json({ message: '无法删除，还有订单使用此房型' });
    }
    if (result.reason === 'rooms') {
      return res.status(400).json({ message: '无法删除，还有房间使用此房型' });
    }
    if (result.reason === 'not_found') {
      return res.status(404).json({ message: '房型不存在' });
    }

    console.log('成功删除房型:', code);
    return res.status(200).json({ message: '房型删除成功' });
  } catch (err) {
    console.error('删除房型错误:', err);
    if (err.code === '23503') {
      return res.status(400).json({ message: '无法删除，存在关联数据' });
    }
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

async function addRoom(req, res) {
  try {
    const { room_number, type_code, status, price } = req.body;

    const valid = validateRoom(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式错误', errors: validateRoom.errors });
    }

    const newRoom = await roomManageService.addRoom({ room_number, type_code, status, price });
    console.log('成功添加房间:', newRoom);
    return res.status(201).json({ data: newRoom });
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
    return res.status(500).json({ message: '服务器错误', error: err.message });
  }
}

async function updateRoom(req, res) {
  try {
    const { room_number } = req.params;
    const { type_code, status, price } = req.body;

    const valid = validateRoom(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式错误', errors: validateRoom.errors });
    }

    const updatedRoom = await roomManageService.updateRoom(room_number, { type_code, status, price });
    if (!updatedRoom) {
      return res.status(404).json({ message: '房间不存在' });
    }

    console.log('成功更新房间:', updatedRoom);
    return res.json({ data: updatedRoom });
  } catch (err) {
    console.error('更新房间错误:', err);
    return res.status(500).json({ message: '服务器错误', error: err.message });
  }
}

async function deleteRoom(req, res) {
  try {
    const { room_number } = req.params;

    const result = await roomManageService.deleteRoom(room_number);
    if (result.reason === 'not_found') {
      return res.status(404).json({ message: '房间不存在' });
    }
    if (result.reason === 'active_orders') {
      return res.status(400).json({ message: '无法删除，房间有活跃订单' });
    }
    return res.json({ message: '房间删除成功' });
  } catch (err) {
    console.error('删除房间错误:', err);
    return res.status(500).json({ message: '服务器错误', error: err.message });
  }
}

module.exports = {
  addRoom,
  addRoomType,
  deleteRoom,
  deleteRoomType,
  getRoomByNumber,
  getRoomTypeByCode,
  listAvailableRooms,
  listRoomTypes,
  updateRoom,
  updateRoomType
};
