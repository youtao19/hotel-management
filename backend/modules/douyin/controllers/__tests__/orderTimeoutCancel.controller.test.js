const { cancelUnpaidDouyinOrder } = require('../../services/orderTimeoutCancel.service')
const { cancelUnpaidDouyinOrderController } = require('../orderTimeoutCancel.controller')

jest.mock('../../services/orderTimeoutCancel.service', () => ({
  cancelUnpaidDouyinOrder: jest.fn(),
}))

/**
 * 创建最小可用响应对象。
 *
 * @returns {{status: jest.Mock, json: jest.Mock}} 响应对象。
 */
function createMockResponse() {
  return {
    status: jest.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: jest.fn(function json(body) {
      return body
    }),
  }
}

describe('cancelUnpaidDouyinOrderController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回 timeout_cancelled', async () => {
    cancelUnpaidDouyinOrder.mockResolvedValue({
      action: 'timeout_cancelled',
      otaOrderId: 'DY_001',
      reason: '用户未支付超时取消',
    })

    const req = {
      body: {
        otaOrderId: 'DY_001',
        reason: '用户未支付超时取消',
      },
    }
    const res = createMockResponse()

    await cancelUnpaidDouyinOrderController(req, res)

    expect(cancelUnpaidDouyinOrder).toHaveBeenCalledWith({
      otaOrderId: 'DY_001',
      reason: '用户未支付超时取消',
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'timeout_cancelled',
      otaOrderId: 'DY_001',
      reason: '用户未支付超时取消',
    })
  })

  test('缺少 otaOrderId 时应返回 400', async () => {
    const req = {
      body: {},
    }
    const res = createMockResponse()

    await cancelUnpaidDouyinOrderController(req, res)

    expect(cancelUnpaidDouyinOrder).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'otaOrderId is required',
    })
  })

  test('业务错误时应返回 400', async () => {
    const error = new Error('not found')
    error.douyinErrorCode = 9
    error.douyinDescription = '订单不存在或状态异常'
    cancelUnpaidDouyinOrder.mockRejectedValue(error)

    const req = {
      body: {
        otaOrderId: 'DY_404',
      },
    }
    const res = createMockResponse()

    await cancelUnpaidDouyinOrderController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 9,
      message: '订单不存在或状态异常',
    })
  })
})
