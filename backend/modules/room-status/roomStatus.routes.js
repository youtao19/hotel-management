const express = require('express');
const controller = require('./roomStatus.controller');

const router = express.Router();

// 查询单日房态列表和汇总。
router.get('/', controller.listRoomStatus);

// 查询指定房间在日期区间内的每日房态。
router.get('/status-range', controller.getRoomStatusRange);

// 查询房间状态日历主视图。
router.get('/calendar-board', controller.getCalendarBoard);

// 手动修改房间基础状态。
router.patch('/:number/status', controller.updateRoomStatus);

module.exports = router;
