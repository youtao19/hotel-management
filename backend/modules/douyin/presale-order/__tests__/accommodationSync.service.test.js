jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: { openApiBaseUrl: 'https://open.douyin.test' }
}));

jest.mock('../accommodationSync.repository', () => ({
  findBookingByLocalOrderId: jest.fn(),
  findSyncByBookingOrderId: jest.fn(),
  startSyncAttempt: jest.fn(),
  markSyncSucceeded: jest.fn(),
  markSyncFailed: jest.fn()
}));

const repository = require('../accommodationSync.repository');
const {
  ACCOMMODATION_STATUS,
  AUDIT_NOTIFY_ENDPOINT,
  buildAccommodationPayload,
  syncAccommodationStatus
} = require('../accommodationSync.service');

describe('抖音预售券预约履约同步', () => {
  const booking = { id: 7, order_id: 'DYBK_LOCAL_001', ota_order_id: 'DY_BOOKING_001' };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBookingByLocalOrderId.mockResolvedValue(booking);
    repository.findSyncByBookingOrderId.mockResolvedValue(null);
    repository.startSyncAttempt.mockResolvedValue({ id: 31, sync_status: 'PENDING' });
  });

  test('按预约单标识构建入住通知', () => {
    expect(buildAccommodationPayload(booking, ACCOMMODATION_STATUS.CHECKED_IN)).toEqual({
      order_id: 'DY_BOOKING_001',
      order_out_id: 'DYBK_LOCAL_001',
      accommodation_status: 1
    });
  });

  test('抖音确认入住后保存 logid 和成功状态', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ extra: { error_code: 0, logid: 'DY_FULFILLMENT_LOG_001' } })
    });
    repository.markSyncSucceeded.mockResolvedValue({ id: 31, sync_status: 'SUCCEEDED', douyin_log_id: 'DY_FULFILLMENT_LOG_001' });

    const result = await syncAccommodationStatus('DYBK_LOCAL_001', ACCOMMODATION_STATUS.CHECKED_IN, {
      fetchImpl,
      tokenService: { getToken: jest.fn().mockResolvedValue('token-test') }
    });

    expect(fetchImpl).toHaveBeenCalledWith(`https://open.douyin.test${AUDIT_NOTIFY_ENDPOINT}`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'access-token': 'token-test' }),
      body: JSON.stringify(buildAccommodationPayload(booking, ACCOMMODATION_STATUS.CHECKED_IN))
    }));
    expect(repository.markSyncSucceeded).toHaveBeenCalledWith(31, 'DY_FULFILLMENT_LOG_001', expect.any(Object));
    expect(result.success).toBe(true);
  });

  test('HTTP 200 的抖音业务失败也保存为失败记录', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ extra: { error_code: 2119002, sub_description: '系统繁忙', logid: 'DY_FULFILLMENT_LOG_002' } })
    });
    repository.markSyncFailed.mockResolvedValue({ id: 31, sync_status: 'FAILED', douyin_log_id: 'DY_FULFILLMENT_LOG_002' });

    const result = await syncAccommodationStatus('DYBK_LOCAL_001', ACCOMMODATION_STATUS.CHECKED_OUT, {
      fetchImpl,
      tokenService: { getToken: jest.fn().mockResolvedValue('token-test') }
    });

    expect(repository.markSyncFailed).toHaveBeenCalledWith(31, expect.objectContaining({
      errorCode: 2119002,
      errorDescription: '系统繁忙',
      logId: 'DY_FULFILLMENT_LOG_002'
    }));
    expect(result.success).toBe(false);
  });

  test('普通订单没有预售券预约映射时不调用抖音', async () => {
    repository.findBookingByLocalOrderId.mockResolvedValue(null);
    const fetchImpl = jest.fn();

    const result = await syncAccommodationStatus('LOCAL_ORDER_001', ACCOMMODATION_STATUS.CHECKED_IN, { fetchImpl });

    expect(result).toEqual({ eligible: false, reason: 'NOT_DOUYIN_PRESALE_BOOKING' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
