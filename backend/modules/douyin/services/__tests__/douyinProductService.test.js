jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'ACC_001',
    poiId: 'HOTEL_ENV_001',
  },
}))

const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const { upsertPhysicalRoom } = require('../../repositories/physicalRoom.repository')
const { findLocalRatePlanDetails } = require('../../repositories/localRatePlan.repository')
const { upsertChannelMapping } = require('../../../ota/repositories/channelMapping.repository')
const {
  DOUYIN_CHANNEL_CODE,
  RATE_PLAN_TARGET_TYPE,
  assertRatePlanSaveResult,
  buildDouyinProductPayload,
  normalizeLocalRatePlanId,
  resolveDouyinPoiId,
  resolveRatePlanActive,
  syncProductToDouyin,
} = require('../douyinProductService')

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  upsertPhysicalRoom: jest.fn(),
}))

jest.mock('../../repositories/localRatePlan.repository', () => ({
  findLocalRatePlanDetails: jest.fn(),
}))

jest.mock('../../../ota/repositories/channelMapping.repository', () => ({
  upsertChannelMapping: jest.fn(),
}))

describe('douyinProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应校验本地套餐 ID 为正整数', () => {
    expect(normalizeLocalRatePlanId('101')).toBe(101)
    expect(normalizeLocalRatePlanId(0)).toBeNull()
    expect(normalizeLocalRatePlanId('abc')).toBeNull()
  })

  test('应优先使用请求传入的酒店 ID', () => {
    expect(resolveDouyinPoiId({
      raw_hotel_id: 'HOTEL_RAW_001',
    }, 'HOTEL_REQ_001')).toBe('HOTEL_REQ_001')
  })

  test('套餐或房型关闭时不应上架', () => {
    expect(resolveRatePlanActive({
      status: 1,
      room_is_closed: false,
      room_type_is_closed: false,
    })).toBe(true)
    expect(resolveRatePlanActive({
      status: 0,
      room_is_closed: false,
      room_type_is_closed: false,
    })).toBe(false)
    expect(resolveRatePlanActive({
      status: 1,
      room_is_closed: true,
      room_type_is_closed: false,
    })).toBe(false)
  })

  test('应组装本地套餐同步抖音的请求体', async () => {
    findLocalRatePlanDetails.mockResolvedValue({
      id: 101,
      name: '豪华大床房-双早特惠',
      status: 1,
      type_code: 'DELUXE_KING',
      type_name: '豪华大床房',
      room_is_closed: false,
      room_type_is_closed: false,
      douyin_room_id: 'ROOM_001',
      physical_room_id: 'ROOM_001',
      account_id: 'ACC_LOCAL_001',
      raw_hotel_id: 'HOTEL_001',
      rate_plan_list: [],
      raw_payload: {
        hotel_id: 'HOTEL_001',
      },
    })

    const result = await buildDouyinProductPayload({
      localRatePlanId: 101,
      mode: 'meal',
      modeConfig: {
        mealCount: 2,
      },
    })

    expect(result.payload).toEqual({
      account_id: 'ACC_LOCAL_001',
      rate_plan: {
        hotel_id: 'HOTEL_001',
        rooms: [{
          room_id: 'ROOM_001',
          rate_plans: [{
            rate_plan_name: '豪华大床房-双早特惠',
            out_rate_plan_id: '101',
            currency: 'CNY',
            active: true,
            confirm_immediately: false,
            sales_type: 1,
            settle_type: 1,
            meals: [{
              type: 1,
              num: 2,
            }],
          }],
        }],
      },
    })
  })

  test('房型未绑定抖音物理房型时应拒绝同步', async () => {
    findLocalRatePlanDetails.mockResolvedValue({
      id: 102,
      name: '未绑定套餐',
      douyin_room_id: null,
      physical_room_id: null,
    })

    await expect(buildDouyinProductPayload({
      localRatePlanId: 102,
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '本地套餐所属房型尚未绑定抖音物理房型',
    })
  })

  test('抖音业务失败时应透出描述且不落库', () => {
    expect(() => assertRatePlanSaveResult({
      data: {
        error_code: 2100005,
        description: '参数不合法',
      },
      extra: {
        sub_description: 'rate_plan_name is required',
      },
    })).toThrow('参数不合法: rate_plan_name is required')
  })

  test('同步成功后应回写物理房型和统一渠道映射表', async () => {
    findLocalRatePlanDetails.mockResolvedValue({
      id: 103,
      name: '行政房-预定限制',
      status: 1,
      type_code: 'EXECUTIVE',
      type_name: '行政房',
      room_is_closed: false,
      room_type_is_closed: false,
      douyin_room_id: 'ROOM_103',
      douyin_room_name: '行政房',
      physical_room_id: 'ROOM_103',
      physical_room_name: '行政房',
      physical_status: 1,
      audit_message: null,
      account_id: 'ACC_103',
      raw_hotel_id: 'HOTEL_103',
      rate_plan_list: [],
      raw_payload: {
        hotel_id: 'HOTEL_103',
      },
    })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
        rate_plan_map: [{
          rate_plan_id: 'RATE_103',
          out_rate_plan_id: '103',
          code: '0',
          message: 'success',
        }],
      },
    })
    upsertPhysicalRoom.mockResolvedValue({
      room_id: 'ROOM_103',
    })
    upsertChannelMapping.mockResolvedValue({
      local_target_type: RATE_PLAN_TARGET_TYPE,
      local_target_id: 103,
      channel_code: DOUYIN_CHANNEL_CODE,
      channel_item_id: 'RATE_103',
    })

    const result = await syncProductToDouyin({
      localRatePlanId: 103,
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
      data: result.payload,
    })
    expect(upsertPhysicalRoom).toHaveBeenCalledWith({
      accountId: 'ACC_103',
      roomId: 'ROOM_103',
      roomName: '行政房',
      status: 1,
      auditMessage: null,
      ratePlanList: [{
        rate_plan_id: 'RATE_103',
        out_rate_plan_id: '103',
        code: '0',
        message: 'success',
        local_rate_plan_id: 103,
        rate_plan_name: '行政房-预定限制',
        active: true,
        mode: 'booking',
      }],
      rawPayload: {
        hotel_id: 'HOTEL_103',
        rate_plan_list: [{
          rate_plan_id: 'RATE_103',
          out_rate_plan_id: '103',
          code: '0',
          message: 'success',
          local_rate_plan_id: 103,
          rate_plan_name: '行政房-预定限制',
          active: true,
          mode: 'booking',
        }],
      },
    })
    expect(upsertChannelMapping).toHaveBeenCalledWith({
      localTargetType: RATE_PLAN_TARGET_TYPE,
      localTargetId: 103,
      channelCode: DOUYIN_CHANNEL_CODE,
      channelItemId: 'RATE_103',
      syncStatus: 1,
      channelConfig: {
        accountId: 'ACC_103',
        poiId: 'HOTEL_103',
        roomId: 'ROOM_103',
        outRatePlanId: '103',
        ratePlanName: '行政房-预定限制',
        mode: 'booking',
      },
    })
    expect(result.ratePlan).toEqual({
      rate_plan_id: 'RATE_103',
      out_rate_plan_id: '103',
      code: '0',
      message: 'success',
    })
  })
})
