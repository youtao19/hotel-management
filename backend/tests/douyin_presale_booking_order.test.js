jest.mock('../modules/douyin/presale-order/bookingOrder.repository', () => ({
  findByDouyinOrderId: jest.fn(),
  findPaidSourceOrder: jest.fn(),
  getClient: jest.fn(),
  insertBooking: jest.fn(),
  insertBookingOrderDays: jest.fn(),
  lockAvailableRooms: jest.fn()
}));

jest.mock('../modules/douyin/availability/availability.repository', () => ({
  findRatePlanByDouyinId: jest.fn()
}));

jest.mock('../modules/douyin/availability/bookableCheck.service', () => ({
  buildBookableCheckResponse: jest.fn()
}));

jest.mock('../modules/douyin/presale-order/presaleOrder.service', () => ({
  resolveContact: jest.fn(() => ({ name: '', phone: '' }))
}));

const repository = require('../modules/douyin/presale-order/bookingOrder.repository');
const availabilityRepository = require('../modules/douyin/availability/availability.repository');
const bookableCheckService = require('../modules/douyin/availability/bookableCheck.service');
const { createBooking } = require('../modules/douyin/presale-order/bookingOrder.service');

/** 构造符合抖音创建预约 SPI 的基础请求。 */
function buildPayload(overrides = {}) {
  return {
    order_id: 'DY_BOOKING_001',
    source_order_id: 'DY_PRESALE_001',
    rate_plan_id: 'DY_RATE_001',
    hotel_id: 'DY_HOTEL_001',
    room_id: 'DY_ROOM_001',
    biz_type: 2012,
    check_in_date: '2026-08-20',
    check_out_date: '2026-08-21',
    number_of_units: 1,
    number_of_guests: 1,
    total_amount: 39900,
    daily_rates: [{ period_start_date: '2026-08-20', period_end_date: '2026-08-21', original_amount: 39900 }],
    ...overrides
  };
}

describe('抖音预售券创建预约订单', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = { query: jest.fn(), release: jest.fn() };
    repository.getClient.mockResolvedValue(client);
    repository.findByDouyinOrderId.mockResolvedValue(null);
    repository.findPaidSourceOrder.mockResolvedValue({ id: 1, order_stage: 'PAID' });
    availabilityRepository.findRatePlanByDouyinId.mockResolvedValue({
      room_type_code: 'KING',
      douyin_room_id: 'DY_ROOM_001',
      hotel_id: 'DY_HOTEL_001'
    });
    bookableCheckService.buildBookableCheckResponse.mockResolvedValue({ error_code: 0 });
    repository.lockAvailableRooms.mockResolvedValue(['101']);
    repository.insertBooking.mockImplementation(async (_client, booking) => ({
      order_id: booking.localOrderId,
      ota_order_id: booking.douyinOrderId,
      confirm_number: booking.confirmNumber
    }));
  });

  test('创建 2012 预约单后返回异步接单信息并写入占房记录', async () => {
    const result = await createBooking(buildPayload(), { logId: 'SPI_LOG_001', accountId: 'DY_ACCOUNT_001' });

    expect(result).toEqual(expect.objectContaining({
      douyinOrderId: 'DY_BOOKING_001',
      duplicate: false,
      needsConfirmation: true
    }));
    expect(repository.insertBooking).toHaveBeenCalledWith(client, expect.objectContaining({
      sourceOrderId: 'DY_PRESALE_001',
      assignedRooms: ['101'],
      logId: 'SPI_LOG_001'
    }));
    expect(repository.insertBookingOrderDays).toHaveBeenCalledWith(client, expect.objectContaining({
      roomTypeCode: 'KING',
      assignedRooms: ['101']
    }));
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('加价预约未携带 pay_info 时保存待支付加价金额', async () => {
    await createBooking(buildPayload({
      daily_rates: [{ period_start_date: '2026-08-20', period_end_date: '2026-08-21', original_amount: 39900, daily_add_amount: 1200 }]
    }));

    expect(repository.insertBooking).toHaveBeenCalledWith(client, expect.objectContaining({
      addAmount: 1200,
      paymentStatus: 'PENDING',
      dailyRates: [expect.objectContaining({ dailyAddAmount: 1200 })]
    }));
  });

  test('来源预售券未支付时拒绝创建预约单', async () => {
    repository.findPaidSourceOrder.mockResolvedValue(null);

    await expect(createBooking(buildPayload())).rejects.toMatchObject({
      message: '来源预售券订单不存在或未支付',
      douyinErrorCode: 9
    });
    expect(repository.insertBooking).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  test('重复回调复用原预约订单且仍允许补发确认接单', async () => {
    repository.findByDouyinOrderId.mockResolvedValue({
      ota_order_id: 'DY_BOOKING_001',
      order_id: 'DYBK_EXISTING_001',
      confirm_number: 'DYBK_EXISTING_001',
      confirm_status: 'FAILED'
    });

    const result = await createBooking(buildPayload());

    expect(result).toEqual({
      douyinOrderId: 'DY_BOOKING_001',
      localOrderId: 'DYBK_EXISTING_001',
      confirmNumber: 'DYBK_EXISTING_001',
      duplicate: true,
      needsConfirmation: true
    });
    expect(repository.findPaidSourceOrder).not.toHaveBeenCalled();
    expect(repository.insertBooking).not.toHaveBeenCalled();
  });
});
