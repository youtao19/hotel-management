const { mapDouyinBookingPayload } = require('../booking.mapper')

describe('mapDouyinBookingPayload', () => {
  test('应正确映射官方创单字段并将分转换为元', () => {
    const payload = {
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
      amount_before_tax: 55000,
      currency: 'CNY',
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
      occupancies: [
        {
          name: '王五',
          phone: '13700000000',
        },
      ],
      contact_info: {
        name: '王五',
        phone: '13700000000',
      },
      remark_from_douyin: '尽量安排安静房间',
      remark_from_guest: '晚到',
      member_info: {
        member_level: 1,
      },
    }

    const result = mapDouyinBookingPayload(payload)

    expect(result).toMatchObject({
      otaOrderId: 'DY_001',
      sourceOrderId: 'PRE_001',
      hotelId: 'HOTEL_001',
      roomId: 'ROOM_001',
      ratePlanId: 'RATE_001',
      bizType: 2021,
      checkInDate: '2026-03-24',
      checkOutDate: '2026-03-26',
      roomCount: 1,
      numberOfGuests: 2,
      amount: 598,
      amountBeforeTax: 550,
      currency: 'CNY',
      guestName: '王五',
      guestMobile: '13700000000',
      contactName: '王五',
      contactMobile: '13700000000',
      remarkFromDouyin: '尽量安排安静房间',
      remarkFromGuest: '晚到',
    })

    expect(result.roomPrice).toEqual({
      '2026-03-24': 299,
      '2026-03-25': 299,
    })
    expect(result.dailyRates).toHaveLength(2)
    expect(result.occupancies).toHaveLength(1)
    expect(result.memberInfo).toEqual({ member_level: 1 })
  })

  test('应兼容旧 mock 金额字段并保留非明文手机号原值', () => {
    const result = mapDouyinBookingPayload({
      order_id: 'DY_002',
      hotel_id: 'HOTEL_002',
      room_id: 'ROOM_002',
      rate_plan_id: 'RATE_002',
      biz_type: 2021,
      check_in_date: '2026-03-24',
      check_out_date: '2026-03-25',
      number_of_units: 1,
      number_of_guests: 1,
      amount: 598,
      contact_info: {
        name: '张三',
        phone: 'ENCRYPTED_PHONE',
      },
      daily_rates: [
        {
          original_amount: 59800,
          period_start_date: '2026-03-24',
          period_end_date: '2026-03-25',
        },
      ],
    })

    expect(result.amount).toBe(598)
    expect(result.contactMobileRaw).toBe('ENCRYPTED_PHONE')
    expect(result.contactMobile).toBe('')
    expect(result.guestName).toBe('张三')
  })
})
