"use strict";

const mockSetRuntimeOptions = jest.fn();
const mockStockSave = jest.fn();
const mockPriceSave = jest.fn();
const mockRateplanSave = jest.fn();
const mockSdkConstructor = jest.fn(() => ({
  setRuntimeOptions: mockSetRuntimeOptions,
  stockSave: mockStockSave,
  priceSave: mockPriceSave,
  rateplanSave: mockRateplanSave
}));
const mockCredentialGetClientToken = jest.fn();
const mockCredentialConstructor = jest.fn(() => ({
  getClientToken: mockCredentialGetClientToken
}));

jest.mock('@open-dy/open_api_sdk', () => {
  class RuntimeOptions {
    /**
     * 创建 SDK 运行时配置的测试替身。
     * @param {object} config 运行时配置
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class StockSaveRequest {
    /**
     * 创建库存请求的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class StockSaveRequestArisItem {
    /**
     * 创建库存明细的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class StockSaveRequestArisItemTimerange {
    /**
     * 创建库存时间范围的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class PriceSaveRequest {
    /**
     * 创建价格请求的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class PriceSaveRequestArisItem {
    /**
     * 创建价格明细的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class PriceSaveRequestArisItemTimerange {
    /**
     * 创建价格时间范围的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  class RateplanSaveRequest {
    /**
     * 创建售卖房型静态信息请求的测试替身。
     * @param {object} config 请求参数
     * @returns {void}
     * @throws {Error} 无
     */
    constructor(config) {
      Object.assign(this, config);
    }
  }

  return {
    __esModule: true,
    default: mockSdkConstructor,
    RuntimeOptions,
    StockSaveRequest,
    StockSaveRequestArisItem,
    StockSaveRequestArisItemTimerange,
    PriceSaveRequest,
    PriceSaveRequestArisItem,
    PriceSaveRequestArisItemTimerange,
    RateplanSaveRequest
  };
});

jest.mock('@open-dy/open_api_credential', () => ({
  __esModule: true,
  default: mockCredentialConstructor
}));

/**
 * 重新加载待测模块，避免客户端缓存影响断言。
 * @returns {{ sendSyncRequest: Function }} 客户端模块
 * @throws {Error} 模块加载失败时抛出原始异常
 */
function loadDouyinClientModule() {
  jest.resetModules();
  return require('../modules/ota/douyin/client');
}

beforeEach(() => {
  mockSetRuntimeOptions.mockClear();
  mockStockSave.mockReset();
  mockPriceSave.mockReset();
  mockRateplanSave.mockReset();
  mockSdkConstructor.mockClear();
  mockCredentialGetClientToken.mockReset();
  mockCredentialConstructor.mockClear();
});

