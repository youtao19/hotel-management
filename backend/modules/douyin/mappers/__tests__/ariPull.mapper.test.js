const { mapDouyinAriPullPayload } = require('../ariPull.mapper')

describe('ariPull.mapper', () => {
  test('应提取单个 rate_plan_id 和日期范围', () => {
    expect(mapDouyinAriPullPayload({
      rate_plan_id: 'RATE_001',
      start_date: '2026-03-24',
      end_date: '2026-03-30',
      biz_type: 2011,
    })).toEqual({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-30',
      bizType: 2011,
      rawPayload: {
        rate_plan_id: 'RATE_001',
        start_date: '2026-03-24',
        end_date: '2026-03-30',
        biz_type: 2011,
      },
    })
  })

  test('应提取多个 rate_plan_ids 和 date_range', () => {
    expect(mapDouyinAriPullPayload({
      rate_plan_ids: ['RATE_001', 'RATE_002'],
      date_range: {
        start: '2026-03-24',
        end: '2026-03-25',
      },
    })).toEqual({
      ratePlanIds: ['RATE_001', 'RATE_002'],
      startDate: '2026-03-24',
      endDate: '2026-03-25',
      bizType: null,
      rawPayload: {
        rate_plan_ids: ['RATE_001', 'RATE_002'],
        date_range: {
          start: '2026-03-24',
          end: '2026-03-25',
        },
      },
    })
  })
})
