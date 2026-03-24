const postgreDB = require('../../../../database/postgreDB/pg')
const { updateOrderStatus } = require('../../../orderModule')
const {
  REFUND_CASE_TYPE,
  buildRefundCasePayload,
  calculateSuggestedRefundAmount,
  handleDouyinRefundCase,
} = require('../refundCase.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../../orderModule', () => ({
  updateOrderStatus: jest.fn(),
}))

describe('refundCase.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应解析退款 case 请求', () => {
    expect(buildRefundCasePayload({
      order_id: 'DY_001',
      order_out_id: 'O202603240001',
      refund_case_type: 'force_refund',
      refund_status: 'success',
      refund_amount: 10000,
    })).toEqual({
      otaOrderId: 'DY_001',
      orderOutId: 'O202603240001',
      cancelId: '',
      refundCaseType: 'force_refund',
      refundStatus: 'success',
      refundAmount: 100,
      userRefundAmount: null,
      reason: '',
      rawPayload: {
        order_id: 'DY_001',
        order_out_id: 'O202603240001',
        refund_case_type: 'force_refund',
        refund_status: 'success',
        refund_amount: 10000,
      },
    })
  })

  test('应按未入住拆分行计算建议退款金额', () => {
    expect(calculateSuggestedRefundAmount([
      { status: 'reserved', stay_date: '2026-03-24', total_price: 100 },
      { status: 'reserved', stay_date: '2026-03-25', total_price: 120 },
    ])).toBe(220)
  })

  test('客服强退成功时应回写退款 case 并取消本地订单', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_FORCE_001',
          system_order_id: 'O202603240010',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          order_id: 'O202603240010',
          status: 'reserved',
          stay_date: '2026-03-24',
          total_price: 180,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    updateOrderStatus.mockResolvedValue({
      order_id: 'O202603240010',
      status: 'cancelled',
    })

    const result = await handleDouyinRefundCase({
      order_id: 'DY_FORCE_001',
      refund_case_type: REFUND_CASE_TYPE.FORCE,
      refund_status: 'success',
      reason: '客服强退',
    })

    expect(postgreDB.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('SET refund_case_type = $2'),
      [
        'DY_FORCE_001',
        'force_refund',
        'processing',
        'success',
        null,
        null,
        180,
        JSON.stringify({
          order_id: 'DY_FORCE_001',
          refund_case_type: 'force_refund',
          refund_status: 'success',
          reason: '客服强退',
        }),
      ]
    )
    expect(updateOrderStatus).not.toHaveBeenCalled()
    expect(result).toEqual({
      errorCode: 0,
      description: 'success',
      action: 'force_refund_processing',
      otaOrderId: 'DY_FORCE_001',
      suggestedRefundAmount: 180,
      douyinLogId: '',
    })
  })

  test('协商退款成功时应取消本地订单并写备注', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          ota_order_id: 'DY_NEGO_001',
          system_order_id: 'O202603240011',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          order_id: 'O202603240011',
          status: 'reserved',
          stay_date: '2026-03-24',
          total_price: 200,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    updateOrderStatus.mockResolvedValue({
      order_id: 'O202603240011',
      status: 'cancelled',
    })

    const result = await handleDouyinRefundCase({
      order_id: 'DY_NEGO_001',
      refund_case_type: REFUND_CASE_TYPE.NEGOTIATED,
      refund_status: 'success',
      reason: '协商退款成功',
    })

    expect(updateOrderStatus).toHaveBeenCalledWith('O202603240011', 'cancelled')
    expect(result.action).toBe('negotiated_refund_approved')
  })

  test('日历房退款 case 找不到订单时应报业务错误', async () => {
    postgreDB.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await expect(handleDouyinRefundCase({
      order_id: 'DY_404',
      cancel_id: 'CANCEL_404',
      refund_case_type: REFUND_CASE_TYPE.CALENDAR,
    })).rejects.toMatchObject({
      douyinErrorCode: 9,
      douyinDescription: '订单不存在或状态异常',
    })
  })
})
