const postgreDB = require('../../../../database/postgreDB/pg')
const { buildCreateOrderDataFromDouyin } = require('../../mappers/orderCreate.adapter')
const { createOrder } = require('../../../orderModule')
const { syncDouyinOrderToSystem } = require('../orderSync.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  getClient: jest.fn(),
}))

jest.mock('../../mappers/orderCreate.adapter', () => ({
  buildCreateOrderDataFromDouyin: jest.fn(),
}))

jest.mock('../../../orderModule', () => ({
  createOrder: jest.fn(),
}))

/**
 * 创建可控的数据库客户端 mock。
 *
 * @returns {{query: jest.Mock, release: jest.Mock}} 模拟事务客户端。
 */
function createMockClient() {
  return {
    query: jest.fn(),
    release: jest.fn(),
  }
}

describe('syncDouyinOrderToSystem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('找不到抖音订单时抛错', async () => {
    /** @type {{query: jest.Mock, release: jest.Mock}} 模拟事务客户端。 */
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // 查 douyin_orders
      .mockResolvedValueOnce() // ROLLBACK

    await expect(syncDouyinOrderToSystem('DY_001')).rejects.toThrow('Douyin order not found')

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM douyin_orders'),
      ['DY_001']
    )
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK')
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  test('已同步订单直接跳过', async () => {
    /** @type {{query: jest.Mock, release: jest.Mock}} 模拟事务客户端。 */
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            ota_order_id: 'DY_001',
            synced: true,
            system_order_id: 'O202603230001',
          },
        ],
      })
      .mockResolvedValueOnce() // COMMIT

    const result = await syncDouyinOrderToSystem('DY_001')

    expect(result).toEqual({
      action: 'skip',
      systemOrderId: 'O202603230001',
      confirmMode: null,
    })
    expect(buildCreateOrderDataFromDouyin).not.toHaveBeenCalled()
    expect(createOrder).not.toHaveBeenCalled()
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT')
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  test('本地订单已存在时回写同步状态并恢复成功', async () => {
    /** @type {{query: jest.Mock, release: jest.Mock}} 模拟事务客户端。 */
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    const douyinOrder = {
      ota_order_id: 'DY_001',
      synced: false,
    }

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [douyinOrder] }) // 查 douyin_orders
      .mockResolvedValueOnce({ rows: [{ order_id: 'O202603230001' }] }) // 查本地已存在订单
      .mockResolvedValueOnce() // 更新 douyin_orders
      .mockResolvedValueOnce() // COMMIT

    const result = await syncDouyinOrderToSystem('DY_001')

    expect(result).toEqual({
      action: 'recovered',
      systemOrderId: 'O202603230001',
      confirmMode: null,
    })
    expect(buildCreateOrderDataFromDouyin).not.toHaveBeenCalled()
    expect(createOrder).not.toHaveBeenCalled()
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE douyin_orders'),
      ['DY_001', 'O202603230001', null]
    )
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  test('未同步订单时创建本地订单并更新状态', async () => {
    /** @type {{query: jest.Mock, release: jest.Mock}} 模拟事务客户端。 */
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    const douyinOrder = {
      ota_order_id: 'DY_001',
      synced: false,
      guest_name: '张三',
      guest_mobile: '13800000000',
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-26',
      amount: 400,
    }

    const adaptedOrderData = {
      orderId: 'O202603230001',
      sourceNumber: 'DY_001',
      orderSource: 'douyin',
    }

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [douyinOrder] }) // 查 douyin_orders
      .mockResolvedValueOnce({ rows: [] }) // 查本地已存在订单
      .mockResolvedValueOnce() // 更新 douyin_orders
      .mockResolvedValueOnce() // COMMIT

    buildCreateOrderDataFromDouyin.mockResolvedValue(adaptedOrderData)
    createOrder.mockResolvedValue({ orderId: 'O202603230001' })

    const result = await syncDouyinOrderToSystem('DY_001')

    expect(buildCreateOrderDataFromDouyin).toHaveBeenCalledWith(douyinOrder)
    expect(createOrder).toHaveBeenCalledWith(adaptedOrderData, mockClient)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE douyin_orders'),
      ['DY_001', 'O202603230001', null]
    )
    expect(result).toEqual({
      action: 'created',
      systemOrderId: 'O202603230001',
      confirmMode: null,
    })
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  test('创建阶段命中唯一约束时按已存在订单恢复', async () => {
    /** @type {{query: jest.Mock, release: jest.Mock}} 模拟事务客户端。 */
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    const duplicateError = new Error('duplicate key value violates unique constraint "uniq_orders_source_id_source_primary_row"')
    duplicateError.code = '23505'
    duplicateError.constraint = 'uniq_orders_source_id_source_primary_row'

    mockClient.query
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_001', synced: false }] }) // 查 douyin_orders
      .mockResolvedValueOnce({ rows: [] }) // 首次查本地已存在订单
      .mockResolvedValueOnce({ rows: [{ order_id: 'O202603230001' }] }) // 冲突后再次查询本地订单
      .mockResolvedValueOnce() // 更新 douyin_orders
      .mockResolvedValueOnce() // COMMIT

    buildCreateOrderDataFromDouyin.mockResolvedValue({
      orderId: 'O202603230001',
      sourceNumber: 'DY_001',
      orderSource: 'douyin',
    })
    createOrder.mockRejectedValue(duplicateError)

    const result = await syncDouyinOrderToSystem('DY_001')

    expect(result).toEqual({
      action: 'recovered',
      systemOrderId: 'O202603230001',
      confirmMode: null,
    })
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE douyin_orders'),
      ['DY_001', 'O202603230001', null]
    )
    expect(mockClient.query).toHaveBeenNthCalledWith(6, 'COMMIT')
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  test('传入同步接单模式时应回写 confirm_mode', async () => {
    const mockClient = createMockClient()
    postgreDB.getClient.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ ota_order_id: 'DY_010', synced: false, confirm_mode: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()

    buildCreateOrderDataFromDouyin.mockResolvedValue({
      orderId: 'O202603240010',
      sourceNumber: 'DY_010',
      orderSource: 'douyin',
    })
    createOrder.mockResolvedValue({ orderId: 'O202603240010' })

    const result = await syncDouyinOrderToSystem('DY_010', {
      confirmMode: 1,
    })

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('confirm_mode = COALESCE($3, confirm_mode)'),
      ['DY_010', 'O202603240010', 1]
    )
    expect(result).toEqual({
      action: 'created',
      systemOrderId: 'O202603240010',
      confirmMode: 1,
    })
  })
})
