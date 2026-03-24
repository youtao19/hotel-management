jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'ACC_001',
  },
}))

const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  findPhysicalRoomByRoomId,
  upsertPhysicalRoom,
} = require('../../repositories/physicalRoom.repository')
const {
  findLocalRoomTypeInfo,
} = require('../physicalRoomCreate.service')
const {
  RATE_PLAN_MODE,
  buildBookingModeConfig,
  buildBaseRatePlanItem,
  buildCancelModeConfig,
  buildDouyinRatePlanPayload,
  buildMealModeConfig,
  buildRatePlanModeConfig,
  buildStayModeConfig,
  createDouyinRatePlan,
  resolveRatePlanMapItem,
} = require('../ratePlanCreate.service')

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  findPhysicalRoomByRoomId: jest.fn(),
  upsertPhysicalRoom: jest.fn(),
}))

jest.mock('../physicalRoomCreate.service', () => ({
  findLocalRoomTypeInfo: jest.fn(),
  resolveAccountId: jest.fn((accountId) => String(accountId || 'ACC_001').trim()),
}))

describe('ratePlanCreate.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应构建基础版商品字段', () => {
    const result = buildBaseRatePlanItem({
      localRoomTypeInfo: {
        type_name: '山景大床房',
        is_closed: false,
      },
      localRoomType: 'LOCAL_ROOM_001',
      mode: RATE_PLAN_MODE.MEAL,
      modeConfig: {
        mealCount: 2,
      },
    })

    expect(result).toEqual({
      rate_plan_name: '山景大床房-餐食信息模式',
      out_rate_plan_id: 'LOCAL_ROOM_001_meal',
      currency: 'CNY',
      active: true,
      confirm_immediately: false,
      sales_type: 1,
      settle_type: 1,
      meals: [{
        type: 1,
        num: 2,
      }],
    })
  })

  test('应构建取消政策模式字段', () => {
    expect(buildCancelModeConfig({}, {
      freeCancelHoursBeforeCheckIn: 30,
    })).toEqual({
      cancel_rules: [{
        cancel_type: 2,
        cancel_time_type: 2,
        cancel_offset_time: {
          day: 1,
          hour: 6,
        },
        cut_type: 1,
        cut_value: 0,
      }],
    })
  })

  test('应构建连住模式字段', () => {
    expect(buildStayModeConfig({}, {
      minStayNights: 2,
      maxStayNights: 4,
    })).toEqual({
      stay_rules: {
        min_los: 2,
        max_los: 4,
      },
    })
  })

  test('应构建预定限制模式字段', () => {
    expect(buildBookingModeConfig({}, {
      advanceBookingDaysMin: 1,
      advanceBookingDaysMax: 20,
    })).toEqual({
      book_rules: {
        min_advance_time: {
          day: 1,
        },
        max_advance_time: {
          day: 20,
        },
      },
    })
  })

  test('模式配置不合法时应返回业务错误', () => {
    expect(() => buildRatePlanModeConfig({
      mode: RATE_PLAN_MODE.MEAL,
      localRoomTypeInfo: {},
      extraConfig: 'invalid',
    })).toThrow('商品模式配置不合法')
  })

  test('餐食数量不合法时应返回业务错误', () => {
    expect(() => buildMealModeConfig({}, {
      mealCount: 0,
    })).toThrow('餐食数量不合法')
  })

  test('应组装商品创建请求体', async () => {
    findLocalRoomTypeInfo.mockResolvedValue({
      type_code: 'LOCAL_ROOM_002',
      type_name: '城景双床房',
      is_closed: false,
    })
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_002',
      rate_plan_list: [],
    })

    const result = await buildDouyinRatePlanPayload({
      localRoomType: 'LOCAL_ROOM_002',
      poiId: 'HOTEL_002',
      roomId: 'ROOM_002',
      mode: 'stay',
      modeConfig: {
        minStayNights: 2,
        maxStayNights: 5,
      },
    })

    expect(result.payload).toEqual({
      account_id: 'ACC_001',
      rate_plan: {
        hotel_id: 'HOTEL_002',
        rooms: [{
          room_id: 'ROOM_002',
          rate_plans: [{
            rate_plan_name: '城景双床房-连住模式',
            out_rate_plan_id: 'LOCAL_ROOM_002_stay',
            currency: 'CNY',
            active: true,
            confirm_immediately: false,
            sales_type: 1,
            settle_type: 1,
            stay_rules: {
              min_los: 2,
              max_los: 5,
            },
          }],
        }],
      },
    })
  })

  test('物理房型不存在时应返回业务错误', async () => {
    findLocalRoomTypeInfo.mockResolvedValue({
      type_code: 'LOCAL_ROOM_003',
      type_name: '房型三',
      is_closed: false,
    })
    findPhysicalRoomByRoomId.mockResolvedValue(null)

    await expect(buildDouyinRatePlanPayload({
      localRoomType: 'LOCAL_ROOM_003',
      poiId: 'HOTEL_003',
      roomId: 'ROOM_404',
      mode: 'meal',
      modeConfig: {},
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '抖音物理房型不存在',
    })
  })

  test('返回缺少 rate_plan_id 时应报错', () => {
    expect(() => resolveRatePlanMapItem({
      data: {
        rate_plan_map: [{
          out_rate_plan_id: 'LOCAL_ROOM_004_meal',
        }],
      },
    }, 'LOCAL_ROOM_004_meal')).toThrow('抖音返回的售卖房型ID缺失')
  })

  test('创建成功后应回写到物理房型记录', async () => {
    findLocalRoomTypeInfo.mockResolvedValue({
      type_code: 'LOCAL_ROOM_005',
      type_name: '行政房',
      is_closed: false,
    })
    findPhysicalRoomByRoomId.mockResolvedValue({
      account_id: 'ACC_001',
      room_id: 'ROOM_005',
      room_name: '行政房',
      status: 1,
      audit_message: null,
      rate_plan_list: [],
      raw_payload: {
        room_id: 'ROOM_005',
      },
    })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
        rate_plan_map: [{
          rate_plan_id: 'RATE_005',
          out_rate_plan_id: 'LOCAL_ROOM_005_booking',
          code: '0',
          message: 'success',
        }],
      },
    })
    upsertPhysicalRoom.mockResolvedValue({
      room_id: 'ROOM_005',
      rate_plan_list: [{
        rate_plan_id: 'RATE_005',
      }],
    })

    const result = await createDouyinRatePlan({
      localRoomType: 'LOCAL_ROOM_005',
      poiId: 'HOTEL_005',
      roomId: 'ROOM_005',
      mode: 'booking',
      modeConfig: {
        advanceBookingDaysMin: 1,
        advanceBookingDaysMax: 30,
      },
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/hotel/rateplan/save/',
      withAccountId: false,
      data: {
        account_id: 'ACC_001',
        rate_plan: {
          hotel_id: 'HOTEL_005',
          rooms: [{
            room_id: 'ROOM_005',
            rate_plans: [{
              rate_plan_name: '行政房-预定限制模式',
              out_rate_plan_id: 'LOCAL_ROOM_005_booking',
              currency: 'CNY',
              active: true,
              confirm_immediately: false,
              sales_type: 1,
              settle_type: 1,
              book_rules: {
                min_advance_time: {
                  day: 1,
                },
                max_advance_time: {
                  day: 30,
                },
              },
            }],
          }],
        },
      },
    })
    expect(upsertPhysicalRoom).toHaveBeenCalledWith({
      accountId: 'ACC_001',
      roomId: 'ROOM_005',
      roomName: '行政房',
      status: 1,
      auditMessage: null,
      ratePlanList: [{
        rate_plan_id: 'RATE_005',
        out_rate_plan_id: 'LOCAL_ROOM_005_booking',
        code: '0',
        message: 'success',
        rate_plan_name: '行政房-预定限制模式',
        mode: 'booking',
      }],
      rawPayload: {
        room_id: 'ROOM_005',
        rate_plan_list: [{
          rate_plan_id: 'RATE_005',
          out_rate_plan_id: 'LOCAL_ROOM_005_booking',
          code: '0',
          message: 'success',
          rate_plan_name: '行政房-预定限制模式',
          mode: 'booking',
        }],
      },
    })
    expect(result.ratePlan).toEqual({
      rate_plan_id: 'RATE_005',
      out_rate_plan_id: 'LOCAL_ROOM_005_booking',
      code: '0',
      message: 'success',
    })
  })
})
