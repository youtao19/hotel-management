const { handleDouyinCancelOrder } = require('../services/cancelOrder.service')
const { DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { DOUYIN_CANCEL_MODE } = require('../constants/enums')
const { resolveDouyinBusinessError } = require('../utils/douyinError')

/**
 * 从取消通知请求体中提取抖音订单号。
 *
 * @param {Object} payload 原始请求体。
 * @returns {string} 抖音订单号；不存在时返回空字符串。
 */
function resolveDouyinOrderId(payload = {}) {
  return String(payload.order_id || '').trim()
}

/**
 * 构建抖音取消 SPI 成功响应。
 *
 * @param {Object} params 响应参数。
 * @param {number} params.cancelMode 取消模式。
 * @param {number|null} params.cancelResult 同步取消结果。
 * @param {string} params.reason 原因说明。
 * @returns {{data: Object}} 官方响应结构。
 */
function buildDouyinCancelSuccessResponse({ cancelMode, cancelResult, reason }) {
  const data = {
    error_code: DOUYIN_SUCCESS_RESULT.code,
    description: DOUYIN_SUCCESS_RESULT.description,
    cancel_mode: cancelMode,
  }

  if (cancelResult !== null && cancelResult !== undefined) {
    data.cancel_result = cancelResult
  }

  if (reason) {
    data.reason = reason
  }

  return { data }
}

/**
 * 构建抖音取消 SPI 失败响应。
 *
 * @param {Object} params 响应参数。
 * @param {number} params.errorCode 错误码。
 * @param {string} params.description 错误描述。
 * @returns {{data: Object}} 官方响应结构。
 */
function buildDouyinCancelErrorResponse({ errorCode, description }) {
  return {
    data: {
      error_code: errorCode,
      description,
      cancel_mode: DOUYIN_CANCEL_MODE.ASYNC,
    },
  }
}

/**
 * 处理抖音取消订单 SPI 回调。
 *
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<import('express').Response>} 取消处理结果。
 */
async function receiveCancelCallback(req, res) {
  const otaOrderId = resolveDouyinOrderId(req.body || {})

  try {
    const result = await handleDouyinCancelOrder(req.body || {})

    return res.json(buildDouyinCancelSuccessResponse({
      cancelMode: result.cancelMode,
      cancelResult: result.cancelResult,
      reason: result.reason,
    }))
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    console.error('[receiveCancelCallback] failed:', otaOrderId, error.message)

    return res.json(buildDouyinCancelErrorResponse({
      errorCode,
      description,
    }))
  }
}

module.exports = {
  receiveCancelCallback,
}
