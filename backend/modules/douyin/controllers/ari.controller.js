const { resolveDouyinBusinessError } = require('../utils/douyinError')
const {
  buildDouyinAriByRatePlanIds,
  notifyDouyinAriRefresh,
  pushDouyinHotelPrice,
  pushDouyinHotelStock,
} = require('../services/ari.service')

/**
 * 从请求体中提取价量态请求参数。
 *
 * @param {Object} body 请求体。
 * @returns {{ratePlanIds:string[], startDate:string, endDate:string}} 参数对象。
 */
function resolveAriRequestBody(body = {}) {
  return {
    ratePlanIds: Array.isArray(body.ratePlanIds) ? body.ratePlanIds : [],
    startDate: String(body.startDate || '').trim(),
    endDate: String(body.endDate || '').trim(),
  }
}

/**
 * 预览本地价量态。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function previewDouyinAriController(req, res) {
  try {
    const payload = resolveAriRequestBody(req.body || {})
    const result = await buildDouyinAriByRatePlanIds(payload)

    return res.json({
      success: true,
      summary: result.summary,
      data: result.aris,
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
 * 手动推送房量房态。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function pushDouyinStockController(req, res) {
  try {
    const payload = resolveAriRequestBody(req.body || {})
    const result = await pushDouyinHotelStock(payload)

    return res.json({
      success: true,
      summary: result.summary,
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
 * 手动推送房价。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function pushDouyinPriceController(req, res) {
  try {
    const payload = resolveAriRequestBody(req.body || {})
    const result = await pushDouyinHotelPrice(payload)

    return res.json({
      success: true,
      summary: result.summary,
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
 * 通知抖音主动拉取价量态。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function notifyDouyinAriController(req, res) {
  try {
    const payload = resolveAriRequestBody(req.body || {})
    const result = await notifyDouyinAriRefresh(payload)

    return res.json({
      success: true,
      summary: result.summary,
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
  notifyDouyinAriController,
  previewDouyinAriController,
  pushDouyinPriceController,
  pushDouyinStockController,
  resolveAriRequestBody,
}
