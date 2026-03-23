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
  verifyDouyinSignMiddleware,
} = require('../../modules/douyin/middlewares/verifyDouyinSign.middleware')

router.post('/token/refresh', refreshClientToken)
router.post('/openapi/test', testOpenApi)
router.post('/callback/spi', verifyDouyinSignMiddleware, receiveSpiCallback)
router.post('/order/confirm', confirmOrder)

router.post('/callback/spi/mock',receiveSpiCallback)

module.exports = router
