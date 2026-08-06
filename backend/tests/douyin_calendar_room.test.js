const express = require('express');
const request = require('supertest');

process.env.DOUYIN_ACCOUNT_ID = 'DY_CALENDAR_ACCOUNT';
process.env.DOUYIN_POI_ID = 'DY_CALENDAR_HOTEL';

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

/** 创建日历房套餐及其物理房型匹配。 */
async function createCalendarPlan(app) {
  await query(`INSERT INTO room_types (type_code, type_name, base_price) VALUES ('CAL_ROOM', '日历房测试房型', 300)`);
  const response = await request(app).post('/api/rate-plans').send({
    room_type_code: 'CAL_ROOM', name: '日历房双早', base_price: 399, currency: 'CNY', douyin_business_type: 'CALENDAR_ROOM'
  });
  const id = response.body.data.id;
  await query(`INSERT INTO douyin_physical_rooms (account_id, room_id, room_name, raw_payload, rate_plan_list) VALUES ($1, $2, $3, $4, $5)`,
    ['DY_CALENDAR_ACCOUNT', 'DY_CALENDAR_ROOM', '日历房测试物理房型', { hotel_id: 'DY_CALENDAR_HOTEL' }, []]);
  await query(`INSERT INTO douyin_room_type_mapping (douyin_room_id, douyin_room_name, local_room_type) VALUES ($1, $2, $3)`,
    ['DY_CALENDAR_ROOM', '日历房测试物理房型', 'CAL_ROOM']);
  return id;
}

/** 创建已同步预定商品的预售券套餐。 */
async function createPresalePlan(app) {
  await query(`INSERT INTO room_types (type_code, type_name, base_price) VALUES ('PRESALE_ROOM', '预售券测试房型', 300)`);
  const response = await request(app).post('/api/rate-plans').send({
    room_type_code: 'PRESALE_ROOM', name: '预售券测试套餐', base_price: 399, currency: 'CNY', douyin_business_type: 'PRESALE'
  });
  const id = response.body.data.id;
  await query(
    `INSERT INTO ota_channel_mappings (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status)
     VALUES ('RATE_PLAN', $1, 'DOUYIN', 'DY_PRESALE_BOOKING_RATE_PLAN', $2, 1)`,
    [id, { out_rate_plan_id: String(id) }]
  );
  return id;
}

