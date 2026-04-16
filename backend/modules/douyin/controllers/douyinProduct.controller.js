"use strict";

const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { syncProductToDouyin } = require('../services/douyinProductService')

/**
 * 提取本地套餐同步请求参数。
 *
 * @param {Object} body 请求体。
 * @returns {{localRatePlanId:number, accountId:string, poiId:string, mode:string, modeConfig:Object}} 参数对象。
 */
function resolveDouyinProductSyncBody(body = {}) {
  return {
    localRatePlanId: Number(body.localRatePlanId || body.local_rate_plan_id || 0),
    accountId: String(body.accountId || body.account_id || '').trim(),
    poiId: String(body.poiId || body.poi_id || '').trim(),
    mode: String(body.mode || 'meal').trim().toLowerCase(),
    // controller 保留原始结构，具体模式规则由 service 统一判断。
    modeConfig: body.modeConfig && typeof body.modeConfig === 'object' && !Array.isArray(body.modeConfig)
      ? body.modeConfig
      : body.modeConfig === undefined
        ? {}
        : body.modeConfig,
  }
}

/**
 * 同步本地套餐到抖音。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function syncDouyinProductController(req, res) {
  const payload = resolveDouyinProductSyncBody(req.body || {})

  if (!Number.isInteger(payload.localRatePlanId) || payload.localRatePlanId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'localRatePlanId is required',
    })
  }

  try {
    const result = await syncProductToDouyin(payload)

    return res.json({
      success: true,
      action: result.action,
      mode: result.mode,
      payload: result.payload,
      saveResult: result.saveResult,
      ratePlan: result.ratePlan,
      savedRoom: result.savedRoom,
      savedMapping: result.savedMapping,
      douyinRatePlanId: result.ratePlan?.rate_plan_id || result.savedMapping?.channel_item_id || null,
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
  resolveDouyinProductSyncBody,
  syncDouyinProductController,
}
