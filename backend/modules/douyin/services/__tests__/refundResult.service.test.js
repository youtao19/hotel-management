const postgreDB = require('../../../../database/postgreDB/pg')
const { applyRefundCaseToLocalOrder } = require('../refundCase.service')
const {
  findDouyinOrderByRefundContext,
  handleDouyinRefundResult,
} = require('../refundResult.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../refundCase.service', () => ({
  applyRefundCaseToLocalOrder: jest.fn(),
}))

describe('refundResult.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应按 otaOrderId 查找抖音订单', async () => {
    postgreDB.query.mockResolvedValueOnce({
      rows: [{
        ota_order_id: 'DY_001',
      }],
    })

    const result = await findDouyinOrderByRefundContext({
      otaOrderId: 'DY_001',
      sourceOrderId: '',
      cancelId: '',
    })

    expect(result).toEqual({
      ota_order_id: 'DY_001',
    })
  })

  test('退款结果成功时应回写状态', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_002',
          system_order_id: 'O202603240002',
          order_status: 'reserved',
          refund_case_type: 'calendar_refund',
        }],
      })
      .mockResolvedValueOnce({
        rows: [],
      })

    const result = await handleDouyinRefundResult({
      order_id: 'DY_002',
      refund_status: 'success',
      refund_amount: 19900,
      user_refund_amount: 19900,
      cancel_finish_time: '2026-03-24 18:00:00',
    }, {
      douyinLogId: 'LOGID_REFUND_001',
    })

    expect(postgreDB.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET refund_status = $2'),
      [
        'DY_002',
        'success',
        199,
        199,
        '2026-03-24 18:00:00',
        JSON.stringify({
          order_id: 'DY_002',
          refund_status: 'success',
          refund_amount: 19900,
          user_refund_amount: 19900,
          cancel_finish_time: '2026-03-24 18:00:00',
        }),
      ]
    )
    expect(result).toEqual({
      errorCode: 0,
      description: 'success',
      refundStatus: 'success',
      otaOrderId: 'DY_002',
      douyinLogId: 'LOGID_REFUND_001',
    })
    expect(applyRefundCaseToLocalOrder).toHaveBeenCalledWith({
      localOrder: {
        order_id: 'O202603240002',
        status: 'reserved',
      },
      refundCaseType: 'calendar_refund',
      refundCaseStatus: 'completed',
      reason: '抖音退款结果通知成功',
    })
  })

  test('缺少退款状态时应返回业务错误', async () => {
    await expect(handleDouyinRefundResult({
      order_id: 'DY_003',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '退款状态不合法',
    })
  })

  test('找不到抖音订单时应返回业务错误', async () => {
    postgreDB.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await expect(handleDouyinRefundResult({
      order_id: 'DY_404',
      refund_status: 'success',
    })).rejects.toMatchObject({
      douyinErrorCode: 9,
      douyinDescription: '订单不存在或状态异常',
    })
  })
})
