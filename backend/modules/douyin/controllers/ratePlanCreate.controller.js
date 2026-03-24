const { douyinConfig } = require('../../../appSettings/douyin.config')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { createDouyinRatePlan } = require('../services/ratePlanCreate.service')

/**
 * 提取商品创建请求参数。
 *
 * @param {Object} body 请求体。
 * @returns {{localRoomType:string, poiId:string, roomId:string, accountId:string, mode:string, modeConfig:Object}} 参数对象。
 */
function resolveRatePlanCreateBody(body = {}) {
  return {
    localRoomType: String(body.localRoomType || '').trim(),
    poiId: String(body.poiId || '').trim(),
    roomId: String(body.roomId || '').trim(),
    accountId: String(body.accountId || douyinConfig.accountId || '').trim(),
    mode: String(body.mode || 'meal').trim().toLowerCase(),
    // modeConfig 只做透传，复杂规则放到服务层统一校验。
    modeConfig: body.modeConfig && typeof body.modeConfig === 'object' && !Array.isArray(body.modeConfig)
      ? body.modeConfig
      : body.modeConfig === undefined
        ? {}
        : body.modeConfig,
  }
}

/**
 * 手动创建抖音日历房商品。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function createDouyinRatePlanController(req, res) {
  const payload = resolveRatePlanCreateBody(req.body || {})

  if (!payload.localRoomType) {
    return res.status(400).json({
      success: false,
      message: 'localRoomType is required',
    })
  }

  if (!payload.poiId) {
    return res.status(400).json({
      success: false,
      message: 'poiId is required',
    })
  }

  if (!payload.roomId) {
    return res.status(400).json({
      success: false,
      message: 'roomId is required',
    })
  }

  if (!payload.accountId) {
    return res.status(400).json({
      success: false,
      message: 'accountId is required',
    })
  }

  try {
    const result = await createDouyinRatePlan(payload)

    return res.json({
      success: true,
      action: result.action,
      mode: result.mode,
      payload: result.payload,
      saveResult: result.saveResult,
      ratePlan: result.ratePlan,
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
  createDouyinRatePlanController,
  resolveRatePlanCreateBody,
}
