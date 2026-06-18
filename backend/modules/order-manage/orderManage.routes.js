const express = require('express');
const router = express.Router();
const roomRouter = express.Router();
const controller = require('./orderManage.controller');

router.use(express.json());

// 获取订单列表，支持搜索、状态和日期筛选。
router.get('/', controller.listOrders);

// 获取按入住日期拆分的订单每日明细。
router.get('/daily', controller.listDailyOrders);

// 获取提前退房的建议退款金额和可退日期。
router.get('/:orderNumber/early-checkout/recommendation', controller.getEarlyCheckoutRecommendation);

// 获取订单押金状态和当前可退金额。
router.get('/:order_id/deposit-info', controller.getDepositInfo);

// 获取单笔订单详情，多日订单返回所有日记录。
router.get('/:id', controller.getOrder);

// 修改订单状态。
router.post('/:orderNumber/status', controller.updateOrderStatus);

// 办理提前退房并生成退款相关结果。
router.post('/:orderNumber/early-checkout', controller.earlyCheckout);

// 办理订单退押金。
router.post('/:order_id/refund-deposit', controller.refundDeposit);

// 办理正常退房，并同步订单状态和房态。
router.post('/:orderId/check-out', controller.checkOut);

// 修改订单某一天的房间号。
router.put('/:orderNumber/day-room', controller.updateOrderDayRoom);

// 兼容旧路径：订单详情页整单更换房间。
roomRouter.post('/change-room', controller.changeOrderRoom);

// 同时修改订单信息、每日房价和相关账单。
router.put('/:orderNumber/with-bills', controller.updateOrderWithBills);

// 修改订单基础信息。
router.put('/:orderNumber', controller.updateOrder);

router.roomRoutes = roomRouter;

module.exports = router;