describe('抖音 SDK 出站客户端', () => {
  test('库存同步任务会调用 stockSave 并按单日展开 ARI', async () => {
    mockStockSave.mockResolvedValue({
      data: {
        gwErrorCode: 0,
        gwDescription: 'success'
      },
      extra: {
        logid: 'log-stock-001'
      }
    });

    const { sendSyncRequest } = loadDouyinClientModule();
    const result = await sendSyncRequest(
      {
        app_id: 'app-id',
        app_secret: 'app-secret',
        account_id: 'account-1',
        hotel_id: 'hotel-1',
        access_token: 'manual-token',
        mock_mode: 'none'
      },
      {
        id: 1,
        sync_type: 'inventory',
        request_payload: {
          items: [
            {
              stay_date: '2026-03-10',
              room_id: 'room-1',
              rate_plan_id: 'rate-1',
              available_rooms: 3
            },
            {
              stay_date: '2026-03-11',
              room_id: 'room-1',
              rate_plan_id: 'rate-1',
              available_rooms: 0
            }
          ]
        }
      }
    );

    expect(mockSdkConstructor).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeOptions).toHaveBeenCalledTimes(1);
    expect(mockStockSave).toHaveBeenCalledTimes(1);

    const stockRequest = mockStockSave.mock.calls[0][0];
    expect(stockRequest.accountId).toBe('account-1');
    expect(stockRequest.hotelId).toBe('hotel-1');
    expect(stockRequest.accessToken).toBe('manual-token');
    expect(stockRequest.aris).toHaveLength(2);
    expect(stockRequest.aris[0]).toMatchObject({
      roomId: 'room-1',
      ratePlanId: 'rate-1',
      inventory: '3',
      available: true
    });
    expect(stockRequest.aris[0].timerange).toMatchObject({
      start: '2026-03-10',
      end: '2026-03-10'
    });
    expect(stockRequest.aris[1]).toMatchObject({
      inventory: '0',
      available: false
    });

    expect(result).toMatchObject({
      ok: true,
      mock: false,
      sdk_method: 'stockSave',
      endpoint: '/goodlife/v1/trip/hotel/stock/save/',
      logid: 'log-stock-001'
    });
  });

  test('价格同步任务在未配置 access token 时会先通过凭证 SDK 取 client_token', async () => {
    mockCredentialGetClientToken.mockResolvedValue({
      accessToken: 'sdk-token'
    });
    mockPriceSave.mockResolvedValue({
      data: {
        gwErrorCode: 0,
        gwDescription: 'success'
      },
      extra: {
        logid: 'log-price-001'
      }
    });

    const { sendSyncRequest } = loadDouyinClientModule();
    const result = await sendSyncRequest(
      {
        app_id: 'app-id',
        app_secret: 'app-secret',
        account_id: 'account-1',
        hotel_id: 'hotel-1',
        mock_mode: 'none'
      },
      {
        id: 2,
        sync_type: 'price',
        request_payload: {
          items: [
            {
              stay_date: '2026-03-10',
              room_id: 'room-2',
              rate_plan_id: 'rate-2',
              price: 188
            }
          ]
        }
      }
    );

    expect(mockCredentialConstructor).toHaveBeenCalledTimes(1);
    expect(mockCredentialGetClientToken).toHaveBeenCalledTimes(1);
    expect(mockPriceSave).toHaveBeenCalledTimes(1);

    const priceRequest = mockPriceSave.mock.calls[0][0];
    expect(priceRequest.accessToken).toBe('sdk-token');
    expect(priceRequest.aris[0]).toMatchObject({
      roomId: 'room-2',
      ratePlanId: 'rate-2',
      retailAmount: '188.00',
      originalAmount: '188.00',
      amountBeforeTax: '188.00'
    });

    expect(result).toMatchObject({
      ok: true,
      mock: false,
      sdk_method: 'priceSave',
      endpoint: '/goodlife/v1/trip/hotel/price/save/',
      logid: 'log-price-001'
    });
  });

  test('价格计划缺失时直接返回业务异常，不会调用 SDK', async () => {
    const { sendSyncRequest } = loadDouyinClientModule();

    await expect(sendSyncRequest(
      {
        app_id: 'app-id',
        app_secret: 'app-secret',
        account_id: 'account-1',
        hotel_id: 'hotel-1',
        access_token: 'manual-token',
        mock_mode: 'none'
      },
      {
        id: 3,
        sync_type: 'inventory',
        request_payload: {
          items: [
            {
              stay_date: '2026-03-10',
              room_id: 'room-1',
              available_rooms: 1
            }
          ]
        }
      }
    )).rejects.toMatchObject({
      code: 'DOUYIN_RATE_PLAN_ID_REQUIRED',
      statusCode: 409
    });

    expect(mockStockSave).not.toHaveBeenCalled();
  });

  test('售卖房型静态信息同步任务会调用 rateplanSave', async () => {
    mockRateplanSave.mockResolvedValue({
      data: {
        gwErrorCode: 0,
        gwDescription: 'success'
      },
      extra: {
        logid: 'log-rateplan-001'
      }
    });

    const { sendSyncRequest } = loadDouyinClientModule();
    const result = await sendSyncRequest(
      {
        app_id: 'app-id',
        app_secret: 'app-secret',
        account_id: 'account-1',
        hotel_id: 'hotel-1',
        access_token: 'manual-token',
        mock_mode: 'none'
      },
      {
        id: 6,
        sync_type: 'rateplan',
        request_payload: {
          rooms: [
            {
              room_id: 'room-3',
              rate_plans: [
                {
                  out_rate_plan_id: 'rp-out-1',
                  rate_plan_name: '标准价',
                  active: true,
                  policy: 1
                }
              ]
            }
          ]
        }
      }
    );

    expect(mockRateplanSave).toHaveBeenCalledTimes(1);
    const ratePlanRequest = mockRateplanSave.mock.calls[0][0];
    expect(ratePlanRequest.accountId).toBe('account-1');
    expect(ratePlanRequest.ratePlan.hotelId).toBe('hotel-1');
    expect(ratePlanRequest.ratePlan.rooms[0]).toMatchObject({
      roomId: 'room-3'
    });
    expect(ratePlanRequest.ratePlan.rooms[0].ratePlans[0]).toMatchObject({
      outRatePlanId: 'rp-out-1',
      ratePlanName: '标准价',
      active: true,
      policy: 1
    });

    expect(result).toMatchObject({
      ok: true,
      mock: false,
      sdk_method: 'rateplanSave',
      endpoint: '/goodlife/v1/trip/hotel/rateplan/save/',
      logid: 'log-rateplan-001'
    });
  });

  test('OpenAPI 返回非 0 业务码时，按失败处理并抛出业务异常', async () => {
    mockStockSave.mockResolvedValue({
      data: {
        gwErrorCode: 40013,
        gwDescription: 'invalid parameter'
      }
    });

    const { sendSyncRequest } = loadDouyinClientModule();

    await expect(sendSyncRequest(
      {
        app_id: 'app-id',
        app_secret: 'app-secret',
        account_id: 'account-1',
        hotel_id: 'hotel-1',
        access_token: 'manual-token',
        mock_mode: 'none'
      },
      {
        id: 4,
        sync_type: 'inventory',
        request_payload: {
          items: [
            {
              stay_date: '2026-03-10',
              room_id: 'room-1',
              rate_plan_id: 'rate-1',
              available_rooms: 2
            }
          ]
        }
      }
    )).rejects.toMatchObject({
      code: 'DOUYIN_OUTBOUND_BIZ_ERROR',
      statusCode: 502,
      details: {
        openapi_error_code: 40013
      }
    });

    expect(mockStockSave).toHaveBeenCalledTimes(1);
  });

  test('OpenAPI 在 extra.error_code 返回非 0 时同样按失败处理', async () => {
    mockPriceSave.mockResolvedValue({
      data: {
        error_code: 0
      },
      extra: {
        error_code: 50001,
        sub_description: 'service busy'
      }
    });

    const { sendSyncRequest } = loadDouyinClientModule();

    await expect(sendSyncRequest(
      {
        app_id: 'app-id',
        app_secret: 'app-secret',
        account_id: 'account-1',
        hotel_id: 'hotel-1',
        access_token: 'manual-token',
        mock_mode: 'none'
      },
      {
        id: 5,
        sync_type: 'price',
        request_payload: {
          items: [
            {
              stay_date: '2026-03-10',
              room_id: 'room-1',
              rate_plan_id: 'rate-1',
              price: 188
            }
          ]
        }
      }
    )).rejects.toMatchObject({
      code: 'DOUYIN_OUTBOUND_BIZ_ERROR',
      statusCode: 502,
      details: {
        openapi_error_code: 50001,
        openapi_error_message: 'service busy'
      }
    });

    expect(mockPriceSave).toHaveBeenCalledTimes(1);
  });
});
