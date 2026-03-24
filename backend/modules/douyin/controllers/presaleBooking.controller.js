const { DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { handleDouyinPresaleBooking } = require('../services/presaleBooking.service')

/**
 * 从预售创单请求体中提取抖音订单号。
 *
 * @param {Object} payload 原始请求体。
 * @returns {string} 抖音订单号。
 */
function resolveDouyinOrderId(payload = {}) {
  return String(payload.order_id || '').trim()
}

/**
 * 从请求头中提取抖音请求 logid。
 *
 * @param {import('express').Request} req Express 请求对象。
 * @returns {string} 抖音请求 logid。
 */
function resolveDouyinRequestLogId(req) {
  /** @type {Record<string, string|string[]|undefined>} 请求头对象。 */
  const headers = req?.headers || {}
  /** @type {string|string[]|undefined} 抖音请求头中的 logid。 */
  const rawLogId = headers['x-bytedance-logid']

  if (Array.isArray(rawLogId)) {
    return String(rawLogId[0] || '').trim()
  }

  return String(rawLogId || '').trim()
}

/**
 * 构建预售券创单成功响应。
 *
 * @param {Object} params 响应参数。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {string} params.orderOutId 第三方订单号。
 * @returns {{data:Object}} 官方响应结构。
 */
function buildDouyinPresaleSuccessResponse({ otaOrderId, orderOutId }) {
  return {
    data: {
      error_code: DOUYIN_SUCCESS_RESULT.code,
      description: DOUYIN_SUCCESS_RESULT.description,
      order_id: otaOrderId,
      order_out_id: orderOutId,
    },
  }
}

/**
 * 构建预售券创单失败响应。
 *
 * @param {Object} params 响应参数。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {number} params.errorCode 错误码。
 * @param {string} params.description 错误描述。
 * @returns {{data:Object}} 官方响应结构。
 */
function buildDouyinPresaleErrorResponse({ otaOrderId, errorCode, description }) {
  return {
    data: {
      error_code: errorCode,
      description,
      order_id: otaOrderId,
    },
  }
}

/**
 * 处理抖音预售券创单 SPI 回调。
 *
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<import('express').Response>} 处理结果。
 */
async function receivePresaleSpiCallback(req, res) {
  /** @type {string} 抖音订单号。 */
  const otaOrderId = resolveDouyinOrderId(req.body || {})
  /** @type {string} 抖音请求链路 logid。 */
  const requestLogId = resolveDouyinRequestLogId(req)

  try {
    console.info('[receivePresaleSpiCallback] incoming request:', {
      otaOrderId,
      requestLogId,
    })

    /** @type {{orderOutId:string}} 预售券创单处理结果。 */
    const result = await handleDouyinPresaleBooking(req.body || {}, {
      douyinLogId: requestLogId,
    })

    return res.json(buildDouyinPresaleSuccessResponse({
      otaOrderId,
      orderOutId: result.orderOutId,
    }))
  } catch (error) {
    /** @type {{errorCode:number, description:string}} 统一错误信息。 */
    const { errorCode, description } = resolveDouyinBusinessError(error)

    console.error('[receivePresaleSpiCallback] failed:', {
      otaOrderId,
      requestLogId,
      message: error.message,
    })

    return res.json(buildDouyinPresaleErrorResponse({
      otaOrderId,
      errorCode,
      description,
    }))
  }
}

module.exports = {
  receivePresaleSpiCallback,
}
