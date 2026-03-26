const crypto = require('crypto')

/**
 * 基于抖音 Webhook 规则生成签名。
 * 规则：sha1(clientSecret + 原始请求体)。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.clientSecret 应用 client_secret。
 * @param {string} params.rawBody 原始请求体字符串。
 * @returns {string} 16进制小写签名。
 */
function generateDouyinWebhookSignature({ clientSecret = '', rawBody = '' }) {
  return crypto
    .createHash('sha1')
    .update(String(clientSecret || ''), 'utf8')
    .update(String(rawBody || ''), 'utf8')
    .digest('hex')
}

/**
 * 校验抖音 Webhook 签名。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.clientSecret 应用 client_secret。
 * @param {string} params.rawBody 原始请求体字符串。
 * @param {string} params.signature 请求头签名。
 * @returns {boolean} 是否通过校验。
 */
function verifyDouyinWebhookSignature({
  clientSecret = '',
  rawBody = '',
  signature = '',
}) {
  const normalizedSignature = String(signature || '').trim().toLowerCase()
  if (!normalizedSignature) {
    return false
  }

  const calculatedSignature = generateDouyinWebhookSignature({
    clientSecret,
    rawBody,
  })

  return calculatedSignature === normalizedSignature
}

module.exports = {
  generateDouyinWebhookSignature,
  verifyDouyinWebhookSignature,
}
