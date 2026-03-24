const { handleDouyinHotelBooking } = require('../../services/hotelBooking.service')
const { syncDouyinOrderToSystem } = require('../../services/orderSync.service')
const { autoConfirmDouyinOrder } = require('../../services/autoConfirm.service')
const {
  receiveSpiCallback,
  resolveConfirmMode,
} = require('../hotelBooking.controller')

jest.mock('../../services/hotelBooking.service', () => ({
  handleDouyinHotelBooking: jest.fn(),
}))

jest.mock('../../services/orderSync.service', () => ({
  syncDouyinOrderToSystem: jest.fn(),
}))

jest.mock('../../services/autoConfirm.service', () => ({
  autoConfirmDouyinOrder: jest.fn(),
}))

/**
 * 创建最小可用的 Express 响应对象 mock。
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

describe('receiveSpiCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.DOUYIN_CONFIRM_MODE
  })

  test('未指定时应默认走异步接单', () => {
    expect(resolveConfirmMode({})).toBe(2)
  })

  test('请求体指定同步时应返回同步接单模式', () => {
    expect(resolveConfirmMode({
      confirm_mode: 1,
    })).toBe(1)
  })

  test('成功时应返回官方创单响应结构', async () => {
    handleDouyinHotelBooking.mockResolvedValue({
      action: 'created',
      order: {
        ota_order_id: 'DY_001',
      },
    })
    syncDouyinOrderToSystem.mockResolvedValue({
      action: 'created',
      systemOrderId: 'O202603240001',
    })
    autoConfirmDouyinOrder.mockResolvedValue({})

    const req = {
      body: {
        order_id: 'DY_001',
      },
    }
    const res = createMockResponse()

    await receiveSpiCallback(req, res)

    expect(handleDouyinHotelBooking).toHaveBeenCalledWith({
      order_id: 'DY_001',
    }, {
      douyinLogId: '',
      confirmMode: 2,
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
        order_id: 'DY_001',
        order_out_id: 'O202603240001',
        confirm_info: {
          confirm_mode: 2,
        },
      },
    })
  })

  test('失败时应返回官方错误结构', async () => {
    const error = new Error('room type invalid')
    error.douyinErrorCode = 1
    error.douyinDescription = '房型不存在/失效'
    handleDouyinHotelBooking.mockRejectedValue(error)

    const req = {
      body: {
        order_id: 'DY_002',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_500',
      },
    }
    const res = createMockResponse()

    await receiveSpiCallback(req, res)

    expect(handleDouyinHotelBooking).toHaveBeenCalledWith({
      order_id: 'DY_002',
    }, {
      douyinLogId: 'LOGID_500',
      confirmMode: 2,
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 1,
        description: '房型不存在/失效',
        order_id: 'DY_002',
      },
    })
  })

  test('未知异常时应返回默认错误结构', async () => {
    handleDouyinHotelBooking.mockRejectedValue(new Error('unknown error'))

    const req = {
      body: {
        order_id: 'DY_003',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_003',
      },
    }
    const res = createMockResponse()

    await receiveSpiCallback(req, res)

    expect(handleDouyinHotelBooking).toHaveBeenCalledWith({
      order_id: 'DY_003',
    }, {
      douyinLogId: 'LOGID_003',
      confirmMode: 2,
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '其他异常',
        order_id: 'DY_003',
      },
    })
  })

  test('成功时应提取请求头 logid 传给创单服务', async () => {
    handleDouyinHotelBooking.mockResolvedValue({
      action: 'updated',
      order: {
        ota_order_id: 'DY_004',
      },
    })
    syncDouyinOrderToSystem.mockResolvedValue({
      action: 'recovered',
      systemOrderId: 'O202603240004',
    })

    const req = {
      body: {
        order_id: 'DY_004',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_004',
      },
    }
    const res = createMockResponse()

    await receiveSpiCallback(req, res)

    expect(handleDouyinHotelBooking).toHaveBeenCalledWith({
      order_id: 'DY_004',
    }, {
      douyinLogId: 'LOGID_004',
      confirmMode: 2,
    })
  })

  test('同步接单时应返回 confirm_mode=1 且不自动确认', async () => {
    handleDouyinHotelBooking.mockResolvedValue({
      action: 'created',
      order: {
        ota_order_id: 'DY_SYNC_001',
        confirm_mode: 1,
      },
    })
    syncDouyinOrderToSystem.mockResolvedValue({
      action: 'created',
      systemOrderId: 'O202603240010',
      confirmMode: 1,
    })

    const req = {
      body: {
        order_id: 'DY_SYNC_001',
        confirm_mode: 1,
      },
    }
    const res = createMockResponse()

    await receiveSpiCallback(req, res)

    expect(autoConfirmDouyinOrder).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
        order_id: 'DY_SYNC_001',
        order_out_id: 'O202603240010',
        confirm_info: {
          confirm_mode: 1,
        },
      },
    })
  })
})
