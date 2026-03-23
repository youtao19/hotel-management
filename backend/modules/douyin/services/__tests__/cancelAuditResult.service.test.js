const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const { submitDouyinCancelAuditResult } = require('../cancelAuditResult.service')

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

describe('submitDouyinCancelAuditResult', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应按官方字段回传审核结果', async () => {
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
        description: '',
      },
      raw: {
        data: {
          error_code: 0,
          description: '',
        },
      },
    })

    const result = await submitDouyinCancelAuditResult({
      cancelId: 'CANCEL_001',
      cancelResult: 1,
      cancelType: 1,
      otaOrderId: 'DY_001',
      reason: '审核同意取消',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/trade/hotel/cancel/audit/',
      data: {
        cancel_Id: 'CANCEL_001',
        cancel_result: 1,
        cancel_type: 1,
        order_id: 'DY_001',
        reason: '审核同意取消',
      },
    })
    expect(result.data.error_code).toBe(0)
  })

  test('业务返回失败时应抛错', async () => {
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 2100005,
        description: '参数不合法',
      },
      raw: {
        data: {
          error_code: 2100005,
          description: '参数不合法',
        },
      },
    })

    await expect(submitDouyinCancelAuditResult({
      cancelId: 'CANCEL_001',
      cancelResult: 2,
      cancelType: 2,
      otaOrderId: 'DY_001',
      reason: '拒绝取消',
    })).rejects.toThrow('参数不合法')
  })
})
