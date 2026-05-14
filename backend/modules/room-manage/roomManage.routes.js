const express = require('express');
const controller = require('./roomManage.controller');

const router = express.Router();

// 查询房间列表，支持按单日、房型、房态和关键字筛选。
router.get('/', controller.listRooms);

// 查询指定日期范围内可下单的房间。
router.get('/available', controller.listAvailableRooms);

// 查询指定房间在日期范围内的每日房态。
router.get('/status-range', controller.getRoomStatusRange);

// 查询日历房主视图数据。
router.get('/calendar-board', controller.getCalendarBoard);

// 根据房间号查询单个房间。
router.get('/number/:number', controller.getRoomByNumber);

// 整单更换房间。
router.post('/change-room', controller.changeOrderRoom);

// 新增房间。
router.post('/', controller.addRoom);

// 修改房间状态。
router.patch('/:number/status', controller.updateRoomStatus);

// 修改房间基础信息。
router.put('/:room_number', controller.updateRoom);

// 删除房间。
router.delete('/:room_number', controller.deleteRoom);

module.exports = router;
