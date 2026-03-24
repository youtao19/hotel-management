const { DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { handleDouyinAriPull } = require('../services/ariPull.service')

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
 * 构建主动拉取价量态响应。
 *
 * @param {Object} params 响应参数。
 * @param {number} params.errorCode 错误码。
 * @param {string} params.description 描述。
 * @param {Object[]} [params.stockAndAmount=[]] 价量态列表。
 * @returns {{data:Object}} 官方响应结构。
 */
function buildDouyinAriPullResponse({
  errorCode,
  description,
  stockAndAmount = [],
}) {
  const data = {
    error_code: errorCode,
    description,
    stock_and_amount: Array.isArray(stockAndAmount) ? stockAndAmount : [],
  }

  return { data }
}

/**
 * 处理抖音主动拉取价量态 SPI。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function receiveDouyinAriPullCallback(req, res) {
  const requestLogId = resolveDouyinRequestLogId(req)

  try {
    const result = await handleDouyinAriPull(req.body || {}, {
      douyinLogId: requestLogId,
    })

    return res.json(buildDouyinAriPullResponse({
      errorCode: result.errorCode ?? DOUYIN_SUCCESS_RESULT.code,
      description: result.description ?? DOUYIN_SUCCESS_RESULT.description,
      stockAndAmount: result.stockAndAmount || [],
    }))
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.json(buildDouyinAriPullResponse({
      errorCode,
      description,
      stockAndAmount: [],
    }))
  }
}

module.exports = {
  buildDouyinAriPullResponse,
  receiveDouyinAriPullCallback,
}
