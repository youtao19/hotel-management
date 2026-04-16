const { syncProductToDouyin } = require('../../services/douyinProductService')
const {
  resolveDouyinProductSyncBody,
  syncDouyinProductController,
} = require('../douyinProduct.controller')

jest.mock('../../services/douyinProductService', () => ({
  syncProductToDouyin: jest.fn(),
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

describe('douyinProduct.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应解析同步请求体', () => {
    expect(resolveDouyinProductSyncBody({
      localRatePlanId: '101',
      accountId: 'ACC_001',
      poiId: 'HOTEL_001',
      mode: 'meal',
      modeConfig: {
        mealCount: 2,
      },
    })).toEqual({
      localRatePlanId: 101,
      accountId: 'ACC_001',
      poiId: 'HOTEL_001',
      mode: 'meal',
      modeConfig: {
        mealCount: 2,
      },
    })
  })

  test('缺少 localRatePlanId 时应返回 400', async () => {
    const req = {
      body: {},
    }
    const res = createMockResponse()

    await syncDouyinProductController(req, res)

    expect(syncProductToDouyin).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'localRatePlanId is required',
    })
  })

  test('同步成功时应返回映射结果', async () => {
    syncProductToDouyin.mockResolvedValue({
      action: 'synced',
      mode: 'meal',
      payload: {
        account_id: 'ACC_001',
      },
      saveResult: {
        data: {
          error_code: 0,
        },
      },
      ratePlan: {
        rate_plan_id: 'RATE_001',
      },
      savedRoom: {
        room_id: 'ROOM_001',
      },
      savedMapping: {
        channel_item_id: 'RATE_001',
      },
    })

    const req = {
      body: {
        localRatePlanId: 101,
        mode: 'meal',
      },
    }
    const res = createMockResponse()

    await syncDouyinProductController(req, res)

    expect(syncProductToDouyin).toHaveBeenCalledWith({
      localRatePlanId: 101,
      accountId: '',
      poiId: '',
      mode: 'meal',
      modeConfig: {},
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'synced',
      mode: 'meal',
      payload: {
        account_id: 'ACC_001',
      },
      saveResult: {
        data: {
          error_code: 0,
        },
      },
      ratePlan: {
        rate_plan_id: 'RATE_001',
      },
      savedRoom: {
        room_id: 'ROOM_001',
      },
      savedMapping: {
        channel_item_id: 'RATE_001',
      },
    })
  })

  test('业务错误时应返回统一错误结构', async () => {
    const error = new Error('not mapped')
    error.douyinErrorCode = 13
    error.douyinDescription = '本地套餐所属房型尚未绑定抖音物理房型'
    syncProductToDouyin.mockRejectedValue(error)

    const req = {
      body: {
        localRatePlanId: 102,
      },
    }
    const res = createMockResponse()

    await syncDouyinProductController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 13,
      message: '本地套餐所属房型尚未绑定抖音物理房型',
    })
  })
})
