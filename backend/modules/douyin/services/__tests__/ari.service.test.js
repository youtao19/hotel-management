jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'ACC_001',
  },
}))

const postgreDB = require('../../../../database/postgreDB/pg')
const { getAvailableRooms } = require('../../../roomModule')
const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const { findLocalRoomTypeByDouyinRoomId } = require('../../repositories/roomTypeMapping.repository')
const { findPhysicalRoomsByRatePlanIds } = require('../../repositories/physicalRoom.repository')
const {
  buildDouyinAriByRatePlanIds,
  buildDouyinNotifyPayload,
  buildDouyinPricePayload,
  buildDouyinStockPayload,
  notifyDouyinAriRefresh,
  pushDouyinHotelPrice,
  pushDouyinHotelStock,
} = require('../ari.service')

jest.mock('../../../../database/postgreDB/pg', () => ({
  query: jest.fn(),
}))

jest.mock('../../../roomModule', () => ({
  getAvailableRooms: jest.fn(),
}))

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

jest.mock('../../repositories/roomTypeMapping.repository', () => ({
  findLocalRoomTypeByDouyinRoomId: jest.fn(),
}))

jest.mock('../../repositories/physicalRoom.repository', () => ({
  findPhysicalRoomsByRatePlanIds: jest.fn(),
}))

