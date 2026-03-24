const { handleDouyinRefundResult } = require('../../services/refundResult.service')
const { receiveDouyinRefundResultCallback } = require('../refundResult.controller')

jest.mock('../../services/refundResult.service', () => ({
  handleDouyinRefundResult: jest.fn(),
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

describe('receiveDouyinRefundResultCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回统一 success 结构', async () => {
    handleDouyinRefundResult.mockResolvedValue({
      errorCode: 0,
      description: 'success',
      refundStatus: 'success',
    })

    const req = {
      body: {
        order_id: 'DY_001',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_REFUND_001',
      },
    }
    const res = createMockResponse()

    await receiveDouyinRefundResultCallback(req, res)

    expect(handleDouyinRefundResult).toHaveBeenCalledWith({
      order_id: 'DY_001',
    }, {
      douyinLogId: 'LOGID_REFUND_001',
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
      },
    })
  })

  test('失败时应返回统一错误结构', async () => {
    const error = new Error('invalid request')
    error.douyinErrorCode = 13
    error.douyinDescription = '退款状态不合法'
    handleDouyinRefundResult.mockRejectedValue(error)

    const req = {
      body: {},
    }
    const res = createMockResponse()

    await receiveDouyinRefundResultCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '退款状态不合法',
      },
    })
  })
})
