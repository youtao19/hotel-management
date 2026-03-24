const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  findPhysicalRoomByRoomId,
  updatePhysicalRoomRatePlanList,
} = require('../../repositories/physicalRoom.repository')
const { findLocalRoomTypeInfo } = require('../physicalRoomCreate.service')
const {
  buildDouyinRatePlanStatusPayload,
  findRatePlanMapping,
  toggleDouyinRatePlanActive,
} = require('../ratePlanStatus.service')

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  findPhysicalRoomByRoomId: jest.fn(),
  updatePhysicalRoomRatePlanList: jest.fn(),
}))

jest.mock('../physicalRoomCreate.service', () => ({
  findLocalRoomTypeInfo: jest.fn(),
  resolveAccountId: jest.fn((accountId) => String(accountId || 'ACC_001').trim()),
}))

describe('ratePlanStatus.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应在物理房型中找到目标商品', () => {
    expect(findRatePlanMapping({
      rate_plan_list: [{
        rate_plan_id: 'RATE_001',
        out_rate_plan_id: 'LOCAL_ROOM_001_meal',
      }],
    }, 'RATE_001')).toEqual({
      rate_plan_id: 'RATE_001',
      out_rate_plan_id: 'LOCAL_ROOM_001_meal',
    })
  })

  test('应组装商品上架请求体', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_001',
      raw_payload: {
        out_room_id: 'LOCAL_ROOM_001',
        hotel_id: 'HOTEL_001',
      },
      rate_plan_list: [{
        rate_plan_id: 'RATE_001',
        out_rate_plan_id: 'LOCAL_ROOM_001_meal',
        rate_plan_name: '山景房-餐食信息模式',
        mode: 'meal',
      }],
    })
    findLocalRoomTypeInfo.mockResolvedValue({
      type_code: 'LOCAL_ROOM_001',
      type_name: '山景房',
      is_closed: false,
    })

    const result = await buildDouyinRatePlanStatusPayload({
      roomId: 'ROOM_001',
      ratePlanId: 'RATE_001',
      active: true,
      accountId: 'ACC_001',
    })

    expect(result.payload).toEqual({
      account_id: 'ACC_001',
      rate_plan: {
        hotel_id: 'HOTEL_001',
        rooms: [{
          room_id: 'ROOM_001',
          rate_plans: [{
            rate_plan_name: '山景房-餐食信息模式',
            out_rate_plan_id: 'LOCAL_ROOM_001_meal',
            rate_plan_id: 'RATE_001',
            currency: 'CNY',
            active: true,
            confirm_immediately: false,
            sales_type: 1,
            settle_type: 1,
            meals: [{
              type: 1,
              num: 1,
            }],
          }],
        }],
      },
    })
  })

  test('商品不存在时应返回业务错误', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_002',
      raw_payload: {
        out_room_id: 'LOCAL_ROOM_002',
      },
      rate_plan_list: [],
    })

    await expect(buildDouyinRatePlanStatusPayload({
      roomId: 'ROOM_002',
      ratePlanId: 'RATE_404',
      active: false,
      accountId: 'ACC_001',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '抖音售卖房型不存在',
    })
  })

  test('上架成功后应回写本地 active=true', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_003',
      raw_payload: {
        out_room_id: 'LOCAL_ROOM_003',
        hotel_id: 'HOTEL_003',
      },
      rate_plan_list: [{
        rate_plan_id: 'RATE_003',
        out_rate_plan_id: 'LOCAL_ROOM_003_booking',
        rate_plan_name: '行政房-预定限制模式',
        mode: 'booking',
        active: false,
      }],
    })
    findLocalRoomTypeInfo.mockResolvedValue({
      type_code: 'LOCAL_ROOM_003',
      type_name: '行政房',
      is_closed: false,
    })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })
    updatePhysicalRoomRatePlanList.mockResolvedValue({
      room_id: 'ROOM_003',
    })

    const result = await toggleDouyinRatePlanActive({
      roomId: 'ROOM_003',
      ratePlanId: 'RATE_003',
      active: true,
      accountId: 'ACC_001',
    })

    expect(updatePhysicalRoomRatePlanList).toHaveBeenCalledWith({
      roomId: 'ROOM_003',
      ratePlanList: [{
        rate_plan_id: 'RATE_003',
        out_rate_plan_id: 'LOCAL_ROOM_003_booking',
        rate_plan_name: '行政房-预定限制模式',
        mode: 'booking',
        active: true,
      }],
      rawPayload: {
        out_room_id: 'LOCAL_ROOM_003',
        hotel_id: 'HOTEL_003',
        rate_plan_list: [{
          rate_plan_id: 'RATE_003',
          out_rate_plan_id: 'LOCAL_ROOM_003_booking',
          rate_plan_name: '行政房-预定限制模式',
          mode: 'booking',
          active: true,
        }],
      },
    })
    expect(result.action).toBe('online')
    expect(result.status).toBe('updated')
  })

  test('下架失败时不应回写本地状态', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_004',
      raw_payload: {
        out_room_id: 'LOCAL_ROOM_004',
        hotel_id: 'HOTEL_004',
      },
      rate_plan_list: [{
        rate_plan_id: 'RATE_004',
        out_rate_plan_id: 'LOCAL_ROOM_004_cancel',
        rate_plan_name: '城景房-取消政策模式',
        mode: 'cancel',
        active: true,
      }],
    })
    findLocalRoomTypeInfo.mockResolvedValue({
      type_code: 'LOCAL_ROOM_004',
      type_name: '城景房',
      is_closed: false,
    })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 2100005,
      },
    })

    const result = await toggleDouyinRatePlanActive({
      roomId: 'ROOM_004',
      ratePlanId: 'RATE_004',
      active: false,
      accountId: 'ACC_001',
    })

    expect(updatePhysicalRoomRatePlanList).not.toHaveBeenCalled()
    expect(result.action).toBe('offline')
    expect(result.status).toBe('failed')
  })
})
