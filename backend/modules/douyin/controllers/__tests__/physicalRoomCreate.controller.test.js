const { createDouyinPhysicalRoom } = require('../../services/physicalRoomCreate.service')
const {
  createDouyinPhysicalRoomController,
  resolvePhysicalRoomCreateBody,
} = require('../physicalRoomCreate.controller')

jest.mock('../../services/physicalRoomCreate.service', () => ({
  createDouyinPhysicalRoom: jest.fn(),
}))

/**
 * 创建最小可用响应对象。
 *
 * @returns {{status: jest.Mock, json: jest.Mock}} 响应对象。
 */
function createMockResponse() {
  return {
    status: jest.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: jest.fn(function json(body) {
      return body
    }),
  }
}

describe('physicalRoomCreate.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('resolvePhysicalRoomCreateBody 应提取标准参数', () => {
    expect(resolvePhysicalRoomCreateBody({
      localRoomType: 'LOCAL_ROOM_001',
      accountId: 'ACC_001',
      poiId: 'HOTEL_001',
      categoryId: '8001001',
      images: [{ imageUrl: 'https://img.example.com/room-1.jpg' }],
    })).toEqual({
      localRoomType: 'LOCAL_ROOM_001',
      accountId: 'ACC_001',
      poiId: 'HOTEL_001',
      categoryId: '8001001',
      images: [{ imageUrl: 'https://img.example.com/room-1.jpg' }],
    })
  })

  test('创建成功时应返回成功结果', async () => {
    createDouyinPhysicalRoom.mockResolvedValue({
      action: 'created',
      roomId: 'ROOM_001',
      payload: {
        poi_id: 'HOTEL_001',
      },
      saveResult: {
        data: {
          room_id: 'ROOM_001',
        },
      },
      detailResult: {
        data: {
          room_list: [],
        },
      },
      savedRoom: {
        room_id: 'ROOM_001',
      },
      savedMapping: {
        local_room_type: 'LOCAL_ROOM_001',
      },
    })

    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_001',
        accountId: 'ACC_001',
        poiId: 'HOTEL_001',
        categoryId: '8001001',
        images: [{ imageUrl: 'https://img.example.com/room-1.jpg' }],
      },
    }
    const res = createMockResponse()

    await createDouyinPhysicalRoomController(req, res)

    expect(createDouyinPhysicalRoom).toHaveBeenCalledWith({
      localRoomType: 'LOCAL_ROOM_001',
      accountId: 'ACC_001',
      poiId: 'HOTEL_001',
      categoryId: '8001001',
      images: [{ imageUrl: 'https://img.example.com/room-1.jpg' }],
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'created',
      roomId: 'ROOM_001',
      payload: {
        poi_id: 'HOTEL_001',
      },
      saveResult: {
        data: {
          room_id: 'ROOM_001',
        },
      },
      detailResult: {
        data: {
          room_list: [],
        },
      },
      savedRoom: {
        room_id: 'ROOM_001',
      },
      savedMapping: {
        local_room_type: 'LOCAL_ROOM_001',
      },
    })
  })

  test('缺少 localRoomType 时应返回 400', async () => {
    const req = {
      body: {
        poiId: 'HOTEL_001',
      },
    }
    const res = createMockResponse()

    await createDouyinPhysicalRoomController(req, res)

    expect(createDouyinPhysicalRoom).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'localRoomType is required',
    })
  })

  test('缺少 poiId 时应返回 400', async () => {
    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_002',
      },
    }
    const res = createMockResponse()

    await createDouyinPhysicalRoomController(req, res)

    expect(createDouyinPhysicalRoom).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'poiId is required',
    })
  })

  test('缺少 categoryId 时应返回 400', async () => {
    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_002',
        poiId: 'HOTEL_001',
      },
    }
    const res = createMockResponse()

    await createDouyinPhysicalRoomController(req, res)

    expect(createDouyinPhysicalRoom).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'categoryId is required',
    })
  })

  test('缺少 images 时应返回 400', async () => {
    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_002',
        poiId: 'HOTEL_001',
        categoryId: '8001001',
        accountId: 'ACC_001',
      },
    }
    const res = createMockResponse()

    await createDouyinPhysicalRoomController(req, res)

    expect(createDouyinPhysicalRoom).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'images is required',
    })
  })

  test('业务错误时应返回 400', async () => {
    const error = new Error('duplicate')
    error.douyinErrorCode = 13
    error.douyinDescription = '本地房型已存在抖音物理房型映射'
    createDouyinPhysicalRoom.mockRejectedValue(error)

    const req = {
      body: {
        localRoomType: 'LOCAL_ROOM_003',
        accountId: 'ACC_001',
        poiId: 'HOTEL_003',
        categoryId: '8001001',
        images: [{ imageUrl: 'https://img.example.com/room-3.jpg' }],
      },
    }
    const res = createMockResponse()

    await createDouyinPhysicalRoomController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 13,
      message: '本地房型已存在抖音物理房型映射',
    })
  })
})
