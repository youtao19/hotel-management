const { resolveDouyinBusinessError } = require('../utils/douyinError')
const {
  pushDouyinCheckIn,
  pushDouyinCheckOut,
} = require('../services/fulfillmentSync.service')

/**
 * 解析并校验本地订单号。
 *
 * @param {Object} body 请求体。
 * @returns {string} 订单号。
 */
function resolveOrderIdFromBody(body = {}) {
  return String(body.orderId || '').trim()
}

/**
 * 手动推送入住状态。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function pushDouyinCheckInController(req, res) {
  const orderId = resolveOrderIdFromBody(req.body || {})

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'orderId is required',
    })
  }

  try {
    const result = await pushDouyinCheckIn({ orderId })

    return res.json({
      success: true,
      action: result.action,
      status: result.status,
      payload: result.payload,
      result: result.result,
    })
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.status(400).json({
      success: false,
      errorCode,
      message: description,
    })
  }
}

/**
 * 手动推送离店状态。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function pushDouyinCheckOutController(req, res) {
  const orderId = resolveOrderIdFromBody(req.body || {})

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'orderId is required',
    })
  }

  try {
    const result = await pushDouyinCheckOut({ orderId })

    return res.json({
      success: true,
      action: result.action,
      status: result.status,
      payload: result.payload,
      result: result.result,
    })
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.status(400).json({
      success: false,
      errorCode,
      message: description,
    })
  }
}

module.exports = {
  pushDouyinCheckInController,
  pushDouyinCheckOutController,
  resolveOrderIdFromBody,
}
