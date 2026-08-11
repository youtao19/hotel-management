jest.mock('../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'CURRENT_ACCOUNT',
    openApiBaseUrl: 'https://open.douyin.test'
  }
}));

jest.mock('../modules/douyin/token/token.service', () => ({
  getToken: jest.fn()
}));

jest.mock('../modules/douyin/external/callbackLog.service', () => ({
  appendLog: jest.fn()
}));

jest.mock('../modules/douyin/availability/availability.repository', () => ({
  findSyncedRatePlansByRoomType: jest.fn(),
  findSyncedRatePlanByLocalId: jest.fn(),
  getInventoryRowsByRoomType: jest.fn()
}));

const douyinTokenService = require('../modules/douyin/token/token.service');
const callbackLogService = require('../modules/douyin/external/callbackLog.service');
const availabilityRepository = require('../modules/douyin/availability/availability.repository');
const { syncRoomTypeStock } = require('../modules/douyin/availability/stockPush.service');

const originalFetch = global.fetch;

/** 构造满足库存推送所需字段的本地套餐映射。 */
function buildRatePlan(ratePlanId, localRatePlanId) {
  return {
    rate_plan_id: ratePlanId,
    local_rate_plan_id: localRatePlanId,
    room_type_code: 'bo_ye_shuang',
    rate_plan_status: 1,
    room_type_closed: false
  };
}

describe('抖音自动房量房态推送', () => {
  beforeEach(() => {
    douyinTokenService.getToken.mockReset().mockResolvedValue('DOUYIN_TOKEN');
    callbackLogService.appendLog.mockReset().mockResolvedValue(true);
    availabilityRepository.findSyncedRatePlansByRoomType.mockReset();
    availabilityRepository.getInventoryRowsByRoomType.mockReset().mockResolvedValue([]);
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  /** 验证同房型某套餐失败时，后续当前账号套餐仍会继续推送。 */
  test('过滤账号并隔离单个套餐失败', async () => {
    availabilityRepository.findSyncedRatePlansByRoomType.mockResolvedValue([
      buildRatePlan('CURRENT_PLAN_1', 10),
      buildRatePlan('CURRENT_PLAN_2', 11)
    ]);
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { save_result: [{ rate_plan_id: 'CURRENT_PLAN_1', code: -1, message: '套餐临时不可提交' }] },
          extra: { error_code: 0, description: 'success', logid: 'FAILED_LOG_ID' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { save_result: [{ rate_plan_id: 'CURRENT_PLAN_2', code: 0, message: 'success' }] },
          extra: { error_code: 0, description: 'success', logid: 'SUCCESS_LOG_ID' }
        })
      });

    await syncRoomTypeStock('bo_ye_shuang', '2026-08-11', '2026-08-11', 'room_status');

    expect(availabilityRepository.findSyncedRatePlansByRoomType).toHaveBeenCalledWith('bo_ye_shuang', 'CURRENT_ACCOUNT');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(callbackLogService.appendLog).toHaveBeenCalledWith(expect.objectContaining({
      type: 'stock_push',
      stage: 'error',
      logId: 'FAILED_LOG_ID',
      ratePlanId: 'CURRENT_PLAN_1',
      errorCode: -1,
      error: '套餐临时不可提交',
      saveResult: { rate_plan_id: 'CURRENT_PLAN_1', code: -1, message: '套餐临时不可提交' }
    }));
    expect(console.error).toHaveBeenCalledWith('[Douyin Stock Push] 自动推送失败:', expect.objectContaining({
      localRatePlanId: 10,
      ratePlanId: 'CURRENT_PLAN_1',
      message: '套餐临时不可提交',
      douyinLogId: 'FAILED_LOG_ID'
    }));
  });
});
