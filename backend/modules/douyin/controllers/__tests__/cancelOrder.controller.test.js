const { handleDouyinCancelOrder } = require('../../services/cancelOrder.service')
const { receiveCancelCallback } = require('../cancelOrder.controller')

jest.mock('../../services/cancelOrder.service', () => ({
  handleDouyinCancelOrder: jest.fn(),
}))

/**
 * 创建最小响应对象 mock。
 *
 * @returns {{json: jest.Mock}} 响应对象。
 */
function createMockResponse() {
  return {
    json: jest.fn(function json(body) {
      return body
    }),
  }
}

describe('receiveCancelCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回官方取消响应结构', async () => {
    handleDouyinCancelOrder.mockResolvedValue({
      action: 'cancelled',
      cancelMode: 2,
      cancelResult: null,
      reason: '用户取消',
      localOrderId: 'O_001',
    })

    const req = {
      body: {
        order_id: 'DY_001',
      },
    }
    const res = createMockResponse()

    await receiveCancelCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
        cancel_mode: 2,
        reason: '用户取消',
      },
    })
  })

  test('失败时应返回官方取消错误结构', async () => {
    const error = new Error('order not found')
    error.douyinErrorCode = 9
    error.douyinDescription = '订单不存在或状态异常'
    handleDouyinCancelOrder.mockRejectedValue(error)

    const req = {
      body: {
        order_id: 'DY_404',
      },
    }
    const res = createMockResponse()

    await receiveCancelCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 9,
        description: '订单不存在或状态异常',
        cancel_mode: 2,
      },
    })
  })
})
