const roomStatusService = require('./roomStatus.service');
const {
  VALID_ROOM_STATES,
  normalizeCalendarBoardQuery,
  normalizeRoomStatusQuery,
  normalizeStatusRangeQuery,
  validateUpdateRoomStatus
} = require('./roomStatus.validator');

/**
 * 给房间状态单日视图提供房态列表。
 * 展示房态由后端统一计算，前端只负责筛选输入和渲染。
 */
async function listRoomStatus(req, res) {
  try {
    const { filters, error } = normalizeRoomStatusQuery(req.query || {});
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const result = await roomStatusService.listRoomStatus(filters);

    return res.status(200).json({
      data: result.rows,
      summary: result.summary,
      query: filters,
      message: filters.date ? `查询到 ${filters.date} 的房间状态` : '查询到当前房间状态'
    });
  } catch (err) {
    console.error('获取房间状态数据错误:', err);
    if (err?.code === '22007') {
      return res.status(400).json({ message: '无效的日期' });
    }
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
}

/**
 * 给日历格子读取单个房间在日期区间内的每日房态。
 */
async function getRoomStatusRange(req, res) {
  try {
    const { filters, error } = normalizeStatusRangeQuery(req.query || {});
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const rows = await roomStatusService.getRoomStatusRange(
      filters.roomNumber,
      filters.startDate,
      filters.endDate
    );

    if (!rows.length) {
      return res.status(404).json({ message: '未找到房间或无数据' });
    }

    return res.status(200).json({
      data: rows,
      query: filters
    });
  } catch (err) {
    console.error('查询日期范围房态失败:', err);
    if (err?.code === '22007') {
      return res.status(400).json({ message: '无效的日期' });
    }
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

/**
 * 给房间状态日历主视图提供 14 天矩阵。
 * 当前前端只支持 14 天窗口，所以后端继续拒绝其他 days，避免响应结构漂移。
 */
async function getCalendarBoard(req, res) {
  try {
    const { filters, error } = normalizeCalendarBoardQuery(req.query || {});
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const result = await roomStatusService.getCalendarBoard(filters);
    return res.status(200).json(result);
  } catch (err) {
    console.error('查询日历房数据失败:', err);
    if (err?.code === '22007') {
      return res.status(400).json({ message: '无效的日期' });
    }
    return res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
}

/**
 * 手动修改房间基础状态。
 * 订单占用展示仍由查询时的 display_status 计算，不直接改订单状态。
 */
async function updateRoomStatus(req, res) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: '请求体为空' });
    }

    const valid = validateUpdateRoomStatus(req.body);
    if (!valid) {
      const statusError = validateUpdateRoomStatus.errors
        ?.find(error => error.instancePath === '/status' || error.params?.missingProperty === 'status');
      if (statusError?.params?.missingProperty === 'status') {
        return res.status(400).json({ message: '状态值未提供' });
      }
      return res.status(400).json({
        message: '无效的房间状态',
        requestedStatus: req.body.status,
        validStatuses: VALID_ROOM_STATES
      });
    }

    const { number } = req.params;
    const result = await roomStatusService.updateRoomStatus(number, req.body.status);

    if (!result) {
      return res.status(404).json({ message: '未找到房间' });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('更新房间状态错误:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
}

module.exports = {
  getCalendarBoard,
  getRoomStatusRange,
  listRoomStatus,
  updateRoomStatus
};
