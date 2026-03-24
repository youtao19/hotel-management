const { createDouyinRatePlan } = require('../../services/ratePlanCreate.service')
const {
  createDouyinRatePlanController,
  resolveRatePlanCreateBody,
} = require('../ratePlanCreate.controller')

jest.mock('../../services/ratePlanCreate.service', () => ({
  createDouyinRatePlan: jest.fn(),
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

describe('ratePlanCreate.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应解析标准请求体', () => {
    expect(resolveRatePlanCreateBody({
      localRoomType: 'LOCAL_ROOM_001',
      poiId: 'HOTEL_001',
      roomId: 'ROOM_001',
      accountId: 'ACC_001',
      mode: 'meal',
      modeConfig: {
        mealCount: 2,
      },
    })).toEqual({
      localRoomType: 'LOCAL_ROOM_001',
      poiId: 'HOTEL_001',
      roomId: 'ROOM_001',
      accountId: 'ACC_001',
      mode: 'meal',
      modeConfig: {
        mealCount: 2,
      },
    })
  })

  test('创建成功时应返回结果', async () => {
    createDouyinRatePlan.mockResolvedValue({
      action: 'created',
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
    })

    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_001',
        poiId: 'HOTEL_001',
        roomId: 'ROOM_001',
        accountId: 'ACC_001',
        mode: 'meal',
        modeConfig: {
          mealCount: 2,
        },
      },
    }
    const res = createMockResponse()

    await createDouyinRatePlanController(req, res)

    expect(createDouyinRatePlan).toHaveBeenCalledWith({
      localRoomType: 'LOCAL_ROOM_001',
      poiId: 'HOTEL_001',
      roomId: 'ROOM_001',
      accountId: 'ACC_001',
      mode: 'meal',
      modeConfig: {
        mealCount: 2,
      },
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'created',
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
    })
  })

  test('缺少 roomId 时应返回 400', async () => {
    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_002',
        poiId: 'HOTEL_002',
      },
    }
    const res = createMockResponse()

    await createDouyinRatePlanController(req, res)

    expect(createDouyinRatePlan).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'roomId is required',
    })
  })

  test('业务错误时应返回 400', async () => {
    const error = new Error('not found')
    error.douyinErrorCode = 13
    error.douyinDescription = '抖音物理房型不存在'
    createDouyinRatePlan.mockRejectedValue(error)

    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_003',
        poiId: 'HOTEL_003',
        roomId: 'ROOM_404',
        accountId: 'ACC_001',
        mode: 'cancel',
        modeConfig: {
          freeCancelHoursBeforeCheckIn: 24,
        },
      },
    }
    const res = createMockResponse()

    await createDouyinRatePlanController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 13,
      message: '抖音物理房型不存在',
    })
  })

  test('非法 modeConfig 时应交给服务层返回业务错误', async () => {
    const error = new Error('invalid config')
    error.douyinErrorCode = 13
    error.douyinDescription = '商品模式配置不合法'
    createDouyinRatePlan.mockRejectedValue(error)

    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_004',
        poiId: 'HOTEL_004',
        roomId: 'ROOM_004',
        accountId: 'ACC_001',
        mode: 'stay',
        modeConfig: [],
      },
    }
    const res = createMockResponse()

    await createDouyinRatePlanController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 13,
      message: '商品模式配置不合法',
    })
  })
})
