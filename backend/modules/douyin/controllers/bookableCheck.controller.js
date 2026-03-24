const { DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { handleDouyinBookableCheck } = require('../services/bookableCheck.service')

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
 * 构建可订检查响应。
 *
 * @param {Object} params 响应参数。
 * @param {number} params.errorCode 错误码。
 * @param {string} params.description 描述。
 * @param {Object|null} [params.ari=null] 价量态回传。
 * @returns {{data:Object}} 官方响应结构。
 */
function buildDouyinBookableCheckResponse({ errorCode, description, ari = null }) {
  const data = {
    error_code: errorCode,
    description,
  }

  if (ari) {
    data.ari = ari
  }

  return { data }
}

/**
 * 处理抖音可订检查 SPI。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function receiveBookableCheckCallback(req, res) {
  const requestLogId = resolveDouyinRequestLogId(req)

  try {
    const result = await handleDouyinBookableCheck(req.body || {}, {
      douyinLogId: requestLogId,
    })

    return res.json(buildDouyinBookableCheckResponse({
      errorCode: result.errorCode ?? DOUYIN_SUCCESS_RESULT.code,
      description: result.description ?? DOUYIN_SUCCESS_RESULT.description,
      ari: result.ari || null,
    }))
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.json(buildDouyinBookableCheckResponse({
      errorCode,
      description,
      ari: null,
    }))
  }
}

module.exports = {
  receiveBookableCheckCallback,
}
