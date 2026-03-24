const {
  buildDouyinAriByRatePlanIds,
  notifyDouyinAriRefresh,
  pushDouyinHotelPrice,
  pushDouyinHotelStock,
} = require('../../services/ari.service')
const {
  notifyDouyinAriController,
  previewDouyinAriController,
  pushDouyinPriceController,
  pushDouyinStockController,
  resolveAriRequestBody,
} = require('../ari.controller')

jest.mock('../../services/ari.service', () => ({
  buildDouyinAriByRatePlanIds: jest.fn(),
  notifyDouyinAriRefresh: jest.fn(),
  pushDouyinHotelPrice: jest.fn(),
  pushDouyinHotelStock: jest.fn(),
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

describe('ari.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('resolveAriRequestBody 应提取标准参数', () => {
    expect(resolveAriRequestBody({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-30',
    })).toEqual({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-30',
    })
  })

  test('preview 应返回本地 ARI 预览', async () => {
    buildDouyinAriByRatePlanIds.mockResolvedValue({
      summary: {
        total: 1,
      },
      aris: [{
        rate_plan_id: 'RATE_001',
      }],
    })

    const req = {
      body: {
        ratePlanIds: ['RATE_001'],
        startDate: '2026-03-24',
        endDate: '2026-03-24',
      },
    }
    const res = createMockResponse()

    await previewDouyinAriController(req, res)

    expect(buildDouyinAriByRatePlanIds).toHaveBeenCalledWith({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-24',
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 1,
      },
      data: [{
        rate_plan_id: 'RATE_001',
      }],
    })
  })

  test('stock push 应返回推送结果', async () => {
    pushDouyinHotelStock.mockResolvedValue({
      summary: {
        total: 1,
      },
      payload: {
        account_id: 'ACC_001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    const req = {
      body: {
        ratePlanIds: ['RATE_002'],
        startDate: '2026-03-24',
        endDate: '2026-03-24',
      },
    }
    const res = createMockResponse()

    await pushDouyinStockController(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 1,
      },
      payload: {
        account_id: 'ACC_001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })
  })

  test('price push 应返回推送结果', async () => {
    pushDouyinHotelPrice.mockResolvedValue({
      summary: {
        total: 2,
      },
      payload: {
        account_id: 'ACC_001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    const req = {
      body: {
        ratePlanIds: ['RATE_003'],
        startDate: '2026-03-24',
        endDate: '2026-03-25',
      },
    }
    const res = createMockResponse()

    await pushDouyinPriceController(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 2,
      },
      payload: {
        account_id: 'ACC_001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })
  })

  test('notify 应返回通知结果', async () => {
    notifyDouyinAriRefresh.mockResolvedValue({
      summary: {
        total: 1,
      },
      payload: {
        rate_plan_ids: ['RATE_004'],
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    const req = {
      body: {
        ratePlanIds: ['RATE_004'],
        startDate: '2026-03-24',
        endDate: '2026-03-30',
      },
    }
    const res = createMockResponse()

    await notifyDouyinAriController(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 1,
      },
      payload: {
        rate_plan_ids: ['RATE_004'],
      },
      result: {
        data: {
          error_code: 0,
        },
      },
    })
  })

  test('参数异常时应返回 400', async () => {
    const error = new Error('invalid date')
    error.douyinErrorCode = 5
    error.douyinDescription = '日期格式错误'
    buildDouyinAriByRatePlanIds.mockRejectedValue(error)

    const req = {
      body: {
        ratePlanIds: [],
        startDate: '',
        endDate: '',
      },
    }
    const res = createMockResponse()

    await previewDouyinAriController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 5,
      message: '日期格式错误',
    })
  })
})
