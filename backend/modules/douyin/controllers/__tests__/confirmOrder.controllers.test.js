const {
  DOUYIN_CONFIRM_RESULT_ACCEPT,
  DOUYIN_CONFIRM_RESULT_REJECT,
  confirmDouyinOrder,
  saveConfirmResultToLocalOrder,
} = require('../../services/confirmOrder.service')
const {
  confirmOrder,
  validateConfirmOrderBody,
} = require('../confirmOrder.controllers')

jest.mock('../../services/confirmOrder.service', () => ({
  DOUYIN_CONFIRM_RESULT_ACCEPT: 1,
  DOUYIN_CONFIRM_RESULT_REJECT: 2,
  confirmDouyinOrder: jest.fn(),
  saveConfirmResultToLocalOrder: jest.fn(),
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

describe('validateConfirmOrderBody', () => {
  test('接单缺少 confirmNumber 时返回失败', () => {
    expect(validateConfirmOrderBody({
      otaOrderId: 'DY_001',
      confirmResult: 1,
    })).toEqual({
      valid: false,
      message: 'confirmNumber is required when confirmResult is 1',
    })
  })

  test('拒单参数完整时返回成功', () => {
    expect(validateConfirmOrderBody({
      otaOrderId: 'DY_002',
      confirmResult: 2,
      rejectReason: '库存不足',
    })).toEqual({
      valid: true,
      message: '',
    })
  })
})

describe('confirmOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('接单成功时应返回 confirmed', async () => {
    confirmDouyinOrder.mockResolvedValue({
      data: {
        error_code: 0,
        description: 'success',
      },
    })
    saveConfirmResultToLocalOrder.mockResolvedValue({
      action: 'confirmed',
    })

    const req = {
      body: {
        otaOrderId: 'DY_003',
        confirmResult: DOUYIN_CONFIRM_RESULT_ACCEPT,
        confirmNumber: 'CN_003',
      },
    }
    const res = createMockResponse()

    await confirmOrder(req, res)

    expect(confirmDouyinOrder).toHaveBeenCalledWith({
      otaOrderId: 'DY_003',
      confirmResult: 1,
      confirmNumber: 'CN_003',
      rejectCode: undefined,
      rejectReason: undefined,
    })
    expect(saveConfirmResultToLocalOrder).toHaveBeenCalledWith({
      otaOrderId: 'DY_003',
      confirmResult: 1,
      confirmNumber: 'CN_003',
      result: {
        data: {
          error_code: 0,
          description: 'success',
        },
      },
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'confirmed',
      result: {
        data: {
          error_code: 0,
          description: 'success',
        },
      },
    })
  })

  test('拒单成功时应返回 rejected', async () => {
    confirmDouyinOrder.mockResolvedValue({
      data: {
        error_code: 0,
        description: 'success',
      },
    })
    saveConfirmResultToLocalOrder.mockResolvedValue({
      action: 'rejected',
    })

    const req = {
      body: {
        otaOrderId: 'DY_004',
        confirmResult: DOUYIN_CONFIRM_RESULT_REJECT,
        rejectCode: 9,
        rejectReason: '库存不足',
      },
    }
    const res = createMockResponse()

    await confirmOrder(req, res)

    expect(confirmDouyinOrder).toHaveBeenCalledWith({
      otaOrderId: 'DY_004',
      confirmResult: 2,
      confirmNumber: undefined,
      rejectCode: 9,
      rejectReason: '库存不足',
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'rejected',
      result: {
        data: {
          error_code: 0,
          description: 'success',
        },
      },
    })
  })

  test('参数不合法时应返回 400', async () => {
    const req = {
      body: {
        otaOrderId: 'DY_005',
        confirmResult: 3,
      },
    }
    const res = createMockResponse()

    await confirmOrder(req, res)

    expect(confirmDouyinOrder).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'confirmResult must be 1 or 2',
    })
  })
})
