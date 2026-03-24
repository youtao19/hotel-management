jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'ACC_001',
  },
}))

const postgreDB = require('../../../../database/postgreDB/pg')
const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  findPhysicalRoomByLocalRoomType,
  upsertPhysicalRoom,
} = require('../../repositories/physicalRoom.repository')
const { upsertRoomTypeMapping } = require('../../repositories/roomTypeMapping.repository')
const { queryDouyinPhysicalRoomDetail } = require('../physicalRoom.service')
const {
  DEFAULT_MAX_OCCUPANCY,
  buildDescriptions,
  buildDouyinPhysicalRoomPayload,
  createDouyinPhysicalRoom,
} = require('../physicalRoomCreate.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  findPhysicalRoomByLocalRoomType: jest.fn(),
  upsertPhysicalRoom: jest.fn(),
}))

jest.mock('../../repositories/roomTypeMapping.repository', () => ({
  upsertRoomTypeMapping: jest.fn(),
}))

jest.mock('../physicalRoom.service', () => ({
  queryDouyinPhysicalRoomDetail: jest.fn(),
}))

describe('physicalRoomCreate.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('buildDescriptions 应拆分并清洗描述文本', () => {
    expect(buildDescriptions('带早餐\n  高楼层  \n\n江景')).toEqual([
      '带早餐',
      '高楼层',
      '江景',
    ])
  })

  test('应组装最小物理房型创建请求体', async () => {
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          type_code: 'LOCAL_ROOM_001',
          type_name: '山景大床房',
          description: '带早餐\n高楼层',
          is_closed: false,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          total: 3,
        }],
      })

    const result = await buildDouyinPhysicalRoomPayload({
      localRoomType: 'LOCAL_ROOM_001',
      poiId: 'HOTEL_001',
    })

    expect(result).toEqual({
      account_id: 'ACC_001',
      poi_id: 'HOTEL_001',
      room_info: {
        out_room_id: 'LOCAL_ROOM_001',
        cn_name: '山景大床房',
        max_occupancy: DEFAULT_MAX_OCCUPANCY,
        room_num: 3,
        active: true,
        descriptions: ['带早餐', '高楼层'],
      },
    })
  })

  test('本地已存在映射时应拒绝重复创建', async () => {
    findPhysicalRoomByLocalRoomType.mockResolvedValue({
      room_id: 'ROOM_001',
    })

    await expect(createDouyinPhysicalRoom({
      localRoomType: 'LOCAL_ROOM_001',
      poiId: 'HOTEL_001',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '本地房型已存在抖音物理房型映射',
    })
  })

  test('本地房型不存在时应返回业务错误', async () => {
    findPhysicalRoomByLocalRoomType.mockResolvedValue(null)
    postgreDB.query.mockResolvedValueOnce({
      rows: [],
    })

    await expect(createDouyinPhysicalRoom({
      localRoomType: 'LOCAL_ROOM_002',
      poiId: 'HOTEL_001',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '本地房型不存在',
    })
  })

  test('创建成功后应回查详情并写入本地映射', async () => {
    findPhysicalRoomByLocalRoomType.mockResolvedValue(null)
    postgreDB.query
      .mockResolvedValueOnce({
        rows: [{
          type_code: 'LOCAL_ROOM_003',
          type_name: '行政双床房',
          description: '城景',
          is_closed: false,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          total: 2,
        }],
      })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        room_id: 'ROOM_003',
        error_code: 0,
      },
    })
    queryDouyinPhysicalRoomDetail.mockResolvedValue({
      data: {
        room_list: [{
          room_id: 'ROOM_003',
          cn_name: '行政双床房',
          hotel_id: 'HOTEL_003',
          status: 1,
          audit_message: '',
          rate_plan_list: [{
            rate_plan_id: 'RATE_003',
          }],
        }],
      },
    })
    upsertPhysicalRoom.mockResolvedValue({
      room_id: 'ROOM_003',
      room_name: '行政双床房',
    })
    upsertRoomTypeMapping.mockResolvedValue({
      douyin_room_id: 'ROOM_003',
      local_room_type: 'LOCAL_ROOM_003',
    })

    const result = await createDouyinPhysicalRoom({
      localRoomType: 'LOCAL_ROOM_003',
      poiId: 'HOTEL_003',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/physical_room/save/',
      withAccountId: false,
      data: {
        account_id: 'ACC_001',
        poi_id: 'HOTEL_003',
        room_info: {
          out_room_id: 'LOCAL_ROOM_003',
          cn_name: '行政双床房',
          max_occupancy: 2,
          room_num: 2,
          active: true,
          descriptions: ['城景'],
        },
      },
    })
    expect(queryDouyinPhysicalRoomDetail).toHaveBeenCalledWith({
      accountId: 'ACC_001',
      roomIds: ['ROOM_003'],
      needRatePlan: true,
    })
    expect(upsertPhysicalRoom).toHaveBeenCalledWith({
      accountId: 'ACC_001',
      roomId: 'ROOM_003',
      roomName: '行政双床房',
      status: 1,
      auditMessage: null,
      ratePlanList: [{
        rate_plan_id: 'RATE_003',
      }],
      rawPayload: {
        room_id: 'ROOM_003',
        cn_name: '行政双床房',
        hotel_id: 'HOTEL_003',
        status: 1,
        audit_message: '',
        rate_plan_list: [{
          rate_plan_id: 'RATE_003',
        }],
      },
    })
    expect(upsertRoomTypeMapping).toHaveBeenCalledWith({
      douyinRoomId: 'ROOM_003',
      douyinRoomName: '行政双床房',
      localRoomType: 'LOCAL_ROOM_003',
    })
    expect(result.roomId).toBe('ROOM_003')
  })
})
