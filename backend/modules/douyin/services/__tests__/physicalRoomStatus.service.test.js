const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  findPhysicalRoomByRoomId,
  updatePhysicalRoomStatus,
} = require('../../repositories/physicalRoom.repository')
const {
  PHYSICAL_ROOM_STATUS,
  buildDouyinPhysicalRoomStatusPayload,
  toggleDouyinPhysicalRoomActive,
} = require('../physicalRoomStatus.service')

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  findPhysicalRoomByRoomId: jest.fn(),
  updatePhysicalRoomStatus: jest.fn(),
}))

jest.mock('../physicalRoomCreate.service', () => ({
  DEFAULT_MAX_OCCUPANCY: 2,
  resolveAccountId: jest.fn((accountId) => String(accountId || 'ACC_001').trim()),
}))

describe('physicalRoomStatus.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应组装物理房型上架请求体', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_001',
      room_name: '山景房',
      raw_payload: {
        hotel_id: 'HOTEL_001',
        out_room_id: 'LOCAL_ROOM_001',
        cn_name: '山景房',
        room_num: 3,
        max_occupancy: 2,
        descriptions: ['带早餐'],
      },
    })

    const result = await buildDouyinPhysicalRoomStatusPayload({
      roomId: 'ROOM_001',
      active: true,
      accountId: 'ACC_001',
    })

    expect(result.payload).toEqual({
      account_id: 'ACC_001',
      poi_id: 'HOTEL_001',
      room_info: {
        room_id: 'ROOM_001',
        out_room_id: 'LOCAL_ROOM_001',
        cn_name: '山景房',
        max_occupancy: 2,
        room_num: 3,
        active: true,
        descriptions: ['带早餐'],
      },
    })
  })

  test('物理房型不存在时应返回业务错误', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue(null)

    await expect(buildDouyinPhysicalRoomStatusPayload({
      roomId: 'ROOM_404',
      active: false,
      accountId: 'ACC_001',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '抖音物理房型不存在',
    })
  })

  test('上架成功后应回写本地状态', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_002',
      raw_payload: {
        hotel_id: 'HOTEL_002',
        out_room_id: 'LOCAL_ROOM_002',
        cn_name: '行政房',
        room_num: 2,
        active: false,
      },
    })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })
    updatePhysicalRoomStatus.mockResolvedValue({
      room_id: 'ROOM_002',
    })

    const result = await toggleDouyinPhysicalRoomActive({
      roomId: 'ROOM_002',
      active: true,
      accountId: 'ACC_001',
    })

    expect(updatePhysicalRoomStatus).toHaveBeenCalledWith({
      roomId: 'ROOM_002',
      status: PHYSICAL_ROOM_STATUS.ACTIVE,
      rawPayload: {
        hotel_id: 'HOTEL_002',
        out_room_id: 'LOCAL_ROOM_002',
        cn_name: '行政房',
        room_num: 2,
        active: true,
      },
    })
    expect(result.action).toBe('online')
    expect(result.status).toBe('updated')
  })

  test('下架失败时不应回写本地状态', async () => {
    findPhysicalRoomByRoomId.mockResolvedValue({
      room_id: 'ROOM_003',
      raw_payload: {
        hotel_id: 'HOTEL_003',
        out_room_id: 'LOCAL_ROOM_003',
        cn_name: '城景房',
        room_num: 2,
        active: true,
      },
    })
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 2100005,
      },
    })

    const result = await toggleDouyinPhysicalRoomActive({
      roomId: 'ROOM_003',
      active: false,
      accountId: 'ACC_001',
    })

    expect(updatePhysicalRoomStatus).not.toHaveBeenCalled()
    expect(result.action).toBe('offline')
    expect(result.status).toBe('failed')
  })
})
