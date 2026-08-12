const express = require('express');
const request = require('supertest');

process.env.DOUYIN_ACCOUNT_ID = 'DY_PRESALE_ACCOUNT';
process.env.DOUYIN_POI_ID = 'DY_PRESALE_HOTEL';

jest.mock('../modules/douyin/token/token.service', () => ({ getToken: jest.fn() }));

const { query } = require('../database/postgreDB/pg');
const tokenService = require('../modules/douyin/token/token.service');
const route = require('../modules/douyin/rate-plan/ratePlan.routes');
const originalFetch = global.fetch;

/** 构造独立路由应用，避免测试依赖未授权的外部服务。 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rate-plans', route);
  return app;
}

/** 创建已同步预定商品的预售券套餐。 */
async function createPresalePlan(app) {
  await query(`INSERT INTO room_types (type_code, type_name, base_price) VALUES ('PRESALE_PRICE_ROOM', '预售券房价测试房型', 300)`);
  await query(`INSERT INTO douyin_physical_rooms (account_id, room_id, room_name, raw_payload, rate_plan_list) VALUES ($1, $2, $3, $4, $5)`,
    ['DY_PRESALE_ACCOUNT', 'DY_PRESALE_PRICE_ROOM', '预售券房价测试物理房型', { hotel_id: 'DY_PRESALE_HOTEL' }, []]);
  await query(`INSERT INTO douyin_room_type_mapping (douyin_room_id, douyin_room_name, local_room_type) VALUES ($1, $2, $3)`,
    ['DY_PRESALE_PRICE_ROOM', '预售券房价测试物理房型', 'PRESALE_PRICE_ROOM']);
  const response = await request(app).post('/api/rate-plans').send({
    room_type_code: 'PRESALE_PRICE_ROOM', name: '预售券房价测试套餐', base_price: 399, currency: 'CNY', douyin_business_type: 'PRESALE'
  });
  expect(response.statusCode).toBe(201);
  const id = response.body.data.id;
  await query(
    `INSERT INTO ota_channel_mappings (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status)
     VALUES ('RATE_PLAN', $1, 'DOUYIN', 'DY_PRESALE_BOOKING_RATE_PLAN', $2, 1)`,
    [id, { out_rate_plan_id: String(id) }]
  );
  return id;
}

/** 创建用于边界校验的日历房套餐。 */
async function createCalendarPlan(app) {
  await query(`INSERT INTO room_types (type_code, type_name, base_price) VALUES ('CALENDAR_PRICE_ROOM', '日历房价测试房型', 300)`);
  await query(`INSERT INTO douyin_physical_rooms (account_id, room_id, room_name, raw_payload, rate_plan_list) VALUES ($1, $2, $3, $4, $5)`,
    ['DY_PRESALE_ACCOUNT', 'DY_CALENDAR_PRICE_ROOM', '日历房价测试物理房型', { hotel_id: 'DY_PRESALE_HOTEL' }, []]);
  await query(`INSERT INTO douyin_room_type_mapping (douyin_room_id, douyin_room_name, local_room_type) VALUES ($1, $2, $3)`,
    ['DY_CALENDAR_PRICE_ROOM', '日历房价测试物理房型', 'CALENDAR_PRICE_ROOM']);
  const response = await request(app).post('/api/rate-plans').send({
    room_type_code: 'CALENDAR_PRICE_ROOM', name: '日历房价测试套餐', base_price: 399, currency: 'CNY', douyin_business_type: 'CALENDAR_ROOM'
  });
  expect(response.statusCode).toBe(201);
  return response.body.data.id;
}

describe('抖音预售券按日房价推送', () => {
  const app = buildApp();

  beforeEach(async () => {
    await query('DELETE FROM ota_channel_mappings');
    await query('DELETE FROM douyin_calendar_room_prices');
    await query('DELETE FROM douyin_room_type_mapping');
    await query('DELETE FROM douyin_physical_rooms');
    await query('DELETE FROM rate_plans');
    await query("DELETE FROM room_types WHERE type_code IN ('PRESALE_PRICE_ROOM', 'CALENDAR_PRICE_ROOM')");
    tokenService.getToken.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => { global.fetch = originalFetch; });

  test('预售券通过独立入口向绑定的预定商品推送按日房价', async () => {
    const id = await createPresalePlan(app);
    const saveResponse = await request(app).put(`/api/rate-plans/${id}/douyin/presale/prices`).send({
      prices: [{ stayDate: '2026-08-05', originalAmount: 398 }]
    });
    expect(saveResponse.statusCode).toBe(200);

    tokenService.getToken.mockResolvedValue('PRESALE_TOKEN');
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({
      data: { save_result: [{ rate_plan_id: 'DY_PRESALE_BOOKING_RATE_PLAN', code: 0 }] },
      extra: { error_code: 0, logid: 'PRESALE_PRICE_LOG_ID' }
    }) });

    const response = await request(app).post(`/api/rate-plans/${id}/douyin/presale/prices/sync`).send({ startDate: '2026-08-05', endDate: '2026-08-05' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({ douyinRatePlanId: 'DY_PRESALE_BOOKING_RATE_PLAN', logIds: ['PRESALE_PRICE_LOG_ID'] });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      account_id: 'DY_PRESALE_ACCOUNT',
      hotel_id: 'DY_PRESALE_HOTEL',
      aris: [{ rate_plan_id: 'DY_PRESALE_BOOKING_RATE_PLAN', timerange: { start: '2026-08-05', end: '2026-08-05' }, original_amount: 39800 }]
    });
  });

  test('日历房套餐不能通过预售券价格接口维护价格', async () => {
    const id = await createCalendarPlan(app);
    const response = await request(app).put(`/api/rate-plans/${id}/douyin/presale/prices`).send({
      prices: [{ stayDate: '2026-08-05', originalAmount: 398 }]
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('套餐不是预售券业务，不能维护预售券按日房价');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
