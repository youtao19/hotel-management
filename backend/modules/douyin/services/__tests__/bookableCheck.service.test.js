const postgreDB = require('../../../../database/postgreDB/pg')
const { getAvailableRooms } = require('../../../roomModule')
const { findLocalRoomTypeByDouyinRoomId } = require('../../repositories/roomTypeMapping.repository')
const { findPhysicalRoomByRatePlanId } = require('../../repositories/physicalRoom.repository')
const { handleDouyinBookableCheck } = require('../bookableCheck.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../../roomModule', () => ({
  getAvailableRooms: jest.fn(),
}))

jest.mock('../../repositories/roomTypeMapping.repository', () => ({
  findLocalRoomTypeByDouyinRoomId: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  findPhysicalRoomByRatePlanId: jest.fn(),
}))

describe('handleDouyinBookableCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('可订成功时返回 success', async () => {
    findPhysicalRoomByRatePlanId.mockResolvedValue({
      room_id: 'ROOM_001',
    })
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('bo_ye_shuang')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'bo_ye_shuang',
        type_name: '标准间',
        base_price: 199,
        is_closed: false,
      }],
    })
    getAvailableRooms.mockResolvedValue([
      { room_number: '101' },
      { room_number: '102' },
    ])

    const result = await handleDouyinBookableCheck({
      rate_plan_id: 'RATE_001',
      biz_type: 2011,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 19900,
      daily_rates: [
        {
          original_amount: 19900,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
    })

    expect(result).toEqual({
      errorCode: 0,
      description: 'success',
      ari: null,
    })
  })

  test('找不到售卖房型映射时返回房型不存在错误', async () => {
    findPhysicalRoomByRatePlanId.mockResolvedValue(null)

    await expect(handleDouyinBookableCheck({
      rate_plan_id: 'RATE_404',
      biz_type: 2011,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 10000,
    })).rejects.toMatchObject({
      douyinErrorCode: 1,
      douyinDescription: '房型不存在/失效',
    })
  })

  test('库存不足时返回入住时期内已满并附带 ari', async () => {
    findPhysicalRoomByRatePlanId.mockResolvedValue({
      room_id: 'ROOM_001',
    })
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('bo_ye_shuang')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'bo_ye_shuang',
        type_name: '标准间',
        base_price: 199,
        is_closed: false,
      }],
    })
    getAvailableRooms.mockResolvedValue([{ room_number: '101' }])

    const result = await handleDouyinBookableCheck({
      rate_plan_id: 'RATE_001',
      biz_type: 2011,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 2,
      number_of_guests: 2,
      total_amount: 39800,
    })

    expect(result.errorCode).toBe(4)
    expect(result.description).toBe('入住时期内已满')
    expect(result.ari).toMatchObject({
      stock_and_amount: [
        expect.objectContaining({
          rate_plan_id: 'RATE_001',
          room_id: 'ROOM_001',
          inventory: 1,
          available: true,
        }),
      ],
    })
  })

  test('价格不一致时返回价格不一致并附带 ari', async () => {
    findPhysicalRoomByRatePlanId.mockResolvedValue({
      room_id: 'ROOM_001',
    })
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('bo_ye_shuang')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'bo_ye_shuang',
        type_name: '标准间',
        base_price: 199,
        is_closed: false,
      }],
    })
    getAvailableRooms.mockResolvedValue([
      { room_number: '101' },
      { room_number: '102' },
    ])

    const result = await handleDouyinBookableCheck({
      rate_plan_id: 'RATE_001',
      biz_type: 2011,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 18800,
    })

    expect(result.errorCode).toBe(8)
    expect(result.description).toBe('价格与酒店实际价格不一致')
    expect(result.ari).toBeTruthy()
  })

  test('日期非法时返回日期格式错误', async () => {
    await expect(handleDouyinBookableCheck({
      rate_plan_id: 'RATE_001',
      biz_type: 2011,
      check_in_date: '2026/03/24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 19900,
    })).rejects.toMatchObject({
      douyinErrorCode: 5,
      douyinDescription: '日期格式错误',
    })
  })
})