describe('抖音日历房静态规则与同步', () => {
  const app = buildApp();

  beforeEach(async () => {
    await query('DELETE FROM ota_channel_mappings');
    await query('DELETE FROM douyin_calendar_room_prices');
    await query('DELETE FROM douyin_calendar_room_rules');
    await query('DELETE FROM douyin_room_type_mapping');
    await query('DELETE FROM douyin_physical_rooms');
    await query('DELETE FROM rate_plans');
    await query("DELETE FROM room_types WHERE type_code = 'CAL_ROOM'");
    await query("DELETE FROM room_types WHERE type_code = 'PRESALE_ROOM'");
    tokenService.getToken.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => { global.fetch = originalFetch; });

  test('日历房规则以 YYYY-MM-DD 保存，并同步成功后写入映射', async () => {
    const id = await createCalendarPlan(app);
    const rule = { validityStart: '2026-08-05', validityEnd: '2026-12-31', cancelRule: 1, breakfastNumber: 2, refundType: 1, status: 1 };
    expect((await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/rule`).send(rule)).statusCode).toBe(200);

    tokenService.getToken.mockResolvedValue('CALENDAR_TOKEN');
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({
      data: { rate_plan_map: [{ rate_plan_id: 'DY_CALENDAR_RATE_PLAN', out_rate_plan_id: String(id), code: '0', message: 'success' }] },
      extra: { error_code: 0, logid: 'CALENDAR_LOG_ID' }
    }) });
    const response = await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/sync`).send({});

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ account_id: 'DY_CALENDAR_ACCOUNT', rate_plan: { hotel_id: 'DY_CALENDAR_HOTEL', rooms: [{ room_id: 'DY_CALENDAR_ROOM', rate_plans: [{ out_rate_plan_id: String(id), validity: { start: '2026-08-05', end: '2026-12-31' }, cancel_rule: { rule: 1 }, breakfast_rule: { number: 2 }, refund_rule: { refundType: 1 }, status: 1 }] }] } });
    const mapping = await query(`SELECT channel_item_id, channel_config FROM ota_channel_mappings WHERE local_target_id = $1`, [id]);
    expect(mapping.rows[0]).toMatchObject({ channel_item_id: 'DY_CALENDAR_RATE_PLAN', channel_config: expect.objectContaining({ business_type: 'CALENDAR_ROOM', log_id: 'CALENDAR_LOG_ID' }) });
  });

  test('抖音逐条失败不写入渠道映射，且预售券套餐不能保存日历房规则', async () => {
    const id = await createCalendarPlan(app);
    await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/rule`).send({ validityStart: '2026-08-05', validityEnd: '2026-12-31', cancelRule: 1, breakfastNumber: 0, refundType: 1, status: 1 });
    tokenService.getToken.mockResolvedValue('CALENDAR_TOKEN');
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { rate_plan_map: [{ out_rate_plan_id: String(id), code: '4000001', message: '规则不合法' }] }, extra: { error_code: 0, logid: 'FAILED_LOG_ID' } }) });
    const syncResponse = await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/sync`).send({});
    expect(syncResponse.statusCode).toBe(502);
    expect(syncResponse.body.douyin_log_id).toBe('FAILED_LOG_ID');
    expect((await query('SELECT * FROM ota_channel_mappings WHERE local_target_id = $1', [id])).rows).toHaveLength(0);

    const presale = await request(app).post('/api/rate-plans').send({ room_type_code: 'CAL_ROOM', name: '预售券套餐', base_price: 199, currency: 'CNY' });
    const ruleResponse = await request(app).put(`/api/rate-plans/${presale.body.data.id}/douyin/calendar-room/rule`).send({ validityStart: '2026-08-05', validityEnd: '2026-12-31', cancelRule: 1, breakfastNumber: 0, refundType: 1, status: 1 });
    expect(ruleResponse.statusCode).toBe(400);
  });

  test('不存在的自然日由后端返回 400，而不是交给数据库报错', async () => {
    const id = await createCalendarPlan(app);
    const response = await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/rule`).send({
      validityStart: '2026-99-99', validityEnd: '2026-12-31', cancelRule: 1, breakfastNumber: 0, refundType: 1, status: 1
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('有效期必须为真实的 YYYY-MM-DD 日期');
  });

  test('按日价格以分推送，成功后记录同步时间', async () => {
    const id = await createCalendarPlan(app);
    await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/rule`).send({ validityStart: '2026-08-05', validityEnd: '2026-12-31', cancelRule: 1, breakfastNumber: 0, refundType: 1, status: 1 });
    tokenService.getToken.mockResolvedValue('CALENDAR_TOKEN');
    global.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { rate_plan_map: [{ rate_plan_id: 'DY_CALENDAR_RATE_PLAN', out_rate_plan_id: String(id), code: '0' }] }, extra: { error_code: 0, logid: 'STATIC_LOG_ID' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { save_result: [{ rate_plan_id: 'DY_CALENDAR_RATE_PLAN', code: 0 }] }, extra: { error_code: 0, logid: 'PRICE_LOG_ID' } }) });
    await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/sync`).send({});

    const saveResponse = await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/prices`).send({
      prices: [
        { stayDate: '2026-08-05', originalAmount: 398, retailAmount: 499 },
        { stayDate: '2026-08-06', originalAmount: 398, retailAmount: 499 }
      ]
    });
    expect(saveResponse.statusCode).toBe(200);

    const response = await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/prices/sync`).send({ startDate: '2026-08-05', endDate: '2026-08-06' });
    expect(response.statusCode).toBe(200);
    expect(response.body.data.logIds).toEqual(['PRICE_LOG_ID']);
    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://open.douyin.com/goodlife/v1/trip/hotel/price/save/',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({
      account_id: 'DY_CALENDAR_ACCOUNT',
      hotel_id: 'DY_CALENDAR_HOTEL',
      aris: [{ rate_plan_id: 'DY_CALENDAR_RATE_PLAN', timerange: { start: '2026-08-05', end: '2026-08-06' }, original_amount: 39800, retail_amount: 49900 }]
    });
    const prices = await query('SELECT last_synced_at FROM douyin_calendar_room_prices WHERE rate_plan_id = $1', [id]);
    expect(prices.rows.every((price) => price.last_synced_at)).toBe(true);
  });

  test('预售券套餐向绑定的预定商品推送按日房价', async () => {
    const id = await createPresalePlan(app);
    await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/prices`).send({
      prices: [{ stayDate: '2026-08-05', originalAmount: 398 }]
    });
    tokenService.getToken.mockResolvedValue('PRESALE_TOKEN');
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({
      data: { save_result: [{ rate_plan_id: 'DY_PRESALE_BOOKING_RATE_PLAN', code: 0 }] },
      extra: { error_code: 0, logid: 'PRESALE_PRICE_LOG_ID' }
    }) });

    const response = await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/prices/sync`).send({ startDate: '2026-08-05', endDate: '2026-08-05' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({ douyinRatePlanId: 'DY_PRESALE_BOOKING_RATE_PLAN', logIds: ['PRESALE_PRICE_LOG_ID'] });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).aris).toEqual([
      { rate_plan_id: 'DY_PRESALE_BOOKING_RATE_PLAN', timerange: { start: '2026-08-05', end: '2026-08-05' }, original_amount: 39800 }
    ]);
  });

  test('缺少任一天日历房价格时拒绝推送', async () => {
    const id = await createCalendarPlan(app);
    await query(`INSERT INTO ota_channel_mappings (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status) VALUES ('RATE_PLAN', $1, 'DOUYIN', 'DY_CALENDAR_RATE_PLAN', $2, 1)`, [id, { business_type: 'CALENDAR_ROOM' }]);
    await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/prices`).send({ prices: [{ stayDate: '2026-08-05', originalAmount: 398 }] });
    const response = await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/prices/sync`).send({ startDate: '2026-08-05', endDate: '2026-08-06' });
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('缺少 2026-08-06 的日历房价格');
  });

  test('房价推送失败时返回抖音 logid', async () => {
    const id = await createCalendarPlan(app);
    await query(`INSERT INTO ota_channel_mappings (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status) VALUES ('RATE_PLAN', $1, 'DOUYIN', 'DY_CALENDAR_RATE_PLAN', $2, 1)`, [id, { business_type: 'CALENDAR_ROOM' }]);
    await request(app).put(`/api/rate-plans/${id}/douyin/calendar-room/prices`).send({
      prices: [
        { stayDate: '2026-08-05', originalAmount: 398 },
        { stayDate: '2026-08-06', originalAmount: 398 }
      ]
    });
    tokenService.getToken.mockResolvedValue('CALENDAR_TOKEN');
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({
      data: {}, extra: { error_code: 4000001, description: '餐食信息缺失，请补充', logid: 'MEAL_LOG_ID' }
    }) });

    const response = await request(app).post(`/api/rate-plans/${id}/douyin/calendar-room/prices/sync`).send({ startDate: '2026-08-05', endDate: '2026-08-06' });

    expect(response.statusCode).toBe(502);
    expect(response.body).toMatchObject({ message: '餐食信息缺失，请补充', douyin_log_id: 'MEAL_LOG_ID' });
  });
});
