const postgreDB = require('../../../../database/postgreDB/pg')
const { updateOrderStatus } = require('../../../orderModule')
const { submitDouyinCancelAuditResult } = require('../cancelAuditResult.service')
const { handleDouyinCancelOrder } = require('../cancelOrder.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  getClient: jest.fn(),
  query: jest.fn(),
}))

jest.mock('../../../orderModule', () => ({
  updateOrderStatus: jest.fn(),
}))

jest.mock('../cancelAuditResult.service', () => ({
  submitDouyinCancelAuditResult: jest.fn(),
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

  test('待入住订单且需要审核时，应取消本地订单并回传同意取消', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)
    submitDouyinCancelAuditResult.mockResolvedValue({ raw: { data: { error_code: 0 } } })

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001', cancel_audit_retry_count: 0 }] }) // 查 douyin_orders
      .mockResolvedValueOnce({ rows: [{ order_id: 'O_001', status: 'pending' }] }) // 查本地订单
      .mockResolvedValueOnce() // 更新 douyin_orders cancel info
      .mockResolvedValueOnce() // COMMIT

    updateOrderStatus.mockResolvedValue({ order_id: 'O_001', status: 'cancelled' })
    postgreDB.query.mockResolvedValue({})

    const result = await handleDouyinCancelOrder({
      order_id: 'DY_001',
      cancel_id: 'CANCEL_001',
      cancel_type: 1,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 21,
      need_audit: true,
      cancel_reason: '用户取消',
    })

    expect(updateOrderStatus).toHaveBeenCalledWith('O_001', 'cancelled', mockClient)
    expect(submitDouyinCancelAuditResult).toHaveBeenCalledWith({
      cancelId: 'CANCEL_001',
      cancelResult: 1,
      cancelType: 1,
      otaOrderId: 'DY_001',
      reason: '用户取消',
    })
    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE douyin_orders'),
      [
        'DY_001',
        1,
        '用户取消',
        'sent',
        JSON.stringify({ data: { error_code: 0 } }),
        1,
      ]
    )
    expect(result).toEqual({
      action: 'cancelled',
      cancelMode: 2,
      cancelResult: null,
      reason: '用户取消',
      localOrderId: 'O_001',
      cancelAuditStatus: 'sent',
      cancelAuditResult: 1,
    })
  })

  test('已入住订单且需要审核时，应回传拒绝取消但不修改本地状态', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)
    submitDouyinCancelAuditResult.mockResolvedValue({ raw: { data: { error_code: 0 } } })

    mockClient.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001', cancel_audit_retry_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ order_id: 'O_001', status: 'checked-in' }] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()

    postgreDB.query.mockResolvedValue({})

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
    expect(submitDouyinCancelAuditResult).toHaveBeenCalledWith({
      cancelId: 'CANCEL_001',
      cancelResult: 2,
      cancelType: 2,
      otaOrderId: 'DY_001',
      reason: '订单当前状态为 checked-in，拒绝取消',
    })
    expect(result).toEqual({
      action: 'pending_audit',
      cancelMode: 2,
      cancelResult: null,
      reason: '订单当前状态为 checked-in，需异步审核',
      localOrderId: 'O_001',
      cancelAuditStatus: 'sent',
      cancelAuditResult: 2,
    })
  })

  test('审核回传失败时不回滚本地取消结果', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)
    submitDouyinCancelAuditResult.mockRejectedValue(new Error('network error'))

    mockClient.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001', cancel_audit_retry_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ order_id: 'O_001', status: 'pending' }] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()

    updateOrderStatus.mockResolvedValue({ order_id: 'O_001', status: 'cancelled' })
    postgreDB.query.mockResolvedValue({})

    const result = await handleDouyinCancelOrder({
      order_id: 'DY_001',
      cancel_id: 'CANCEL_001',
      cancel_type: 1,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 21,
      need_audit: true,
    })

    expect(updateOrderStatus).toHaveBeenCalledWith('O_001', 'cancelled', mockClient)
    expect(result.cancelAuditStatus).toBe('push_failed')
    expect(result.cancelAuditResult).toBe(1)
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
