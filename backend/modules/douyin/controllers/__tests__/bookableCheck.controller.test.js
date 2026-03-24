const { handleDouyinBookableCheck } = require('../../services/bookableCheck.service')
const { receiveBookableCheckCallback } = require('../bookableCheck.controller')

jest.mock('../../services/bookableCheck.service', () => ({
  handleDouyinBookableCheck: jest.fn(),
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

describe('receiveBookableCheckCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功时应返回 success 响应结构', async () => {
    handleDouyinBookableCheck.mockResolvedValue({
      errorCode: 0,
      description: 'success',
      ari: null,
    })

    const req = {
      body: {
        rate_plan_id: 'RATE_001',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_BOOKABLE_001',
      },
    }
    const res = createMockResponse()

    await receiveBookableCheckCallback(req, res)

    expect(handleDouyinBookableCheck).toHaveBeenCalledWith({
      rate_plan_id: 'RATE_001',
    }, {
      douyinLogId: 'LOGID_BOOKABLE_001',
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
      },
    })
  })

  test('不可订时应返回错误码和 ari', async () => {
    handleDouyinBookableCheck.mockResolvedValue({
      errorCode: 4,
      description: '入住时期内已满',
      ari: {
        stock_and_amount: [
          {
            rate_plan_id: 'RATE_001',
            room_id: 'ROOM_001',
            inventory: 0,
            available: false,
            timerange: {
              start: '2026-03-24',
              end: '2026-03-25',
            },
          },
        ],
      },
    })

    const req = {
      body: {
        rate_plan_id: 'RATE_001',
      },
    }
    const res = createMockResponse()

    await receiveBookableCheckCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 4,
        description: '入住时期内已满',
        ari: {
          stock_and_amount: [
            {
              rate_plan_id: 'RATE_001',
              room_id: 'ROOM_001',
              inventory: 0,
              available: false,
              timerange: {
                start: '2026-03-24',
                end: '2026-03-25',
              },
            },
          ],
        },
      },
    })
  })

  test('失败时应返回统一错误结构', async () => {
    const error = new Error('invalid request')
    error.douyinErrorCode = 13
    error.douyinDescription = '可订检查业务类型不合法'
    handleDouyinBookableCheck.mockRejectedValue(error)

    const req = {
      body: {
        rate_plan_id: 'RATE_001',
      },
    }
    const res = createMockResponse()

    await receiveBookableCheckCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '可订检查业务类型不合法',
      },
    })
  })
})
