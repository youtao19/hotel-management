jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    clientSecret: 'test_secret_123',
  },
}))

const { generateDouyinWebhookSignature } = require('../../crypto/webhookSignature')
const { verifyDouyinWebhookMiddleware } = require('../verifyDouyinWebhook.middleware')

/**
 * 创建最小响应对象 mock。
 *
 * @returns {{status: jest.Mock, json: jest.Mock}} 响应对象。
 */
function createMockResponse() {
  const res = {
    status: jest.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: jest.fn(function json(body) {
      return body
    }),
  }

  return res
}

describe('verifyDouyinWebhookMiddleware', () => {
  test('缺少签名头时应返回 401', () => {
    const req = {
      headers: {},
      rawBody: '{"event":"test"}',
    }
    const res = createMockResponse()
    const next = jest.fn()

    verifyDouyinWebhookMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('签名不合法时应返回 401', () => {
    const req = {
      headers: {
        'x-douyin-signature': 'invalid_signature',
      },
      rawBody: '{"event":"test"}',
    }
    const res = createMockResponse()
    const next = jest.fn()

    verifyDouyinWebhookMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('签名合法时应放行', () => {
    const rawBody = '{"event":"test"}'
    const signature = generateDouyinWebhookSignature({
      clientSecret: 'test_secret_123',
      rawBody,
    })

    const req = {
      headers: {
        'x-douyin-signature': signature,
      },
      rawBody,
    }
    const res = createMockResponse()
    const next = jest.fn()

    verifyDouyinWebhookMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })
})
