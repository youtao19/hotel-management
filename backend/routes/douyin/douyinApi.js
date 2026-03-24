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
  receivePresaleSpiCallback,
} = require('../../modules/douyin/controllers/presaleBooking.controller')

const {
  verifyDouyinSignMiddleware,
} = require('../../modules/douyin/middlewares/verifyDouyinSign.middleware')

const {
  syncDouyinPhysicalRooms,
} = require('../../modules/douyin/services/physicalRoom.service')

router.post('/token/refresh', refreshClientToken)
router.post('/openapi/test', testOpenApi)
router.post('/callback/spi', verifyDouyinSignMiddleware, receiveSpiCallback)
router.post('/callback/presale', verifyDouyinSignMiddleware, receivePresaleSpiCallback)
router.post('/callback/cancel', verifyDouyinSignMiddleware, receiveCancelCallback)
router.post('/order/confirm', confirmOrder)

router.post('/callback/spi/mock',receiveSpiCallback)
router.post('/callback/presale/mock', receivePresaleSpiCallback)
router.post('/callback/cancel/mock', receiveCancelCallback)

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
