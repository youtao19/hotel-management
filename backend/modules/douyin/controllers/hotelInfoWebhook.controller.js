const { DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { handleDouyinHotelInfoWebhook } = require('../services/hotelInfoWebhook.service')

const WEBHOOK_MSG_TTL_MS = 24 * 60 * 60 * 1000
const receivedWebhookMsgCache = new Map()

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
 * 从请求头中提取消息唯一标识 Msg-Id。
 *
 * @param {import('express').Request} req 请求对象。
 * @returns {string} 消息ID。
 */
function resolveDouyinWebhookMsgId(req) {
  const headers = req?.headers || {}
  const rawMsgId = headers['msg-id']

  if (Array.isArray(rawMsgId)) {
    return String(rawMsgId[0] || '').trim()
  }

  return String(rawMsgId || '').trim()
}

/**
 * 尝试从 payload 中提取 challenge，并保持原始类型。
 * 说明：
 * 1. verify_webhook 场景要求回传 challenge 原值；
 * 2. 若 challenge 为数字则返回数字，避免被当作字符串导致校验失败。
 *
 * @param {Object} payload 原始请求体。
 * @returns {unknown} challenge。
 */
function resolveWebhookChallenge(payload = {}) {
  const resolveFromContent = (rawContent) => {
    if (!rawContent || typeof rawContent !== 'object') {
      return undefined
    }

    if (Object.prototype.hasOwnProperty.call(rawContent, 'challenge')) {
      return rawContent.challenge
    }

    return undefined
  }

  const rawContent = payload?.content

  const challengeFromObject = resolveFromContent(rawContent)
  if (challengeFromObject !== undefined) {
    return challengeFromObject
  }

  if (typeof rawContent === 'string' && rawContent.trim()) {
    try {
      const parsedContent = JSON.parse(rawContent)
      const challengeFromString = resolveFromContent(parsedContent)
      if (challengeFromString !== undefined) {
        return challengeFromString
      }
    } catch (_error) {
      // content 不是 JSON 时继续回退读取其他字段。
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'challenge')) {
    return payload.challenge
  }

  return ''
}

/**
 * 判断 webhook 消息是否可处理，并维护内存去重缓存。
 *
 * @param {string} msgId 消息ID。
 * @returns {boolean} 可处理返回 true；重复消息返回 false。
 */
function shouldProcessWebhookMessage(msgId) {
  if (!msgId) {
    return true
  }

  const now = Date.now()
  const expiredAt = receivedWebhookMsgCache.get(msgId)
  if (expiredAt && expiredAt > now) {
    return false
  }

  receivedWebhookMsgCache.set(msgId, now + WEBHOOK_MSG_TTL_MS)

  for (const [cachedMsgId, cachedExpiredAt] of receivedWebhookMsgCache.entries()) {
    if (cachedExpiredAt <= now) {
      receivedWebhookMsgCache.delete(cachedMsgId)
    }
  }

  return true
}

/**
 * 清理 webhook 消息缓存（测试使用）。
 *
 * @returns {void}
 */
function clearWebhookMsgCacheForTest() {
  receivedWebhookMsgCache.clear()
}

/**
 * 构建酒店静态信息处理结果推送统一响应。
 *
 * @param {Object} params 响应参数。
 * @param {number} params.errorCode 错误码。
 * @param {string} params.description 描述。
 * @returns {{data:Object}} 官方响应结构。
 */
function buildDouyinHotelInfoWebhookResponse({ errorCode, description }) {
  return {
    data: {
      error_code: errorCode,
      description,
    },
  }
}

/**
 * 处理抖音酒店静态信息处理结果推送 Webhook。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function receiveDouyinHotelInfoWebhookCallback(req, res) {
  const requestLogId = resolveDouyinRequestLogId(req)
  const msgId = resolveDouyinWebhookMsgId(req)
  const event = String(req?.body?.event || '').trim().toLowerCase()

  if (event === 'verify_webhook') {
    const challenge = resolveWebhookChallenge(req.body || {})
    return res.json({
      challenge,
    })
  }

  if (!shouldProcessWebhookMessage(msgId)) {
    return res.json(buildDouyinHotelInfoWebhookResponse({
      errorCode: DOUYIN_SUCCESS_RESULT.code,
      description: DOUYIN_SUCCESS_RESULT.description,
    }))
  }

  try {
    const result = await handleDouyinHotelInfoWebhook(req.body || {}, {
      douyinLogId: requestLogId,
    })

    return res.json(buildDouyinHotelInfoWebhookResponse({
      errorCode: result.errorCode ?? DOUYIN_SUCCESS_RESULT.code,
      description: result.description ?? DOUYIN_SUCCESS_RESULT.description,
    }))
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.json(buildDouyinHotelInfoWebhookResponse({
      errorCode,
      description,
    }))
  }
}

module.exports = {
  buildDouyinHotelInfoWebhookResponse,
  clearWebhookMsgCacheForTest,
  receiveDouyinHotelInfoWebhookCallback,
  resolveDouyinWebhookMsgId,
  resolveWebhookChallenge,
  shouldProcessWebhookMessage,
}
