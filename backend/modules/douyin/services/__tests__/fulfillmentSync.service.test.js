const postgreDB = require('../../../../database/postgreDB/pg')
const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  DOUYIN_ACCOMMODATION_STATUS,
  DOUYIN_FULFILLMENT_ACTION,
  buildDouyinFulfillmentPayload,
  findDouyinOrderBySystemOrderId,
  isDouyinSystemOrder,
  pushDouyinCheckIn,
  pushDouyinCheckInBySystemOrder,
  pushDouyinCheckOut,
  pushDouyinCheckOutBySystemOrder,
} = require('../fulfillmentSync.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

describe('fulfillmentSync.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应按系统订单号查询抖音订单', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [{
        system_order_id: 'O202603240001',
      }],
    })

    const result = await findDouyinOrderBySystemOrderId('O202603240001')

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM douyin_orders'),
      ['O202603240001']
    )
    expect(result).toEqual({
      system_order_id: 'O202603240001',
    })
  })

  test('存在抖音映射时应识别为抖音订单', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [{
        system_order_id: 'O202603240001',
      }],
    })

    await expect(isDouyinSystemOrder('O202603240001')).resolves.toBe(true)
  })

  test('应构建入住同步请求体', () => {
    expect(buildDouyinFulfillmentPayload({
      ota_order_id: 'DY_001',
      system_order_id: 'O202603240001',
    }, DOUYIN_FULFILLMENT_ACTION.CHECK_IN)).toEqual({
      accommodation_status: DOUYIN_ACCOMMODATION_STATUS.CHECKED_IN,
      order_id: 'DY_001',
      order_out_id: 'O202603240001',
    })
  })

  test('应构建离店同步请求体', () => {
    expect(buildDouyinFulfillmentPayload({
      ota_order_id: 'DY_002',
      system_order_id: 'O202603240002',
    }, DOUYIN_FULFILLMENT_ACTION.CHECK_OUT)).toEqual({
      accommodation_status: DOUYIN_ACCOMMODATION_STATUS.CHECKED_OUT,
      order_id: 'DY_002',
      order_out_id: 'O202603240002',
    })
  })

  test('入住同步成功时应回写 sent', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_003',
          system_order_id: 'O202603240003',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })

    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
        description: '',
      },
      extra: {
        logid: 'LOG_003',
      },
    })

    const result = await pushDouyinCheckIn({
      orderId: 'O202603240003',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/trade/hotel/booking/audit/notify/',
      withAccountId: false,
      data: {
        accommodation_status: 1,
        order_id: 'DY_003',
        order_out_id: 'O202603240003',
      },
    })
    expect(postgreDB.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET fulfillment_status = $2'),
      [
        'O202603240003',
        'sent',
        'check_in',
        JSON.stringify({
          data: {
            error_code: 0,
            description: '',
          },
          extra: {
            logid: 'LOG_003',
          },
        }),
      ]
    )
    expect(result.status).toBe('sent')
  })

  test('离店同步失败时应回写 failed', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_004',
          system_order_id: 'O202603240004',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })

    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 2119002,
        description: '系统繁忙，请稍候再试',
      },
    })

    const result = await pushDouyinCheckOut({
      orderId: 'O202603240004',
    })

    expect(postgreDB.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET fulfillment_status = $2'),
      [
        'O202603240004',
        'failed',
        'check_out',
        JSON.stringify({
          data: {
            error_code: 2119002,
            description: '系统繁忙，请稍候再试',
          },
        }),
      ]
    )
    expect(result.status).toBe('failed')
  })

  test('找不到抖音映射时应抛业务错误', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [],
    })

    await expect(pushDouyinCheckIn({
      orderId: 'O202603240005',
    })).rejects.toMatchObject({
      douyinErrorCode: 9,
      douyinDescription: '订单不存在或状态异常',
    })
  })

  test('应支持按系统订单号复用入住推送', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_006',
          system_order_id: 'O202603240006',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    const result = await pushDouyinCheckInBySystemOrder('O202603240006')

    expect(result.action).toBe('check_in')
    expect(result.status).toBe('sent')
  })

  test('应支持按系统订单号复用离店推送', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_007',
          system_order_id: 'O202603240007',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    const result = await pushDouyinCheckOutBySystemOrder('O202603240007')

    expect(result.action).toBe('check_out')
    expect(result.status).toBe('sent')
  })
})
