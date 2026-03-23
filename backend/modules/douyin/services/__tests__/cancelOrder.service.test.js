const postgreDB = require('../../../../database/postgreDB/pg')
const { updateOrderStatus } = require('../../../orderModule')
const { handleDouyinCancelOrder } = require('../cancelOrder.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  getClient: jest.fn(),
}))

jest.mock('../../../orderModule', () => ({
  updateOrderStatus: jest.fn(),
}))

/**
 * 创建数据库客户端 mock。
 *
 * @returns {{query: jest.Mock, release: jest.Mock}} 模拟客户端。
 */
function createMockClient() {
  return {
    query: jest.fn(),
    release: jest.fn(),
  }
}

describe('handleDouyinCancelOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('待入住订单应直接取消并返回异步取消模式', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001' }] }) // 查 douyin_orders
      .mockResolvedValueOnce({ rows: [{ order_id: 'O_001', status: 'pending' }] }) // 查本地订单
      .mockResolvedValueOnce() // 更新 douyin_orders cancel info
      .mockResolvedValueOnce() // COMMIT

    updateOrderStatus.mockResolvedValue({ order_id: 'O_001', status: 'cancelled' })

    const result = await handleDouyinCancelOrder({
      order_id: 'DY_001',
      cancel_id: 'CANCEL_001',
      cancel_type: 1,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 21,
      cancel_reason: '用户取消',
    })

    expect(updateOrderStatus).toHaveBeenCalledWith('O_001', 'cancelled', mockClient)
    expect(result).toEqual({
      action: 'cancelled',
      cancelMode: 2,
      cancelResult: null,
      reason: '用户取消',
      localOrderId: 'O_001',
    })
  })

  test('已取消订单应幂等返回成功', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001' }] })
      .mockResolvedValueOnce({ rows: [{ order_id: 'O_001', status: 'cancelled' }] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()

    const result = await handleDouyinCancelOrder({
      order_id: 'DY_001',
      cancel_id: 'CANCEL_001',
      cancel_type: 1,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 21,
    })

    expect(updateOrderStatus).not.toHaveBeenCalled()
    expect(result.action).toBe('already_cancelled')
    expect(result.cancelMode).toBe(2)
  })

  test('已入住订单应进入异步审核模式', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001' }] })
      .mockResolvedValueOnce({ rows: [{ order_id: 'O_001', status: 'checked-in' }] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()

    const result = await handleDouyinCancelOrder({
      order_id: 'DY_001',
      cancel_id: 'CANCEL_001',
      cancel_type: 2,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 21,
      need_audit: true,
    })

    expect(updateOrderStatus).not.toHaveBeenCalled()
    expect(result).toEqual({
      action: 'pending_audit',
      cancelMode: 2,
      cancelResult: null,
      reason: '订单当前状态为 checked-in，需异步审核',
      localOrderId: 'O_001',
    })
  })

  test('查不到抖音订单时返回订单不存在错误', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce()

    await expect(handleDouyinCancelOrder({
      order_id: 'DY_404',
      cancel_id: 'CANCEL_404',
      cancel_type: 1,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 21,
    })).rejects.toMatchObject({
      douyinErrorCode: 9,
      douyinDescription: '订单不存在或状态异常',
    })
  })
})
