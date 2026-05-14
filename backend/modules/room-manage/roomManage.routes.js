const express = require('express');
const controller = require('./roomManage.controller');

const router = express.Router();
const roomTypeRouter = express.Router();

// 查询指定日期范围内可下单的房间。
router.get('/available', controller.listAvailableRooms);

// 根据房间号查询单个房间。
router.get('/number/:number', controller.getRoomByNumber);

// 新增房间。
router.post('/', controller.addRoom);

// 修改房间基础信息。
router.put('/:room_number', controller.updateRoom);

// 删除房间。
router.delete('/:room_number', controller.deleteRoom);

// 查询房型列表。
roomTypeRouter.get('/', controller.listRoomTypes);

// 根据房型编码查询房型。
roomTypeRouter.get('/:code', controller.getRoomTypeByCode);

// 新增房型。
roomTypeRouter.post('/', controller.addRoomType);

// 修改房型，并同步该房型下房间的基础价格。
roomTypeRouter.put('/:code', controller.updateRoomType);

// 删除房型。
roomTypeRouter.delete('/:code', controller.deleteRoomType);

router.roomTypeRoutes = roomTypeRouter;

module.exports = router;
