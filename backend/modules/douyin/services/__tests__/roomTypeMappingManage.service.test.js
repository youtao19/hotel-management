const postgreDB = require('../../../../database/postgreDB/pg')
const { upsertRoomTypeMapping } = require('../../repositories/roomTypeMapping.repository')
const {
  normalizeRoomTypeMappings,
  saveDouyinRoomTypeMappingsService,
} = require('../roomTypeMappingManage.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))

jest.mock('../../repositories/roomTypeMapping.repository', () => ({
  upsertRoomTypeMapping: jest.fn(),
}))

describe('roomTypeMappingManage.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('normalizeRoomTypeMappings 应校验空数组', () => {
    expect(() => normalizeRoomTypeMappings([])).toThrow('Mappings is empty')
  })

  test('saveDouyinRoomTypeMappingsService 本地房型不存在时应抛出业务错误', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [],
    })

    await expect(saveDouyinRoomTypeMappingsService({
      mappings: [{
        douyinRoomId: 'ROOM_001',
        douyinRoomName: '山景大床房',
        localRoomType: 'LOCAL_ROOM_001',
      }],
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '本地房型不存在: LOCAL_ROOM_001',
    })
  })

  test('saveDouyinRoomTypeMappingsService 应使用事务批量保存', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'LOCAL_ROOM_001',
        type_name: '山景大床房',
      }],
    })
    const mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    }
    postgreDB.getClient.mockResolvedValue(mockClient)
    upsertRoomTypeMapping.mockResolvedValue({
      id: 1,
      douyin_room_id: 'ROOM_001',
      local_room_type: 'LOCAL_ROOM_001',
    })

    const result = await saveDouyinRoomTypeMappingsService({
      mappings: [{
        douyinRoomId: 'ROOM_001',
        douyinRoomName: '山景大床房',
        localRoomType: 'LOCAL_ROOM_001',
      }],
    })

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(upsertRoomTypeMapping).toHaveBeenCalledWith({
      douyinRoomId: 'ROOM_001',
      douyinRoomName: '山景大床房',
      localRoomType: 'LOCAL_ROOM_001',
      client: mockClient,
    })
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
    expect(result).toEqual([{
      id: 1,
      douyin_room_id: 'ROOM_001',
      local_room_type: 'LOCAL_ROOM_001',
      local_room_type_name: '山景大床房',
    }])
  })

  test('saveDouyinRoomTypeMappingsService 出错时应回滚事务', async () => {
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'LOCAL_ROOM_001',
        type_name: '山景大床房',
      }],
    })
    const mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    }
    postgreDB.getClient.mockResolvedValue(mockClient)
    upsertRoomTypeMapping.mockRejectedValue(new Error('db fail'))

    await expect(saveDouyinRoomTypeMappingsService({
      mappings: [{
        douyinRoomId: 'ROOM_001',
        douyinRoomName: '山景大床房',
        localRoomType: 'LOCAL_ROOM_001',
      }],
    })).rejects.toThrow('db fail')

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })
})
