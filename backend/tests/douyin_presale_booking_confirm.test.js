jest.mock('../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'DY_ACCOUNT_001',
    openApiBaseUrl: 'https://open.douyin.test'
  }
}));

jest.mock('../modules/douyin/token/token.service', () => ({
  getToken: jest.fn()
}));

jest.mock('../modules/douyin/presale-order/bookingOrder.repository', () => ({
  findByLocalOrderId: jest.fn(),
  markConfirmFailed: jest.fn(),
  markConfirmSucceeded: jest.fn()
}));

const tokenService = require('../modules/douyin/token/token.service');
const repository = require('../modules/douyin/presale-order/bookingOrder.repository');
const { confirmBooking } = require('../modules/douyin/presale-order/bookingConfirm.service');

describe('抖音预售券预约确认接单', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenService.getToken.mockResolvedValue('TOKEN_001');
    repository.findByLocalOrderId.mockResolvedValue({
      order_id: 'DYBK_001',
      ota_order_id: 'DY_BOOKING_001',
      confirm_number: 'DYBK_001',
      confirm_status: 'PENDING'
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('确认接单成功时传预约订单号并保存抖音 logid', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ extra: { error_code: 0, logid: 'CONFIRM_LOG_001' }, data: { error_code: 0 } })
    });

    const result = await confirmBooking('DYBK_001', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://open.douyin.test/goodlife/v1/trip/trade/hotel/order/confirm/',
      expect.objectContaining({
        headers: expect.objectContaining({
          'access-token': 'TOKEN_001',
          'Rpc-Transit-Life-Account': 'DY_ACCOUNT_001'
        }),
        body: JSON.stringify({
          order_id: 'DY_BOOKING_001',
          confirm_result: { confirm_result: 1, confirm_number: 'DYBK_001' }
        })
      })
    );
    expect(repository.markConfirmSucceeded).toHaveBeenCalledWith('DYBK_001', expect.objectContaining({ logId: 'CONFIRM_LOG_001' }));
    expect(result).toEqual({ duplicate: false, logId: 'CONFIRM_LOG_001' });
  });

  test('抖音业务失败时保留 logid 和失败原因', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ extra: { error_code: 2100005, description: '参数不合法', logid: 'CONFIRM_LOG_002' }, data: {} })
    });

    await expect(confirmBooking('DYBK_001', { fetchImpl })).rejects.toMatchObject({
      message: '参数不合法',
      douyinLogId: 'CONFIRM_LOG_002'
    });
    expect(repository.markConfirmFailed).toHaveBeenCalledWith('DYBK_001', expect.objectContaining({
      logId: 'CONFIRM_LOG_002',
      errorMessage: '参数不合法'
    }));
  });
});
