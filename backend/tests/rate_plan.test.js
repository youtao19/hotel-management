const express = require('express');
const request = require('supertest');

jest.mock('../services/douyinTokenService', () => ({
  getToken: jest.fn()
}));

const { query } = require('../database/postgreDB/pg');
const douyinTokenService = require('../services/douyinTokenService');
const ratePlanRoute = require('../routes/ratePlanRoute');

const originalFetch = global.fetch;

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rate-plans', ratePlanRoute);
  return app;
}

async function createRoomType(typeCode = 'RP_TEST') {
  await query(
    `
      INSERT INTO room_types (type_code, type_name, base_price, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (type_code) DO UPDATE
      SET type_name = EXCLUDED.type_name,
          base_price = EXCLUDED.base_price,
          description = EXCLUDED.description
    `,
    [typeCode, `测试房型-${typeCode}`, 299, '售卖套餐测试房型']
  );
}

function buildPayload(overrides = {}) {
  return {
    room_type_code: 'RP_TEST',
    name: '双早套餐',
    base_price: 399,
    status: 1,
    sales_type: 1,
    currency: 'CNY',
    douyin_config: {
      source: 'rate_plan_test'
    },
    ...overrides
  };
}

describe('售卖套餐本地 CRUD', () => {
  const app = buildTestApp();

  beforeEach(async () => {
    await query("DELETE FROM ota_channel_mappings WHERE local_target_type = 'RATE_PLAN'");
    await query('DELETE FROM douyin_room_type_mapping');
    await query('DELETE FROM douyin_physical_rooms');
    await query('DELETE FROM rate_plans');
    await query("DELETE FROM room_types WHERE type_code LIKE 'RP_TEST%'");
    await createRoomType();
    douyinTokenService.getToken.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('创建、查询、更新、删除售卖套餐', async () => {
    const createResponse = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload());

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.data.name).toBe('双早套餐');
    expect(createResponse.body.data.room_type_code).toBe('RP_TEST');
    expect(createResponse.body.data.base_price).toBe(399);

    const id = createResponse.body.data.id;

    const listResponse = await request(app).get('/api/rate-plans');
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].id).toBe(id);

    const detailResponse = await request(app).get(`/api/rate-plans/${id}`);
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.data.id).toBe(id);

    const updateResponse = await request(app)
      .patch(`/api/rate-plans/${id}`)
      .send({
        name: '双早可退套餐',
        base_price: 429,
        status: 0
      });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.data.name).toBe('双早可退套餐');
    expect(updateResponse.body.data.base_price).toBe(429);
    expect(updateResponse.body.data.status).toBe(0);

    const deleteResponse = await request(app).delete(`/api/rate-plans/${id}`);
    expect(deleteResponse.statusCode).toBe(200);

    const afterDeleteResponse = await request(app).get(`/api/rate-plans/${id}`);
    expect(afterDeleteResponse.statusCode).toBe(404);
  });

  test('房型不存在时创建返回 400', async () => {
    const response = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload({ room_type_code: 'RP_TEST_MISSING' }));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('房型不存在，无法创建售卖套餐');
  });

  test('钟点房缺少明细字段时返回 400', async () => {
    const response = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload({ sales_type: 2 }));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('钟点房必须提供最早入住时间、最晚离店时间和使用时长');
  });

  test.each([
    ['非法时间', { sales_type: 2, hourly_earliest_check_in: '25:00', hourly_latest_check_out: '18:00', hourly_usage_duration: 4 }],
    ['非法币种', { currency: 'cny' }],
    ['负价格', { base_price: -1 }],
    ['非法状态', { status: 2 }],
    ['非法售卖形式', { sales_type: 9 }],
    ['douyin_config 不能是数组', { douyin_config: [] }]
  ])('%s 时返回 400', async (_caseName, overrides) => {
    const response = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload(overrides));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求数据格式错误');
  });

  test('已同步到渠道的套餐不能删除', async () => {
    const createResponse = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload());

    const id = createResponse.body.data.id;
    await query(
      `
        INSERT INTO ota_channel_mappings
          (local_target_type, local_target_id, channel_code, channel_item_id, sync_status)
        VALUES ($1, $2, $3, $4, $5)
      `,
      ['RATE_PLAN', id, 'DOUYIN', 'DY_RATE_PLAN_001', 1]
    );

    const deleteResponse = await request(app).delete(`/api/rate-plans/${id}`);

    expect(deleteResponse.statusCode).toBe(400);
    expect(deleteResponse.body.message).toBe('套餐已同步到渠道，不能直接删除');
  });

  test('同步抖音预定商品成功后写入渠道映射', async () => {
    const createResponse = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload());
    const id = createResponse.body.data.id;

    await query(
      `
        INSERT INTO douyin_room_type_mapping
          (douyin_room_id, douyin_room_name, local_room_type)
        VALUES ($1, $2, $3)
      `,
      ['DY_ROOM_001', '抖音测试房型', 'RP_TEST']
    );
    await query(
      `
        INSERT INTO douyin_physical_rooms
          (account_id, room_id, room_name, raw_payload, rate_plan_list)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        'DY_ACCOUNT_001',
        'DY_ROOM_001',
        '抖音测试房型',
        { hotel_id: 'DY_HOTEL_001' },
        []
      ]
    );

    douyinTokenService.getToken.mockResolvedValue('TOKEN_001');
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          rate_plan_map: [
            {
              rate_plan_id: 'DY_RATE_PLAN_001',
              out_rate_plan_id: String(id)
            }
          ],
          error_code: 0,
          description: ''
        },
        extra: {
          error_code: 0,
          description: '',
          logid: 'DY_LOG_001'
        }
      })
    });

    const response = await request(app)
      .post(`/api/rate-plans/${id}/douyin/sync`)
      .send({
        accountId: 'DY_ACCOUNT_OVERRIDE',
        poiId: 'DY_HOTEL_OVERRIDE'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.rate_plan.douyin_rate_plan_id).toBe('DY_RATE_PLAN_001');
    expect(response.body.data.rate_plan.is_synced).toBe(true);
    expect(response.body.data.douyin.douyinId).toBe('DY_RATE_PLAN_001');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://open.douyin.com/goodlife/v1/trip/hotel/presale/rateplan/save/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'access-token': 'TOKEN_001'
        })
      })
    );

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      account_id: 'DY_ACCOUNT_OVERRIDE',
      rate_plan: {
        hotel_id: 'DY_HOTEL_OVERRIDE',
        rooms: [
          {
            room_id: 'DY_ROOM_001',
            rate_plans: [
              {
                out_rate_plan_id: String(id),
                rate_plan_name: '双早套餐',
                sales_type: 1,
                currency: 'CNY',
                active: true
              }
            ]
          }
        ]
      }
    });

    const mappingResult = await query(
      `
        SELECT channel_item_id, channel_config, sync_status
        FROM ota_channel_mappings
        WHERE local_target_type = $1
          AND local_target_id = $2
          AND channel_code = $3
      `,
      ['RATE_PLAN', id, 'DOUYIN']
    );
    expect(mappingResult.rows).toHaveLength(1);
    expect(mappingResult.rows[0].channel_item_id).toBe('DY_RATE_PLAN_001');
    expect(mappingResult.rows[0].sync_status).toBe(1);
    expect(mappingResult.rows[0].channel_config).toMatchObject({
      out_rate_plan_id: String(id),
      room_id: 'DY_ROOM_001',
      hotel_id: 'DY_HOTEL_OVERRIDE',
      account_id: 'DY_ACCOUNT_OVERRIDE',
      log_id: 'DY_LOG_001'
    });

    const physicalRoomResult = await query(
      'SELECT rate_plan_list FROM douyin_physical_rooms WHERE room_id = $1',
      ['DY_ROOM_001']
    );
    expect(physicalRoomResult.rows[0].rate_plan_list).toEqual([
      expect.objectContaining({
        rate_plan_id: 'DY_RATE_PLAN_001',
        out_rate_plan_id: String(id),
        rate_plan_name: '双早套餐',
        active: true,
        sales_type: 1,
        currency: 'CNY',
        hotel_id: 'DY_HOTEL_OVERRIDE'
      })
    ]);
  });

  test('同步抖音时未绑定物理房型返回 400', async () => {
    const createResponse = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload());
    const id = createResponse.body.data.id;

    const response = await request(app)
      .post(`/api/rate-plans/${id}/douyin/sync`)
      .send({
        accountId: 'DY_ACCOUNT_001',
        poiId: 'DY_HOTEL_001'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('套餐所属房型尚未绑定抖音物理房型，无法同步');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('凌晨房套餐同步抖音返回 400', async () => {
    const createResponse = await request(app)
      .post('/api/rate-plans')
      .send(buildPayload({
        name: '凌晨房套餐',
        sales_type: 3,
        midnight_enabled: true,
        midnight_latest_booking_time: 3
      }));
    const id = createResponse.body.data.id;

    const response = await request(app)
      .post(`/api/rate-plans/${id}/douyin/sync`)
      .send({
        accountId: 'DY_ACCOUNT_001',
        poiId: 'DY_HOTEL_001'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('抖音预售券预定商品暂不支持凌晨房套餐同步');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
