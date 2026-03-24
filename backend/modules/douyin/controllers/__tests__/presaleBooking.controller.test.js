const { handleDouyinPresaleBooking } = require('../../services/presaleBooking.service')
const { receivePresaleSpiCallback } = require('../presaleBooking.controller')

jest.mock('../../services/presaleBooking.service', () => ({
  handleDouyinPresaleBooking: jest.fn(),
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

describe('receivePresaleSpiCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回预售券创单官方响应结构', async () => {
    handleDouyinPresaleBooking.mockResolvedValue({
      action: 'created',
      orderOutId: 'O202603240001',
    })

    const req = {
      body: {
        order_id: 'DY_PRE_001',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_PRE_001',
      },
    }
    const res = createMockResponse()

    await receivePresaleSpiCallback(req, res)

    expect(handleDouyinPresaleBooking).toHaveBeenCalledWith({
      order_id: 'DY_PRE_001',
    }, {
      douyinLogId: 'LOGID_PRE_001',
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
        order_id: 'DY_PRE_001',
        order_out_id: 'O202603240001',
      },
    })
  })

  test('失败时应返回预售券创单错误结构', async () => {
    const error = new Error('invalid presale')
    error.douyinErrorCode = 13
    error.douyinDescription = '预售业务类型不合法'
    handleDouyinPresaleBooking.mockRejectedValue(error)

    const req = {
      body: {
        order_id: 'DY_PRE_002',
      },
    }
    const res = createMockResponse()

    await receivePresaleSpiCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '预售业务类型不合法',
        order_id: 'DY_PRE_002',
      },
    })
  })
})
