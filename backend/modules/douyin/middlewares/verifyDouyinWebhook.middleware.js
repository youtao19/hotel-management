const { douyinConfig } = require('../../../appSettings/douyin.config')
const { verifyDouyinWebhookSignature } = require('../crypto/webhookSignature')

/**
 * 校验抖音 Webhook 签名（X-Douyin-Signature）。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @param {import('express').NextFunction} next Next 回调。
 * @returns {void}
 */
function verifyDouyinWebhookMiddleware(req, res, next) {
  try {
    const signature = req.headers['x-douyin-signature']

    if (!signature) {
      res.status(401).json({
        success: false,
        message: 'Missing X-Douyin-Signature header',
      })
      return
    }

    const rawBody = req.rawBody || ''
    const isValid = verifyDouyinWebhookSignature({
      clientSecret: douyinConfig.clientSecret,
      rawBody,
      signature: String(signature || ''),
    })

    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid Douyin webhook signature',
      })
      return
    }

    next()
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify Douyin webhook signature',
      error: error.message,
    })
  }
}

module.exports = {
  verifyDouyinWebhookMiddleware,
}
