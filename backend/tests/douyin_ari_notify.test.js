const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');

process.env.DOUYIN_CLIENT_KEY = 'DY_CLIENT_TEST';
process.env.DOUYIN_CLIENT_SECRET = 'DY_SECRET_TEST';
process.env.DOUYIN_ACCOUNT_ID = 'DY_ACCOUNT_TEST';
process.env.DOUYIN_OPENAPI_BASE_URL = 'https://open.douyin.test';

jest.mock('../services/douyinTokenService', () => ({
  getToken: jest.fn()
}));

const { query } = require('../database/postgreDB/pg');
const douyinTokenService = require('../services/douyinTokenService');
const douyinAriNotifyRoute = require('../routes/douyinAriNotifyRoute');

const originalFetch = global.fetch;

async function readJsonLines(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/douyin/ari-notify', douyinAriNotifyRoute);
  return app;
}

async function cleanup() {
  await query("DELETE FROM ota_channel_mappings WHERE channel_item_id LIKE 'DY_ARI_%'");
  await query("DELETE FROM douyin_room_type_mapping WHERE douyin_room_id = 'DY_ROOM_ARI_001'");
  await query("DELETE FROM douyin_physical_rooms WHERE room_id = 'DY_ROOM_ARI_001'");
  await query("DELETE FROM rate_plans WHERE room_type_code = 'ARI_TEST'");
  await query("DELETE FROM room_types WHERE type_code = 'ARI_TEST'");
}

