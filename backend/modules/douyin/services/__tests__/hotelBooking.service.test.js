const {
  findByOtaOrderId,
  createDouyinOrder,
  upsertDouyinBookingFailure,
  updateDouyinOrderByOtaOrderId,
} = require('../../repositories/douyinOrder.repository')
const { handleDouyinHotelBooking } = require('../hotelBooking.service')

jest.mock('../../repositories/douyinOrder.repository', () => ({
  findByOtaOrderId: jest.fn(),
  createDouyinOrder: jest.fn(),
  upsertDouyinBookingFailure: jest.fn(),
  updateDouyinOrderByOtaOrderId: jest.fn(),
}))

describe('handleDouyinHotelBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('缺少关键房型字段时返回抖音房型错误码', async () => {
    upsertDouyinBookingFailure.mockResolvedValue({
      ota_order_id: 'DY_001',
      booking_stage: 'room_mapping_failed',
    })

    await expect(handleDouyinHotelBooking({
      order_id: 'DY_001',
      hotel_id: 'HOTEL_001',
      biz_type: 2021,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 10000,
      daily_rates: [
        {
          original_amount: 10000,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
      contact_info: { name: '王五', phone: '13700000000' },
    })).rejects.toMatchObject({
      douyinErrorCode: 1,
      douyinDescription: '房型不存在/失效',
    })

    expect(upsertDouyinBookingFailure).toHaveBeenCalledWith(expect.objectContaining({
      otaOrderId: 'DY_001',
      bookingStage: 'room_mapping_failed',
      bookingErrorCode: 1,
    }))
  })

  test('日期非法时返回日期错误码', async () => {
    upsertDouyinBookingFailure.mockResolvedValue({
      ota_order_id: 'DY_001',
      booking_stage: 'payload_invalid',
    })

    await expect(handleDouyinHotelBooking({
      order_id: 'DY_001',
      hotel_id: 'HOTEL_001',
      room_id: 'ROOM_001',
      rate_plan_id: 'RATE_001',
      biz_type: 2021,
      check_in_date: '2026/03/24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 10000,
      daily_rates: [
        {
          original_amount: 10000,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
      contact_info: { name: '王五', phone: '13700000000' },
    })).rejects.toMatchObject({
      douyinErrorCode: 5,
      douyinDescription: '日期格式错误',
    })

    expect(upsertDouyinBookingFailure).toHaveBeenCalledWith(expect.objectContaining({
      otaOrderId: 'DY_001',
      bookingStage: 'payload_invalid',
      bookingErrorCode: 5,
    }))
  })

  test('无可用房时返回入住时期内已满错误码', async () => {
    findByOtaOrderId.mockResolvedValue(null)
    createDouyinOrder.mockRejectedValue(new Error('No available room for mapped room type'))
    upsertDouyinBookingFailure.mockResolvedValue({
      ota_order_id: 'DY_001',
      booking_stage: 'inventory_failed',
    })

    await expect(handleDouyinHotelBooking({
      order_id: 'DY_001',
      hotel_id: 'HOTEL_001',
      room_id: 'ROOM_001',
      rate_plan_id: 'RATE_001',
      biz_type: 2021,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 10000,
      daily_rates: [
        {
          original_amount: 10000,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
      contact_info: { name: '王五', phone: '13700000000' },
    })).rejects.toMatchObject({
      douyinErrorCode: 4,
      douyinDescription: '入住时期内已满',
    })

    expect(upsertDouyinBookingFailure).toHaveBeenCalledWith(expect.objectContaining({
      otaOrderId: 'DY_001',
      bookingStage: 'inventory_failed',
      bookingErrorCode: 4,
    }))
  })

  test('新订单应创建并落库存储扩展字段', async () => {
    findByOtaOrderId.mockResolvedValue(null)
    createDouyinOrder.mockImplementation(async (payload) => ({
      ota_order_id: payload.otaOrderId,
      hotel_id: payload.hotelId,
      rate_plan_id: payload.ratePlanId,
    }))

    const result = await handleDouyinHotelBooking({
      order_id: 'DY_001',
      source_order_id: 'PRE_001',
      hotel_id: 'HOTEL_001',
      room_id: 'ROOM_001',
      rate_plan_id: 'RATE_001',
      biz_type: 2021,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-26',
      number_of_units: 1,
      number_of_guests: 2,
      total_amount: 59800,
      daily_rates: [
        {
          original_amount: 29900,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
        {
          original_amount: 29900,
          period_start_date: '2026-03-25',
          period_end_date: '2026-03-26',
        },
      ],
      contact_info: { name: '王五', phone: '13700000000' },
      occupancies: [{ name: '王五', phone: '13700000000' }],
      remark_from_douyin: '抖音备注',
      remark_from_guest: '客人备注',
    }, {
      douyinLogId: 'LOGID_001',
    })

    expect(createDouyinOrder).toHaveBeenCalledWith(expect.objectContaining({
      otaOrderId: 'DY_001',
      douyinLogId: 'LOGID_001',
      sourceOrderId: 'PRE_001',
      hotelId: 'HOTEL_001',
      roomId: 'ROOM_001',
      ratePlanId: 'RATE_001',
      amount: 598,
      roomPrice: {
        '2026-03-24': 299,
        '2026-03-25': 299,
      },
      remarkFromDouyin: '抖音备注',
      remarkFromGuest: '客人备注',
    }))

    expect(result).toEqual({
      action: 'created',
      order: {
        ota_order_id: 'DY_001',
        hotel_id: 'HOTEL_001',
        rate_plan_id: 'RATE_001',
      },
    })
  })

  test('重复订单应走更新分支且不报重复提交错误', async () => {
    findByOtaOrderId.mockResolvedValue({ ota_order_id: 'DY_001' })
    updateDouyinOrderByOtaOrderId.mockResolvedValue({
      ota_order_id: 'DY_001',
      hotel_id: 'HOTEL_001',
    })

    const result = await handleDouyinHotelBooking({
      order_id: 'DY_001',
      hotel_id: 'HOTEL_001',
      room_id: 'ROOM_001',
      rate_plan_id: 'RATE_001',
      biz_type: 2021,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 10000,
      daily_rates: [
        {
          original_amount: 10000,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
      contact_info: { name: '王五', phone: '13700000000' },
    }, {
      douyinLogId: 'LOGID_002',
    })

    expect(updateDouyinOrderByOtaOrderId).toHaveBeenCalledWith(
      'DY_001',
      expect.objectContaining({
        otaOrderId: 'DY_001',
        douyinLogId: 'LOGID_002',
      })
    )
    expect(result.action).toBe('updated')
  })

  test('系统写入失败时应落 system_create_failed', async () => {
    findByOtaOrderId.mockResolvedValue(null)
    createDouyinOrder.mockRejectedValue(new Error('create douyin order failed'))
    upsertDouyinBookingFailure.mockResolvedValue({
      ota_order_id: 'DY_009',
      booking_stage: 'system_create_failed',
    })

    await expect(handleDouyinHotelBooking({
      order_id: 'DY_009',
      hotel_id: 'HOTEL_009',
      room_id: 'ROOM_009',
      rate_plan_id: 'RATE_009',
      biz_type: 2021,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      total_amount: 10000,
      daily_rates: [
        {
          original_amount: 10000,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
      contact_info: { name: '王五', phone: '13700000000' },
    }, {
      douyinLogId: 'LOGID_009',
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '其他异常',
    })

    expect(upsertDouyinBookingFailure).toHaveBeenCalledWith(expect.objectContaining({
      otaOrderId: 'DY_009',
      bookingStage: 'system_create_failed',
      bookingErrorCode: 13,
      douyinLogId: 'LOGID_009',
    }))
  })
})