describe('ari.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应按 ratePlanIds 组装本地基础 ARI', async () => {
    findPhysicalRoomsByRatePlanIds.mockResolvedValue([
      {
        room_id: 'ROOM_001',
        matched_rate_plan_id: 'RATE_001',
        raw_payload: {
          hotel_id: 'HOTEL_001',
        },
      },
    ])
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('LOCAL_ROOM_001')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'LOCAL_ROOM_001',
        type_name: '本地房型',
        base_price: 288,
        is_closed: false,
      }],
    })
    getAvailableRooms
      .mockResolvedValueOnce([{ room_number: '101' }, { room_number: '102' }])
      .mockResolvedValueOnce([{ room_number: '101' }])

    const result = await buildDouyinAriByRatePlanIds({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-25',
    })

    expect(result.summary).toEqual({
      ratePlanIds: ['RATE_001'],
      startDate: '2026-03-24',
      endDate: '2026-03-25',
      total: 2,
    })
    expect(result.aris).toEqual([
      {
        account_id: 'ACC_001',
        hotel_id: 'HOTEL_001',
        room_id: 'ROOM_001',
        rate_plan_id: 'RATE_001',
        timerange: {
          start: '2026-03-24',
          end: '2026-03-24',
        },
        currency: 'CNY',
        inventory: 2,
        available: true,
        original_amount: 28800,
        amount_before_tax: 28800,
      },
      {
        account_id: 'ACC_001',
        hotel_id: 'HOTEL_001',
        room_id: 'ROOM_001',
        rate_plan_id: 'RATE_001',
        timerange: {
          start: '2026-03-25',
          end: '2026-03-25',
        },
        currency: 'CNY',
        inventory: 1,
        available: true,
        original_amount: 28800,
        amount_before_tax: 28800,
      },
    ])
  })

  test('房型关闭时应返回不可售库存 0', async () => {
    findPhysicalRoomsByRatePlanIds.mockResolvedValue([
      {
        room_id: 'ROOM_002',
        matched_rate_plan_id: 'RATE_002',
        raw_payload: {
          hotel_id: 'HOTEL_002',
        },
      },
    ])
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('LOCAL_ROOM_002')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'LOCAL_ROOM_002',
        type_name: '关闭房型',
        base_price: 398,
        is_closed: true,
      }],
    })
    getAvailableRooms.mockResolvedValue([{ room_number: '201' }])

    const result = await buildDouyinAriByRatePlanIds({
      ratePlanIds: ['RATE_002'],
      startDate: '2026-03-24',
      endDate: '2026-03-24',
    })

    expect(result.aris[0]).toMatchObject({
      inventory: 0,
      available: false,
      original_amount: 39800,
    })
  })

  test('房量房态推送应调用 stock/save', async () => {
    findPhysicalRoomsByRatePlanIds.mockResolvedValue([
      {
        room_id: 'ROOM_003',
        matched_rate_plan_id: 'RATE_003',
        raw_payload: {
          hotel_id: 'HOTEL_003',
        },
      },
    ])
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('LOCAL_ROOM_003')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'LOCAL_ROOM_003',
        type_name: '房型三',
        base_price: 258,
        is_closed: false,
      }],
    })
    getAvailableRooms.mockResolvedValue([{ room_number: '301' }])
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    const result = await pushDouyinHotelStock({
      ratePlanIds: ['RATE_003'],
      startDate: '2026-03-24',
      endDate: '2026-03-24',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/hotel/stock/save/',
      withAccountId: true,
      data: {
        account_id: 'ACC_001',
        aris: [{
          hotel_id: 'HOTEL_003',
          room_id: 'ROOM_003',
          rate_plan_id: 'RATE_003',
          timerange: {
            start: '2026-03-24',
            end: '2026-03-24',
          },
          inventory: 1,
          available: true,
        }],
      },
    })
    expect(result.payload.account_id).toBe('ACC_001')
  })

  test('房价推送应调用 price/save', async () => {
    findPhysicalRoomsByRatePlanIds.mockResolvedValue([
      {
        room_id: 'ROOM_004',
        matched_rate_plan_id: 'RATE_004',
        raw_payload: {
          hotel_id: 'HOTEL_004',
        },
      },
    ])
    findLocalRoomTypeByDouyinRoomId.mockResolvedValue('LOCAL_ROOM_004')
    postgreDB.query.mockResolvedValue({
      rows: [{
        type_code: 'LOCAL_ROOM_004',
        type_name: '房型四',
        base_price: 328,
        is_closed: false,
      }],
    })
    getAvailableRooms.mockResolvedValue([{ room_number: '401' }, { room_number: '402' }])
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    await pushDouyinHotelPrice({
      ratePlanIds: ['RATE_004'],
      startDate: '2026-03-24',
      endDate: '2026-03-24',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/hotel/price/save/',
      withAccountId: true,
      data: {
        account_id: 'ACC_001',
        aris: [{
          hotel_id: 'HOTEL_004',
          room_id: 'ROOM_004',
          rate_plan_id: 'RATE_004',
          timerange: {
            start: '2026-03-24',
            end: '2026-03-24',
          },
          currency: 'CNY',
          original_amount: 32800,
          amount_before_tax: 32800,
          available: true,
          inventory: 2,
        }],
      },
    })
  })

  test('价量态变更通知应调用 ari/notify', async () => {
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
      },
    })

    await notifyDouyinAriRefresh({
      ratePlanIds: ['RATE_005'],
      startDate: '2026-03-24',
      endDate: '2026-03-30',
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/hotel/ari/notify/',
      withAccountId: false,
      data: {
        account_id: 'ACC_001',
        date_range: {
          start: '2026-03-24',
          end: '2026-03-30',
        },
        notify_scene: [1, 2],
        rate_plan_ids: ['RATE_005'],
      },
    })
  })

  test('build payload helpers 应输出预期结构', () => {
    const aris = [{
      account_id: 'ACC_001',
      hotel_id: 'HOTEL_006',
      room_id: 'ROOM_006',
      rate_plan_id: 'RATE_006',
      timerange: {
        start: '2026-03-24',
        end: '2026-03-24',
      },
      currency: 'CNY',
      inventory: 3,
      available: true,
      original_amount: 26800,
      amount_before_tax: 26800,
    }]

    expect(buildDouyinStockPayload(aris)).toEqual({
      account_id: 'ACC_001',
      aris: [{
        hotel_id: 'HOTEL_006',
        room_id: 'ROOM_006',
        rate_plan_id: 'RATE_006',
        timerange: {
          start: '2026-03-24',
          end: '2026-03-24',
        },
        inventory: 3,
        available: true,
      }],
    })

    expect(buildDouyinPricePayload(aris)).toEqual({
      account_id: 'ACC_001',
      aris: [{
        hotel_id: 'HOTEL_006',
        room_id: 'ROOM_006',
        rate_plan_id: 'RATE_006',
        timerange: {
          start: '2026-03-24',
          end: '2026-03-24',
        },
        currency: 'CNY',
        original_amount: 26800,
        amount_before_tax: 26800,
        available: true,
        inventory: 3,
      }],
    })

    expect(buildDouyinNotifyPayload({
      ratePlanIds: ['RATE_006'],
      startDate: '2026-03-24',
      endDate: '2026-03-25',
    })).toEqual({
      account_id: 'ACC_001',
      date_range: {
        start: '2026-03-24',
        end: '2026-03-25',
      },
      notify_scene: [1, 2],
      rate_plan_ids: ['RATE_006'],
    })
  })
})
