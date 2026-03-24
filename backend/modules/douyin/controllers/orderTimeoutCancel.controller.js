const { cancelUnpaidDouyinOrder } = require('../services/orderTimeoutCancel.service')
const { resolveDouyinBusinessError } = require('../utils/douyinError')

/**
 * 手动标记未支付超时取消。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function cancelUnpaidDouyinOrderController(req, res) {
  const otaOrderId = String(req.body?.otaOrderId || '').trim()
  const reason = String(req.body?.reason || '').trim()

  if (!otaOrderId) {
    return res.status(400).json({
      success: false,
      message: 'otaOrderId is required',
    })
  }

  try {
    const result = await cancelUnpaidDouyinOrder({
      otaOrderId,
      reason,
    })

    return res.json({
      success: true,
      action: result.action,
      otaOrderId: result.otaOrderId,
      reason: result.reason,
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
  cancelUnpaidDouyinOrderController,
}
