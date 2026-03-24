const postgreDB = require('../../../../database/postgreDB/pg')
const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  DOUYIN_CONFIRM_RESULT_ACCEPT,
  DOUYIN_CONFIRM_RESULT_REJECT,
  confirmDouyinOrder,
  saveConfirmResultToLocalOrder,
} = require('../confirmOrder.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

describe('confirmDouyinOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('接单时应按官方结构发送 confirm_number', async () => {
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    await confirmDouyinOrder({
      otaOrderId: 'DY_CONFIRM_001',
      confirmResult: DOUYIN_CONFIRM_RESULT_ACCEPT,
      confirmNumber: 'CN_001',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/trade/hotel/order/confirm/',
      withAccountId: true,
      data: {
        order_id: 'DY_CONFIRM_001',
        confirm_result: {
          confirm_result: 1,
          confirm_number: 'CN_001',
        },
      },
    })
  })

  test('拒单时应按官方结构发送 reject_code 和 reject_reason', async () => {
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    await confirmDouyinOrder({
      otaOrderId: 'DY_CONFIRM_002',
      confirmResult: DOUYIN_CONFIRM_RESULT_REJECT,
      rejectCode: 9,
      rejectReason: '库存不足',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/trade/hotel/order/confirm/',
      withAccountId: true,
      data: {
        order_id: 'DY_CONFIRM_002',
        confirm_result: {
          confirm_result: 2,
          reject_code: 9,
          reject_reason: '库存不足',
        },
      },
    })
  })

  test('接单时缺少 confirmNumber 应抛错', async () => {
    await expect(confirmDouyinOrder({
      otaOrderId: 'DY_CONFIRM_003',
      confirmResult: DOUYIN_CONFIRM_RESULT_ACCEPT,
    })).rejects.toThrow('confirmNumber is required when confirmResult is 1')
  })
})

describe('saveConfirmResultToLocalOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('接单成功时应回写 confirmed', async () => {
    postgreDB.query.mockResolvedValue({ rows: [] })

    const result = await saveConfirmResultToLocalOrder({
      otaOrderId: 'DY_CONFIRM_004',
      confirmResult: DOUYIN_CONFIRM_RESULT_ACCEPT,
      confirmNumber: 'CN_004',
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining("SET confirm_status = 'confirmed'"),
      ['DY_CONFIRM_004', 'CN_004']
    )
    expect(result).toEqual({
      action: 'confirmed',
    })
  })

  test('拒单成功时应回写 rejected', async () => {
    postgreDB.query.mockResolvedValue({ rows: [] })

    const result = await saveConfirmResultToLocalOrder({
      otaOrderId: 'DY_CONFIRM_005',
      confirmResult: DOUYIN_CONFIRM_RESULT_REJECT,
      result: {
        data: {
          error_code: 0,
        },
      },
    })

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining("SET confirm_status = 'rejected'"),
      ['DY_CONFIRM_005']
    )
    expect(result).toEqual({
      action: 'rejected',
    })
  })

  test('抖音接口失败时应回写 failed', async () => {
    postgreDB.query.mockResolvedValue({ rows: [] })

    const result = await saveConfirmResultToLocalOrder({
      otaOrderId: 'DY_CONFIRM_006',
      confirmResult: DOUYIN_CONFIRM_RESULT_REJECT,
      result: {
        data: {
          error_code: 2119002,
        },
      },
    })

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining("SET confirm_status = 'failed'"),
      ['DY_CONFIRM_006']
    )
    expect(result).toEqual({
      action: 'failed',
    })
  })
})
