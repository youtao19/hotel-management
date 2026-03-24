const { toggleDouyinPhysicalRoomActive } = require('../../services/physicalRoomStatus.service')
const {
  resolvePhysicalRoomStatusBody,
  updateDouyinPhysicalRoomStatusController,
} = require('../physicalRoomStatus.controller')

jest.mock('../../services/physicalRoomStatus.service', () => ({
  toggleDouyinPhysicalRoomActive: jest.fn(),
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

describe('physicalRoomStatus.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应解析标准请求体', () => {
    expect(resolvePhysicalRoomStatusBody({
      roomId: 'ROOM_001',
      accountId: 'ACC_001',
      active: true,
    })).toEqual({
      roomId: 'ROOM_001',
      accountId: 'ACC_001',
      active: true,
    })
  })

  test('更新成功时应返回结果', async () => {
    toggleDouyinPhysicalRoomActive.mockResolvedValue({
      action: 'online',
      status: 'updated',
      payload: {
        account_id: 'ACC_001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
      savedRoom: {
        room_id: 'ROOM_001',
      },
    })

    const req = {
      body: {
        roomId: 'ROOM_001',
        active: true,
      },
    }
    const res = createMockResponse()

    await updateDouyinPhysicalRoomStatusController(req, res)

    expect(toggleDouyinPhysicalRoomActive).toHaveBeenCalledWith({
      roomId: 'ROOM_001',
      accountId: '',
      active: true,
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      action: 'online',
      status: 'updated',
      payload: {
        account_id: 'ACC_001',
      },
      result: {
        data: {
          error_code: 0,
        },
      },
      savedRoom: {
        room_id: 'ROOM_001',
      },
    })
  })

  test('active 不是布尔值时应返回 400', async () => {
    const req = {
      body: {
        roomId: 'ROOM_002',
        active: 'true',
      },
    }
    const res = createMockResponse()

    await updateDouyinPhysicalRoomStatusController(req, res)

    expect(toggleDouyinPhysicalRoomActive).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'active must be boolean',
    })
  })

  test('业务错误时应返回 400', async () => {
    const error = new Error('not found')
    error.douyinErrorCode = 13
    error.douyinDescription = '抖音物理房型不存在'
    toggleDouyinPhysicalRoomActive.mockRejectedValue(error)

    const req = {
      body: {
        roomId: 'ROOM_404',
        active: false,
      },
    }
    const res = createMockResponse()

    await updateDouyinPhysicalRoomStatusController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 13,
      message: '抖音物理房型不存在',
    })
  })
})
