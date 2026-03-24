const { handleDouyinRefundCase } = require('../../services/refundCase.service')
const { receiveDouyinRefundCaseCallback } = require('../refundCase.controller')

jest.mock('../../services/refundCase.service', () => ({
  handleDouyinRefundCase: jest.fn(),
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

describe('receiveDouyinRefundCaseCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回统一 success 结构', async () => {
    handleDouyinRefundCase.mockResolvedValue({
      errorCode: 0,
      description: 'success',
      action: 'negotiated_refund_approved',
    })

    const req = {
      body: {
        order_id: 'DY_001',
        refund_case_type: 'negotiated_refund',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_REFUND_CASE_001',
      },
    }
    const res = createMockResponse()

    await receiveDouyinRefundCaseCallback(req, res)

    expect(handleDouyinRefundCase).toHaveBeenCalledWith({
      order_id: 'DY_001',
      refund_case_type: 'negotiated_refund',
    }, {
      douyinLogId: 'LOGID_REFUND_CASE_001',
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
    error.douyinDescription = '退款case类型不合法'
    handleDouyinRefundCase.mockRejectedValue(error)

    const req = {
      body: {},
    }
    const res = createMockResponse()

    await receiveDouyinRefundCaseCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '退款case类型不合法',
      },
    })
  })
})
