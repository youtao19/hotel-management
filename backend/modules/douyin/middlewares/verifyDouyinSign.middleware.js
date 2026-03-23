const { douyinConfig } = require('../../../appSettings/douyin.config')
const { verifySha256Signature } = require('../crypto/signature')

function verifyDouyinSignMiddleware(req, res, next) {
  try {
    // 从请求头读取 x-life-sign 签名
    const signature = req.headers['x-life-sign']

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: 'Missing x-life-sign header',
      })
    }

    const rawBody = req.rawBody || ''

    const isValid = verifySha256Signature({
      query: req.query || {},
      rawBody,
      clientSecret: douyinConfig.clientSecret,
      signature,
    })

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Douyin signature',
      })
    }

    next()
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify Douyin signature',
      error: error.message,
    })
  }
}

module.exports = {
  verifyDouyinSignMiddleware,
}
