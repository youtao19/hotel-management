const {
  pushDouyinCheckIn,
  pushDouyinCheckOut,
} = require('../../services/fulfillmentSync.service')
const {
  pushDouyinCheckInController,
  pushDouyinCheckOutController,
  resolveOrderIdFromBody,
} = require('../fulfillmentSync.controller')

jest.mock('../../services/fulfillmentSync.service', () => ({
  pushDouyinCheckIn: jest.fn(),
  pushDouyinCheckOut: jest.fn(),
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

describe('fulfillmentSync.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应解析请求体中的 orderId', () => {
    expect(resolveOrderIdFromBody({
      orderId: 'O202603240001',
    })).toBe('O202603240001')
  })

  test('入住接口成功时应返回成功结果', async () => {
    pushDouyinCheckIn.mockResolvedValue({
      action: 'check_in',
      status: 'sent',
      payload: {
        order_out_id: 'O202603240001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    const req = {
      body: {
        orderId: 'O202603240001',
      },
    }
    const res = createMockResponse()

    await pushDouyinCheckInController(req, res)

    expect(pushDouyinCheckIn).toHaveBeenCalledWith({
      orderId: 'O202603240001',
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'check_in',
      status: 'sent',
      payload: {
        order_out_id: 'O202603240001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })
  })

  test('离店接口成功时应返回成功结果', async () => {
    pushDouyinCheckOut.mockResolvedValue({
      action: 'check_out',
      status: 'sent',
      payload: {
        order_out_id: 'O202603240002',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    const req = {
      body: {
        orderId: 'O202603240002',
      },
    }
    const res = createMockResponse()

    await pushDouyinCheckOutController(req, res)

    expect(pushDouyinCheckOut).toHaveBeenCalledWith({
      orderId: 'O202603240002',
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'check_out',
      status: 'sent',
      payload: {
        order_out_id: 'O202603240002',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })
  })

  test('缺少 orderId 时应返回 400', async () => {
    const req = {
      body: {},
    }
    const res = createMockResponse()

    await pushDouyinCheckInController(req, res)

    expect(pushDouyinCheckIn).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'orderId is required',
    })
  })

  test('业务错误时应返回 400', async () => {
    const error = new Error('not found')
    error.douyinErrorCode = 9
    error.douyinDescription = '订单不存在或状态异常'
    pushDouyinCheckOut.mockRejectedValue(error)

    const req = {
      body: {
        orderId: 'O202603240003',
      },
    }
    const res = createMockResponse()

    await pushDouyinCheckOutController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 9,
      message: '订单不存在或状态异常',
    })
  })
})
