const postgreDB = require('../../../../database/postgreDB/pg')
const { cancelUnpaidDouyinOrder } = require('../orderTimeoutCancel.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

describe('orderTimeoutCancel.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应标记未支付超时取消', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [{
        ota_order_id: 'DY_001',
      }],
    })

    const result = await cancelUnpaidDouyinOrder({
      otaOrderId: 'DY_001',
      reason: '用户未支付超时取消',
    })

    expect(postgreDB.query).toHaveBeenCalledWith(
      expect.stringContaining("SET cancel_status = 'timeout_cancelled'"),
      ['DY_001', '用户未支付超时取消']
    )
    expect(result).toEqual({
      action: 'timeout_cancelled',
      otaOrderId: 'DY_001',
      reason: '用户未支付超时取消',
    })
  })

  test('缺少 otaOrderId 时应返回业务错误', async () => {
    await expect(cancelUnpaidDouyinOrder({
      otaOrderId: '',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '缺少抖音订单号',
    })
  })

  test('找不到订单时应返回业务错误', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [],
    })

    await expect(cancelUnpaidDouyinOrder({
      otaOrderId: 'DY_404',
    })).rejects.toMatchObject({
      douyinErrorCode: 9,
      douyinDescription: '订单不存在或状态异常',
    })
  })
})
