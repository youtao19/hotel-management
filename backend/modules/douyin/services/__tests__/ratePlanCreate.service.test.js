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
  buildBaseRatePlanItem,
  buildDouyinRatePlanPayload,
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
        num: 1,
      }],
    })
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
