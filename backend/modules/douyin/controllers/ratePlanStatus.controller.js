const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { toggleDouyinRatePlanActive } = require('../services/ratePlanStatus.service')

/**
 * 提取商品上下架请求参数。
 *
 * @param {Object} body 请求体。
 * @returns {{roomId:string, ratePlanId:string, accountId:string, active:boolean|null}} 参数对象。
 */
function resolveRatePlanStatusBody(body = {}) {
  return {
    roomId: String(body.roomId || '').trim(),
    ratePlanId: String(body.ratePlanId || '').trim(),
    accountId: body.accountId === undefined ? '' : String(body.accountId || '').trim(),
    active: typeof body.active === 'boolean' ? body.active : null,
  }
}

/**
 * 手动更新抖音日历房商品上下架状态。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function updateDouyinRatePlanStatusController(req, res) {
  const payload = resolveRatePlanStatusBody(req.body || {})

  if (!payload.roomId) {
    return res.status(400).json({
      success: false,
      message: 'roomId is required',
    })
  }

  if (!payload.ratePlanId) {
    return res.status(400).json({
      success: false,
      message: 'ratePlanId is required',
    })
  }

  if (payload.active === null) {
    return res.status(400).json({
      success: false,
      message: 'active must be boolean',
    })
  }

  try {
    const result = await toggleDouyinRatePlanActive(payload)

    return res.json({
      success: true,
      action: result.action,
      status: result.status,
      payload: result.payload,
      result: result.result,
      savedRoom: result.savedRoom,
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
  resolveRatePlanStatusBody,
  updateDouyinRatePlanStatusController,
}