async function createRatePlan(mapping = null) {
  await query(
    `
      INSERT INTO room_types (type_code, type_name, base_price, description)
      VALUES ($1, $2, $3, $4)
    `,
    ['ARI_TEST', '价量态通知测试房型', 399, '抖音 ARI 通知测试']
  );

  const ratePlanResult = await query(
    `
      INSERT INTO rate_plans (room_type_code, name, base_price, status, sales_type, currency)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    ['ARI_TEST', '价量态通知测试套餐', 399, 1, 1, 'CNY']
  );
  const localRatePlanId = ratePlanResult.rows[0].id;

  if (mapping) {
    await query(
      `
        INSERT INTO ota_channel_mappings
          (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      ['RATE_PLAN', localRatePlanId, 'DOUYIN', mapping.ratePlanId, { hotel_id: mapping.hotelId || 'DY_HOTEL_ARI_001' }, 1]
    );

    await query(
      `
        INSERT INTO douyin_physical_rooms
          (account_id, room_id, room_name, status, raw_payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      ['DY_ACCOUNT_TEST', 'DY_ROOM_ARI_001', '抖音价量态通知房型', 1, { hotel_id: mapping.hotelId || 'DY_HOTEL_ARI_001' }]
    );

    await query(
      `
        INSERT INTO douyin_room_type_mapping (douyin_room_id, douyin_room_name, local_room_type)
        VALUES ($1, $2, $3)
      `,
      ['DY_ROOM_ARI_001', '抖音价量态通知房型', 'ARI_TEST']
    );
  }

  return localRatePlanId;
}

describe('抖音日历房价库变更增量通知', () => {
  const app = buildTestApp();
  let logFilePath;

  beforeEach(async () => {
    logFilePath = path.join(os.tmpdir(), `douyin-ari-logid-${process.pid}-${Date.now()}.jsonl`);
    process.env.DOUYIN_CALLBACK_LOG_FILE = logFilePath;
    await cleanup();
    douyinTokenService.getToken.mockReset();
    global.fetch = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    delete process.env.DOUYIN_CALLBACK_LOG_FILE;
    if (logFilePath) {
      await fs.rm(logFilePath, { force: true });
    }
    await cleanup();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('未同步抖音的本地套餐返回 400，且不调用抖音', async () => {
    const localRatePlanId = await createRatePlan();

    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: [localRatePlanId],
        startDate: '2099-01-01',
        endDate: '2099-01-02'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('尚未同步到抖音');
    expect(douyinTokenService.getToken).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([
    ['日期格式错误', { startDate: '2099/01/01', endDate: '2099-01-02' }, '日期格式必须为 YYYY-MM-DD'],
    ['结束日早于开始日', { startDate: '2099-01-03', endDate: '2099-01-02' }, '结束日期不能早于开始日期'],
    ['日期范围超过 365 天', { startDate: '2099-01-01', endDate: '2100-01-01' }, '日期范围不能超过 365 天']
  ])('%s 时返回 400', async (_caseName, dateRange, expectedMessage) => {
    const localRatePlanId = await createRatePlan({ ratePlanId: 'DY_ARI_RATE_001' });

    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: [localRatePlanId],
        ...dateRange
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(expectedMessage);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('localRatePlanIds 超过 50 个时返回 400', async () => {
    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: Array.from({ length: 51 }, (_item, index) => index + 1),
        startDate: '2099-01-01',
        endDate: '2099-01-02'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('每次最多通知 50 个售卖套餐');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('正常请求会调用抖音通知接口', async () => {
    const localRatePlanId = await createRatePlan({ ratePlanId: 'DY_ARI_RATE_001' });
    douyinTokenService.getToken.mockResolvedValue('TOKEN_ARI_001');
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          error_code: 0,
          description: ''
        },
        extra: {
          error_code: 0,
          description: '',
          logid: 'DY_ARI_LOG_001'
        }
      })
    });

    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: [localRatePlanId],
        startDate: '2099-01-01',
        endDate: '2099-01-02'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        notified: true,
        hotelIds: ['DY_HOTEL_ARI_001'],
        ratePlanIds: ['DY_ARI_RATE_001'],
        notifyScenes: [1, 2, 3, 4],
        dateRange: {
          start: '2099-01-01',
          end: '2099-01-02'
        },
        douyinLogId: 'DY_ARI_LOG_001'
      },
      message: '已通知抖音拉取价量态'
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://open.douyin.test/goodlife/v1/trip/hotel/ari/notify/',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'access-token': 'TOKEN_ARI_001'
        },
        body: JSON.stringify({
          account_id: 'DY_ACCOUNT_TEST',
          date_range: {
            start: '2099-01-01',
            end: '2099-01-02'
          },
          hotel_ids: ['DY_HOTEL_ARI_001'],
          notify_scene: [1, 2, 3, 4],
          rate_plan_ids: ['DY_ARI_RATE_001']
        })
      })
    );
    const logRecords = await readJsonLines(logFilePath);
    expect(logRecords).toEqual([
      expect.objectContaining({
        type: 'ari_notify',
        stage: 'processed',
        logId: 'DY_ARI_LOG_001',
        localRatePlanIds: [localRatePlanId],
        ratePlanIds: ['DY_ARI_RATE_001'],
        hotelIds: ['DY_HOTEL_ARI_001'],
        notifyScenes: [1, 2, 3, 4]
      })
    ]);
  });

  test('传入 notifyScenes 时会按指定场景通知抖音', async () => {
    const localRatePlanId = await createRatePlan({ ratePlanId: 'DY_ARI_RATE_001' });
    douyinTokenService.getToken.mockResolvedValue('TOKEN_ARI_001');
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          error_code: 0,
          description: ''
        },
        extra: {
          error_code: 0,
          description: '',
          logid: 'DY_ARI_LOG_SCENE'
        }
      })
    });

    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: [localRatePlanId],
        startDate: '2099-01-01',
        endDate: '2099-01-02',
        notifyScenes: [1, 3]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.notifyScenes).toEqual([1, 3]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://open.douyin.test/goodlife/v1/trip/hotel/ari/notify/',
      expect.objectContaining({
        body: JSON.stringify({
          account_id: 'DY_ACCOUNT_TEST',
          date_range: {
            start: '2099-01-01',
            end: '2099-01-02'
          },
          hotel_ids: ['DY_HOTEL_ARI_001'],
          notify_scene: [1, 3],
          rate_plan_ids: ['DY_ARI_RATE_001']
        })
      })
    );
  });

  test('抖音业务错误返回 502 并带上 logid', async () => {
    const localRatePlanId = await createRatePlan({ ratePlanId: 'DY_ARI_RATE_001' });
    douyinTokenService.getToken.mockResolvedValue('TOKEN_ARI_001');
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          error_code: 2100005,
          description: '参数不合法'
        },
        extra: {
          error_code: 0,
          description: '',
          logid: 'DY_ARI_LOG_BAD'
        }
      })
    });

    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: [localRatePlanId],
        startDate: '2099-01-01',
        endDate: '2099-01-02'
      });

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe('通知抖音拉取价量态失败');
    expect(response.body.error).toBe('参数不合法');
    expect(response.body.douyin_log_id).toBe('DY_ARI_LOG_BAD');
    const logRecords = await readJsonLines(logFilePath);
    expect(logRecords).toEqual([
      expect.objectContaining({
        type: 'ari_notify',
        stage: 'error',
        logId: 'DY_ARI_LOG_BAD',
        localRatePlanIds: [localRatePlanId],
        statusCode: 502,
        error: '参数不合法'
      })
    ]);
  });

  test('抖音 extra 错误返回 502 并带上 logid', async () => {
    const localRatePlanId = await createRatePlan({ ratePlanId: 'DY_ARI_RATE_001' });
    douyinTokenService.getToken.mockResolvedValue('TOKEN_ARI_001');
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          error_code: 0,
          description: ''
        },
        extra: {
          error_code: 2190004,
          description: '应用未获得该能力',
          logid: 'DY_ARI_LOG_EXTRA_BAD'
        }
      })
    });

    const response = await request(app)
      .post('/api/douyin/ari-notify')
      .send({
        localRatePlanIds: [localRatePlanId],
        startDate: '2099-01-01',
        endDate: '2099-01-02'
      });

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe('通知抖音拉取价量态失败');
    expect(response.body.error).toBe('应用未获得该能力');
    expect(response.body.douyin_log_id).toBe('DY_ARI_LOG_EXTRA_BAD');
  });
});
