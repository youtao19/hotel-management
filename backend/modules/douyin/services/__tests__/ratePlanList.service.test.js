const {
  listLocalRatePlansWithDouyinStatus,
} = require('../../repositories/localRatePlan.repository')
const {
  listDouyinRatePlansService,
  mapRatePlanListItem,
} = require('../ratePlanList.service')

jest.mock('../../repositories/localRatePlan.repository', () => ({
  listLocalRatePlansWithDouyinStatus: jest.fn(),
}))

describe('ratePlanList.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('mapRatePlanListItem 应返回已同步套餐状态', () => {
    const result = mapRatePlanListItem({
      id: 1,
      room_id: 11,
      name: '豪华大床房-双早',
      base_price: 29900,
      status: 1,
      room_number: '801',
      type_code: 'DELUXE',
      type_name: '豪华大床房',
      local_room_exists: true,
      local_room_type_exists: true,
      douyin_room_id: 'DY_ROOM_001',
      douyin_room_name: '抖音豪华大床房',
      physical_room_id: 'DY_ROOM_001',
      physical_status: 1,
      douyin_rate_plan_id: 'RATE_001',
      sync_status: 1,
    })

    expect(result).toMatchObject({
      localRatePlanId: 1,
      localDataStatus: 'OK',
      douyinRoomId: 'DY_ROOM_001',
      douyinRatePlanId: 'RATE_001',
      syncStatus: 1,
      isDouyinRoomBound: true,
      isSynced: true,
    })
  })

  test('mapRatePlanListItem 应标记套餐关联房间缺失', () => {
    const result = mapRatePlanListItem({
      id: 2,
      room_id: 999,
      name: '异常套餐',
      local_room_exists: false,
      local_room_type_exists: false,
      sync_status: null,
    })

    expect(result).toMatchObject({
      localRatePlanId: 2,
      localDataStatus: 'ROOM_MISSING',
      localRoomExists: false,
      localRoomTypeExists: false,
      syncStatus: null,
      isSynced: false,
    })
  })

  test('mapRatePlanListItem 应标记房间房型缺失', () => {
    const result = mapRatePlanListItem({
      id: 3,
      room_id: 12,
      name: '房型异常套餐',
      room_number: '802',
      type_code: 'UNKNOWN',
      local_room_exists: true,
      local_room_type_exists: false,
    })

    expect(result).toMatchObject({
      localRatePlanId: 3,
      localDataStatus: 'ROOM_TYPE_MISSING',
      localRoomExists: true,
      localRoomTypeExists: false,
    })
  })

  test('listDouyinRatePlansService 应映射仓库返回行', async () => {
    listLocalRatePlansWithDouyinStatus.mockResolvedValue([
      {
        id: 1,
        room_id: 11,
        name: '豪华大床房-双早',
        local_room_exists: true,
        local_room_type_exists: true,
        sync_status: null,
      },
    ])

    const result = await listDouyinRatePlansService()

    expect(listLocalRatePlansWithDouyinStatus).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      localRatePlanId: 1,
      localDataStatus: 'OK',
      syncStatus: null,
    })
  })
})
