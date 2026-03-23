const postgreDB = require('../../../../database/postgreDB/pg')
const { autoConfirmDouyinOrder } = require('../autoConfirm.service')
const { confirmDouyinOrder } = require('../confirmOrder.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../confirmOrder.service', () => ({
  confirmDouyinOrder: jest.fn(),
}))

describe('autoConfirmDouyinOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('缺少 douyinOrder 时抛错', async () => {
    await expect(autoConfirmDouyinOrder()).rejects.toThrow('Missing ota_order_id in douyinOrder')
  })

  test('缺少 ota_order_id 时抛错', async () => {
    await expect(autoConfirmDouyinOrder({})).rejects.toThrow('Missing ota_order_id in douyinOrder')
  })

  test('已确认订单直接跳过', async () => {
    const douyinOrder = {
      ota_order_id: 'DY_TEST_001',
      confirm_status: 'confirmed',
      confirm_number: 'AUTO_OLD_001',
    }

    const result = await autoConfirmDouyinOrder(douyinOrder)

    expect(confirmDouyinOrder).not.toHaveBeenCalled()
    expect(postgreDB.query).not.toHaveBeenCalled()

    expect(result).toEqual({
      action: 'skip',
      message: 'Order already confirmed',
      confirmNumber: 'AUTO_OLD_001',
    })
  })

  test('正常情况下调用 confirmDouyinOrder 并回写 confirmed', async () => {
    confirmDouyinOrder.mockResolvedValue({
      success: true,
      data: {
        error_code: 0,
        description: 'success',
      },
    })

    postgreDB.query.mockResolvedValue({ rows: [] })

    const douyinOrder = {
      ota_order_id: 'DY_TEST_002',
      confirm_status: null,
    }

    const result = await autoConfirmDouyinOrder(douyinOrder)

    expect(confirmDouyinOrder).toHaveBeenCalledTimes(1)
    expect(confirmDouyinOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        otaOrderId: 'DY_TEST_002',
        confirmNumber: expect.stringMatching(/^AUTO_/),
      })
    )

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE douyin_orders'),
      ['DY_TEST_002', expect.stringMatching(/^AUTO_/)]
    )

    expect(result.action).toBe('confirmed')
    expect(result.confirmNumber).toMatch(/^AUTO_/)
    expect(result.result).toEqual({
      success: true,
      data: {
        error_code: 0,
        description: 'success',
      },
    })
  })

  test('确认失败时回写 failed', async () => {
    confirmDouyinOrder.mockResolvedValue({
      success: true,
      data: {
        error_code: 2119002,
        description: '系统繁忙，请稍候再试',
      },
    })

    postgreDB.query.mockResolvedValue({ rows: [] })

    const douyinOrder = {
      ota_order_id: 'DY_TEST_003',
      confirm_status: null,
    }

    const result = await autoConfirmDouyinOrder(douyinOrder)

    expect(confirmDouyinOrder).toHaveBeenCalledTimes(1)

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining("SET confirm_status = 'failed'"),
      ['DY_TEST_003']
    )

    expect(result.action).toBe('failed')
    expect(result.confirmNumber).toMatch(/^AUTO_/)
    expect(result.result).toEqual({
      success: true,
      data: {
        error_code: 2119002,
        description: '系统繁忙，请稍候再试',
      },
    })
  })
})
