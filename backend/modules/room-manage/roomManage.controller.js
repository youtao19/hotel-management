const roomManageService = require('./roomManage.service');
const {
  normalizeCalendarBoardQuery,
  normalizeRoomListQuery,
  validateDateRange,
  validateRoom,
  validateRoomStatusBody
} = require('./roomManage.validator');

function handleDateError(err, res, message = '无效的日期') {
  if (err?.code === '22007') {
    return res.status(400).json({ message });
  }
  return null;
}

/**
 * 给房态页提供房间列表。
 * 单日房态由后端统一计算 display_status，避免前端自己拼订单和房态。
 */
async function listRooms(req, res) {
  try {
    const { filters, error } = normalizeRoomListQuery(req.query || {});
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    if (filters.date) {
      console.log(`查询 ${filters.date} 日期的房间状态`);
    }

    const result = await roomManageService.listRooms(filters);

    return res.status(200).json({
      data: result.rows,
      summary: result.summary,
      query: filters,
      message: filters.date ? `查询到 ${filters.date} 的房间状态` : '查询到当前房间状态'
    });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    const handled = handleDateError(err, res);
    if (handled) return handled;
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
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

/**
 * 给日历按天渲染指定房间的房态。
 * 返回空数组时仍沿用旧接口的 404 语义。
 */
async function getRoomStatusRange(req, res) {
  try {
    const { roomNumber, startDate, endDate } = req.query;

    if (!roomNumber || !startDate || !endDate) {
      return res.status(400).json({ message: '必须提供 roomNumber, startDate, endDate' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ message: '日期格式必须为 YYYY-MM-DD' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ message: 'endDate 不能早于 startDate' });
    }

    const rows = await roomManageService.getRoomStatusRange(String(roomNumber), startDate, endDate);

    if (!rows.length) {
      return res.status(404).json({ message: '未找到房间或无数据' });
    }

    return res.status(200).json({
      data: rows,
      query: { roomNumber: String(roomNumber), startDate, endDate }
    });
  } catch (err) {
    console.error('查询日期范围房态失败:', err);
    const handled = handleDateError(err, res);
    if (handled) return handled;
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

/**
 * 给日历房主视图提供 14 天房态看板。
 * days 当前固定为 14，防止前端随意拉大范围拖慢主视图。
 */
async function getCalendarBoard(req, res) {
  try {
    const { filters, error } = normalizeCalendarBoardQuery(req.query || {});
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const result = await roomManageService.getCalendarBoard(filters);
    return res.status(200).json(result);
  } catch (err) {
    console.error('查询日历房数据失败:', err);
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

/**
 * 修改房间状态。
 * 维修状态会继续沿用旧规则同步 is_closed。
 */
async function updateRoomStatus(req, res) {
  try {
    const { number } = req.params;

    console.log('====== 房间状态更新请求 ======');
    console.log('请求参数房间号:', number);
    console.log('请求体:', req.body);
    console.log('Content-Type:', req.get('Content-Type'));

    const validationError = validateRoomStatusBody(req.body);
    if (validationError) {
      if (validationError.validStatuses) {
        console.log('无效的状态值:', validationError.requestedStatus);
        console.log('有效的状态值:', validationError.validStatuses);
        return res.status(400).json(validationError);
      }
      console.log(validationError.message);
      return res.status(400).json({ message: validationError.message });
    }

    console.log('请求的状态值:', req.body.status);
    const result = await roomManageService.updateRoomStatus(number, req.body.status);

    if (!result) {
      return res.status(404).json({ message: '未找到房间' });
    }

    console.log('更新成功:', result);
    return res.json({ data: result });
  } catch (err) {
    console.error('更新房间状态错误:', err);
    return res.status(500).json({ message: '服务器错误' });
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

/**
 * 给订单编辑页整单更换房间。
 * 是否允许换房、跨房型和日期冲突由后端业务层统一判断。
 */
async function changeOrderRoom(req, res) {
  try {
    console.log('=== 更换房间API请求 ===');
    console.log('请求体:', JSON.stringify(req.body, null, 2));
    console.log('Content-Type:', req.get('Content-Type'));

    const { orderNumber, oldRoomNumber, newRoomNumber } = req.body;

    if (!orderNumber || !oldRoomNumber || !newRoomNumber) {
      console.log('参数验证失败:', { orderNumber, oldRoomNumber, newRoomNumber });
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：订单号、原房间号或新房间号',
        received: { orderNumber, oldRoomNumber, newRoomNumber }
      });
    }

    console.log('更换房间请求参数:', { orderNumber, oldRoomNumber, newRoomNumber });
    const result = await roomManageService.changeOrderRoom(orderNumber, oldRoomNumber, newRoomNumber);

    console.log('更换房间成功:', result);
    return res.json(result);
  } catch (error) {
    console.error('更换房间失败:', error.message);
    const clientErrorCodes = [
      'MISSING_PARAMS', 'SAME_ROOM', 'ORDER_STATUS_INVALID', 'NEW_ROOM_NOT_FOUND',
      'NEW_ROOM_CLOSED', 'NEW_ROOM_REPAIR', 'NEW_ROOM_NOT_AVAILABLE', 'NEW_ROOM_CONFLICT'
    ];
    const status = clientErrorCodes.includes(error.code) ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || '更换房间失败',
      code: error.code || (status === 400 ? 'ROOM_CHANGE_VALIDATION' : 'ROOM_CHANGE_SERVER'),
      stack: process.env.NODE_ENV === 'dev' ? error.stack : undefined
    });
  }
}

module.exports = {
  addRoom,
  changeOrderRoom,
  deleteRoom,
  getCalendarBoard,
  getRoomByNumber,
  getRoomStatusRange,
  listAvailableRooms,
  listRooms,
  updateRoom,
  updateRoomStatus
};
