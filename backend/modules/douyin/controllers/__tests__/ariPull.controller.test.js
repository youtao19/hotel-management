const { handleDouyinAriPull } = require('../../services/ariPull.service')
const { receiveDouyinAriPullCallback } = require('../ariPull.controller')

jest.mock('../../services/ariPull.service', () => ({
  handleDouyinAriPull: jest.fn(),
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

describe('receiveDouyinAriPullCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回 stock_and_amount', async () => {
    handleDouyinAriPull.mockResolvedValue({
      errorCode: 0,
      description: 'success',
      stockAndAmount: [{
        rate_plan_id: 'RATE_001',
        room_id: 'ROOM_001',
        inventory: 2,
        available: true,
      }],
    })

    const req = {
      body: {
        rate_plan_id: 'RATE_001',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_PULL_001',
      },
    }
    const res = createMockResponse()

    await receiveDouyinAriPullCallback(req, res)

    expect(handleDouyinAriPull).toHaveBeenCalledWith({
      rate_plan_id: 'RATE_001',
    }, {
      douyinLogId: 'LOGID_PULL_001',
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
        stock_and_amount: [{
          rate_plan_id: 'RATE_001',
          room_id: 'ROOM_001',
          inventory: 2,
          available: true,
        }],
      },
    })
  })

  test('失败时应返回统一错误结构', async () => {
    const error = new Error('invalid request')
    error.douyinErrorCode = 13
    error.douyinDescription = '缺少售卖房型ID'
    handleDouyinAriPull.mockRejectedValue(error)

    const req = {
      body: {},
    }
    const res = createMockResponse()

    await receiveDouyinAriPullCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '缺少售卖房型ID',
        stock_and_amount: [],
      },
    })
  })
})
