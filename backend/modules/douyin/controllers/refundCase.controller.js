const { DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { handleDouyinRefundCase } = require('../services/refundCase.service')

/**
 * 从请求头中提取抖音 logid。
 *
 * @param {import('express').Request} req 请求对象。
 * @returns {string} logid。
 */
function resolveDouyinRequestLogId(req) {
  const headers = req?.headers || {}
  const rawLogId = headers['x-bytedance-logid']

  if (Array.isArray(rawLogId)) {
    return String(rawLogId[0] || '').trim()
  }

  return String(rawLogId || '').trim()
}

/**
 * 构建退款 case 统一响应。
 *
 * @param {Object} params 响应参数。
 * @param {number} params.errorCode 错误码。
 * @param {string} params.description 描述。
 * @returns {{data:Object}} 官方响应结构。
 */
function buildDouyinRefundCaseResponse({ errorCode, description }) {
  return {
    data: {
      error_code: errorCode,
      description,
    },
  }
}

/**
 * 处理抖音退款 case 回调。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function receiveDouyinRefundCaseCallback(req, res) {
  const requestLogId = resolveDouyinRequestLogId(req)

  try {
    const result = await handleDouyinRefundCase(req.body || {}, {
      douyinLogId: requestLogId,
    })

    return res.json(buildDouyinRefundCaseResponse({
      errorCode: result.errorCode ?? DOUYIN_SUCCESS_RESULT.code,
      description: result.description ?? DOUYIN_SUCCESS_RESULT.description,
    }))
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.json(buildDouyinRefundCaseResponse({
      errorCode,
      description,
    }))
  }
}

module.exports = {
  buildDouyinRefundCaseResponse,
  receiveDouyinRefundCaseCallback,
}
