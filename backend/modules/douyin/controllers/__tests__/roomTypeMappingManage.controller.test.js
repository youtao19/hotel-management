const {
  listDouyinRoomTypeMappingsService,
  saveDouyinRoomTypeMappingsService,
} = require('../../services/roomTypeMappingManage.service')
const {
  listDouyinRoomTypeMappingsController,
  resolveRoomTypeMappingsBody,
  saveDouyinRoomTypeMappingsController,
} = require('../roomTypeMappingManage.controller')

jest.mock('../../services/roomTypeMappingManage.service', () => ({
  listDouyinRoomTypeMappingsService: jest.fn(),
  saveDouyinRoomTypeMappingsService: jest.fn(),
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

describe('roomTypeMappingManage.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('resolveRoomTypeMappingsBody 应兼容对象结构输入', () => {
    expect(resolveRoomTypeMappingsBody({
      ROOM_001: {
        label: '山景大床房',
        value: 'LOCAL_ROOM_001',
      },
    })).toEqual([{
      douyinRoomId: 'ROOM_001',
      douyinRoomName: '山景大床房',
      localRoomType: 'LOCAL_ROOM_001',
    }])
  })

  test('查询映射列表成功时应返回标准响应', async () => {
    listDouyinRoomTypeMappingsService.mockResolvedValue([{
      douyin_room_id: 'ROOM_001',
      local_room_type: 'LOCAL_ROOM_001',
    }])

    const req = {}
    const res = createMockResponse()
    await listDouyinRoomTypeMappingsController(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      code: 'DOUYIN_ROOM_TYPE_MAPPING_LIST',
      data: [{
        douyin_room_id: 'ROOM_001',
        local_room_type: 'LOCAL_ROOM_001',
      }],
      message: '抖音房型映射列表获取成功',
    })
  })

  test('保存映射成功时应返回标准响应', async () => {
    saveDouyinRoomTypeMappingsService.mockResolvedValue([{
      douyin_room_id: 'ROOM_001',
      local_room_type: 'LOCAL_ROOM_001',
      local_room_type_name: '山景大床房',
    }])

    const req = {
      body: {
        mappings: [{
          roomId: 'ROOM_001',
          roomName: '山景大床房',
          value: 'LOCAL_ROOM_001',
        }],
      },
    }
    const res = createMockResponse()
    await saveDouyinRoomTypeMappingsController(req, res)

    expect(saveDouyinRoomTypeMappingsService).toHaveBeenCalledWith({
      mappings: [{
        douyinRoomId: 'ROOM_001',
        douyinRoomName: '山景大床房',
        localRoomType: 'LOCAL_ROOM_001',
      }],
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      code: 'DOUYIN_ROOM_TYPE_MAPPING_SAVED',
      data: [{
        douyin_room_id: 'ROOM_001',
        local_room_type: 'LOCAL_ROOM_001',
        local_room_type_name: '山景大床房',
      }],
      message: '抖音房型映射保存成功',
    })
  })

  test('保存映射失败时应返回 400', async () => {
    const error = new Error('invalid mapping')
    error.douyinErrorCode = 13
    error.douyinDescription = 'mappings 至少需要一条数据'
    saveDouyinRoomTypeMappingsService.mockRejectedValue(error)

    const req = {
      body: {
        mappings: [],
      },
    }
    const res = createMockResponse()
    await saveDouyinRoomTypeMappingsController(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorCode: 13,
      message: 'mappings 至少需要一条数据',
    })
  })
})
