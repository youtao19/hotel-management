const express = require('express')
const router = express.Router()

const {
  refreshClientToken,
  testOpenApi,
  receiveSpiCallback,
} = require('../../modules/douyin/controllers/hotelBooking.controller')

const {
  confirmOrder,
} = require('../../modules/douyin/controllers/confirmOrder.controllers')

const {
  receiveCancelCallback,
} = require('../../modules/douyin/controllers/cancelOrder.controller')
const {
  receiveDouyinRefundResultCallback,
} = require('../../modules/douyin/controllers/refundResult.controller')
const {
  receiveDouyinRefundCaseCallback,
} = require('../../modules/douyin/controllers/refundCase.controller')
const {
  receiveDouyinHotelInfoWebhookCallback,
} = require('../../modules/douyin/controllers/hotelInfoWebhook.controller')
const {
  receivePresaleSpiCallback,
} = require('../../modules/douyin/controllers/presaleBooking.controller')
const {
  receiveBookableCheckCallback,
} = require('../../modules/douyin/controllers/bookableCheck.controller')
const {
  receiveDouyinAriPullCallback,
} = require('../../modules/douyin/controllers/ariPull.controller')
const {
  notifyDouyinAriController,
  previewDouyinAriController,
  pushDouyinPriceController,
  pushDouyinStockController,
} = require('../../modules/douyin/controllers/ari.controller')
const {
  pushDouyinCheckInController,
  pushDouyinCheckOutController,
} = require('../../modules/douyin/controllers/fulfillmentSync.controller')
const {
  createDouyinPhysicalRoomController,
} = require('../../modules/douyin/controllers/physicalRoomCreate.controller')
const {
  updateDouyinPhysicalRoomStatusController,
} = require('../../modules/douyin/controllers/physicalRoomStatus.controller')
const {
  createDouyinRatePlanController,
} = require('../../modules/douyin/controllers/ratePlanCreate.controller')
const {
  syncDouyinProductController,
} = require('../../modules/douyin/controllers/douyinProduct.controller')
const {
  updateDouyinRatePlanStatusController,
} = require('../../modules/douyin/controllers/ratePlanStatus.controller')
const {
  listDouyinRatePlansController,
} = require('../../modules/douyin/controllers/ratePlanList.controller')
const {
  cancelUnpaidDouyinOrderController,
} = require('../../modules/douyin/controllers/orderTimeoutCancel.controller')
const {
  queryDouyinHotelInfoController,
  syncDouyinHotelInfoController,
} = require('../../modules/douyin/controllers/hotelInfoFetch.controller')
const {
  listDouyinRoomTypeMappingsController,
  saveDouyinRoomTypeMappingsController,
} = require('../../modules/douyin/controllers/roomTypeMappingManage.controller')

const {
  verifyDouyinSignMiddleware,
} = require('../../modules/douyin/middlewares/verifyDouyinSign.middleware')
const {
  verifyDouyinWebhookMiddleware,
} = require('../../modules/douyin/middlewares/verifyDouyinWebhook.middleware')

const {
  syncDouyinPhysicalRooms,
} = require('../../modules/douyin/services/physicalRoom.service')

router.post('/token/refresh', refreshClientToken)
router.post('/openapi/test', testOpenApi)
router.post('/callback/spi', verifyDouyinSignMiddleware, receiveSpiCallback)
router.post('/callback/presale', verifyDouyinSignMiddleware, receivePresaleSpiCallback)
router.post('/callback/bookable', verifyDouyinSignMiddleware, receiveBookableCheckCallback)
router.post('/callback/ari-pull', verifyDouyinSignMiddleware, receiveDouyinAriPullCallback)
router.post('/callback/cancel', verifyDouyinSignMiddleware, receiveCancelCallback)
router.post('/callback/refund-result', verifyDouyinSignMiddleware, receiveDouyinRefundResultCallback)
router.post('/callback/refund-case', verifyDouyinSignMiddleware, receiveDouyinRefundCaseCallback)
router.post('/callback/hotel-info', verifyDouyinWebhookMiddleware, receiveDouyinHotelInfoWebhookCallback)
router.post('/order/confirm', confirmOrder)
router.post('/order/timeout-cancel', cancelUnpaidDouyinOrderController)
router.post('/order/check-in', pushDouyinCheckInController)
router.post('/order/check-out', pushDouyinCheckOutController)
router.post('/physical-room/create', createDouyinPhysicalRoomController)
router.post('/physical-room/status', updateDouyinPhysicalRoomStatusController)
router.get('/rate-plans', listDouyinRatePlansController)
router.post('/rate-plan/sync', syncDouyinProductController)
router.post('/rate-plan/create', createDouyinRatePlanController)
router.post('/rate-plan/status', updateDouyinRatePlanStatusController)
router.post('/hotel-info/query', queryDouyinHotelInfoController)
router.post('/hotel-info/sync', syncDouyinHotelInfoController)
router.get('/room-type-mapping', listDouyinRoomTypeMappingsController)
router.post('/room-type-mapping', saveDouyinRoomTypeMappingsController)
router.post('/ari/preview', previewDouyinAriController)
router.post('/ari/stock/push', pushDouyinStockController)
router.post('/ari/price/push', pushDouyinPriceController)
router.post('/ari/notify', notifyDouyinAriController)

router.post('/callback/spi/mock',receiveSpiCallback)
router.post('/callback/presale/mock', receivePresaleSpiCallback)
router.post('/callback/bookable/mock', receiveBookableCheckCallback)
router.post('/callback/ari-pull/mock', receiveDouyinAriPullCallback)
router.post('/callback/cancel/mock', receiveCancelCallback)
router.post('/callback/refund-result/mock', receiveDouyinRefundResultCallback)
router.post('/callback/refund-case/mock', receiveDouyinRefundCaseCallback)
router.post('/callback/hotel-info/mock', receiveDouyinHotelInfoWebhookCallback)

router.post('/physical-rooms/sync', async (req, res) => {
  try {
    const { accountId, page = 1, size = 50 } = req.body
    const result = await syncDouyinPhysicalRooms({ accountId, page, size })
    res.json({
      success: true,
      result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

module.exports = router
