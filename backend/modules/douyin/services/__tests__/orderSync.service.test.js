const postgreDB = require('../../../../database/postgreDB/pg')
const { buildCreateOrderDataFromDouyin } = require('../../mappers/orderCreate.adapter')
const { createOrder } = require('../../../orderModule')
const { syncDouyinOrderToSystem } = require('../orderSync.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../mappers/orderCreate.adapter', () => ({
  buildCreateOrderDataFromDouyin: jest.fn(),
}))

jest.mock('../../../orderModule', () => ({
  createOrder: jest.fn(),
}))

describe('syncDouyinOrderToSystem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('找不到抖音订单时抛错', async () => {
    postgreDB.query.mockResolvedValueOnce({ rows: [] })

    await expect(syncDouyinOrderToSystem('DY_001')).rejects.toThrow('Douyin order not found')
  })

  test('已同步订单直接跳过', async () => {
    postgreDB.query.mockResolvedValueOnce({
      rows: [
        {
          ota_order_id: 'DY_001',
          synced: true,
          system_order_id: 123,
        },
      ],
    })

    const result = await syncDouyinOrderToSystem('DY_001')

    expect(result).toEqual({
      action: 'skip',
      systemOrderId: 123,
    })

    expect(buildCreateOrderDataFromDouyin).not.toHaveBeenCalled()
    expect(createOrder).not.toHaveBeenCalled()
  })

  test('未同步订单时调用 createOrder 并更新状态', async () => {
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
      orderId: 'DY_DY_001',
      sourceNumber: 'DY_001',
      orderSource: 'douyin',
    }

    postgreDB.query
      .mockResolvedValueOnce({ rows: [douyinOrder] }) // 查 douyin_orders
      .mockResolvedValueOnce({}) // 更新 synced

    buildCreateOrderDataFromDouyin.mockReturnValue(adaptedOrderData)
    createOrder.mockResolvedValue(undefined)

    const result = await syncDouyinOrderToSystem('DY_001')

    expect(buildCreateOrderDataFromDouyin).toHaveBeenCalledWith(douyinOrder)
    expect(createOrder).toHaveBeenCalledWith(adaptedOrderData)

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE douyin_orders'),
      ['DY_001']
    )

    expect(result).toEqual({
      action: 'created',
    })
  })
})
