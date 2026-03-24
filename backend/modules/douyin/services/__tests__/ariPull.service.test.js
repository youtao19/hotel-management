const { buildDouyinAriByRatePlanIds } = require('../ari.service')
const {
  buildDouyinPullAriItems,
  handleDouyinAriPull,
  normalizeAriPullPayload,
} = require('../ariPull.service')

jest.mock('../ari.service', () => ({
  buildDouyinAriByRatePlanIds: jest.fn(),
}))

describe('ariPull.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应标准化主动拉取请求', () => {
    expect(normalizeAriPullPayload({
      rate_plan_id: 'RATE_001',
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      biz_type: 2011,
    })).toEqual({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-25',
      bizType: 2011,
      rawPayload: {
        rate_plan_id: 'RATE_001',
        check_in_date: '2026-03-24',
        check_out_date: '2026-03-25',
        biz_type: 2011,
      },
    })
  })

  test('缺少 rate_plan_id 时应返回业务错误', () => {
    expect(() => normalizeAriPullPayload({
      start_date: '2026-03-24',
      end_date: '2026-03-25',
    })).toThrow('缺少售卖房型ID')
  })

  test('缺少日期范围时应返回业务错误', () => {
    expect(() => normalizeAriPullPayload({
      rate_plan_id: 'RATE_001',
    })).toThrow('缺少拉取日期范围')
  })

  test('biz_type 不合法时应返回业务错误', () => {
    expect(() => normalizeAriPullPayload({
      rate_plan_id: 'RATE_001',
      start_date: '2026-03-24',
      end_date: '2026-03-25',
      biz_type: 9999,
    })).toThrow('拉取价量态业务类型不合法')
  })

  test('应把基础 ARI 转成 stock_and_amount', async () => {
    buildDouyinAriByRatePlanIds.mockResolvedValue({
      aris: [{
        rate_plan_id: 'RATE_001',
        room_id: 'ROOM_001',
        timerange: {
          start: '2026-03-24',
          end: '2026-03-24',
        },
        original_amount: 25800,
        amount_before_tax: 25800,
        currency: 'CNY',
        inventory: 2,
        available: true,
      }],
      summary: {
        total: 1,
      },
    })

    const result = await buildDouyinPullAriItems({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-24',
    })

    expect(result).toEqual([{
      rate_plan_id: 'RATE_001',
      room_id: 'ROOM_001',
      timerange: {
        start: '2026-03-24',
        end: '2026-03-24',
      },
      original_amount: 25800,
      amount_before_tax: 25800,
      currency: 'CNY',
      inventory: 2,
      available: true,
    }])
  })

  test('处理成功时应返回统一成功结构', async () => {
    buildDouyinAriByRatePlanIds.mockResolvedValue({
      aris: [{
        rate_plan_id: 'RATE_002',
        room_id: 'ROOM_002',
        timerange: {
          start: '2026-03-24',
          end: '2026-03-24',
        },
        original_amount: 32800,
        amount_before_tax: 32800,
        currency: 'CNY',
        inventory: 1,
        available: true,
      }],
    })

    const result = await handleDouyinAriPull({
      rate_plan_ids: ['RATE_002'],
      start_date: '2026-03-24',
      end_date: '2026-03-24',
    }, {
      douyinLogId: 'LOGID_001',
    })

    expect(result).toEqual({
      errorCode: 0,
      description: 'success',
      stockAndAmount: [{
        rate_plan_id: 'RATE_002',
        room_id: 'ROOM_002',
        timerange: {
          start: '2026-03-24',
          end: '2026-03-24',
        },
        original_amount: 32800,
        amount_before_tax: 32800,
        currency: 'CNY',
        inventory: 1,
        available: true,
      }],
      summary: {
        ratePlanIds: ['RATE_002'],
        startDate: '2026-03-24',
        endDate: '2026-03-24',
        total: 1,
        douyinLogId: 'LOGID_001',
      },
    })
  })
})
