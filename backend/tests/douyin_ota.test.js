"use strict";

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { buildInboundSignature } = require('../modules/ota/douyin/authService');
const { processOutboxTask } = require('../modules/ota/douyin/roomSyncService');

const CLIENT_KEY = 'douyin-test-key';
const INBOUND_SECRET = 'douyin-test-secret';

/**
 * 生成签名请求头。
 * @param {object} payload 请求体
 * @returns {object} 请求头
 */
function buildSignedHeaders(payload) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    'x-douyin-client-key': CLIENT_KEY,
    'x-douyin-timestamp': timestamp,
    'x-douyin-signature': buildInboundSignature(INBOUND_SECRET, timestamp, rawBody)
  };
}

/**
 * 生成 Webhook 签名请求头。
 * @param {object} payload 请求体
 * @param {string} appSecret 抖音应用密钥
 * @returns {object} 请求头
 */
function buildWebhookSignedHeaders(payload, appSecret = 'test-secret') {
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHash('sha1')
    .update(`${String(appSecret)}${rawBody}`, 'utf8')
    .digest('hex');

  return {
    'x-douyin-signature': signature
  };
}

/**
 * 解析 text/plain 形式返回的 JSON 文本。
 * @param {object} response supertest 响应对象
 * @returns {object} 解析后的 JSON 对象
 */
function parseJsonTextResponse(response) {
  const rawText = typeof response.text === 'string' ? response.text : '';
  return JSON.parse(rawText);
}

/**
 * 初始化抖音账号配置。
 * @param {object} overrides 覆盖参数
 * @returns {Promise<void>}
 */
async function seedDouyinAccount(overrides = {}) {
  await query(
    `INSERT INTO douyin_account_config (
       account_code, client_key, inbound_secret, app_id, app_secret, api_base_url,
       access_token, enabled, mock_mode, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, now())
     ON CONFLICT (account_code)
     DO UPDATE SET
       client_key = EXCLUDED.client_key,
       inbound_secret = EXCLUDED.inbound_secret,
       app_id = EXCLUDED.app_id,
       app_secret = EXCLUDED.app_secret,
       api_base_url = EXCLUDED.api_base_url,
       access_token = EXCLUDED.access_token,
       enabled = TRUE,
       mock_mode = EXCLUDED.mock_mode,
       updated_at = now()`,
    [
      'default',
      CLIENT_KEY,
      INBOUND_SECRET,
      overrides.appId || 'test-app',
      overrides.appSecret || 'test-secret',
      overrides.apiBaseUrl || 'https://douyin.example.test',
      overrides.accessToken || 'token-123',
      overrides.mockMode || 'success'
    ]
  );
}

/**
 * 初始化房型、房间和抖音映射。
 * @param {object} overrides 覆盖参数
 * @returns {Promise<void>}
 */
async function seedRoomMapping(overrides = {}) {
  const roomType = overrides.roomType || 'DY_ROOM';
  const basePrice = overrides.basePrice || 200;
  await query(
    `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
     VALUES ($1, $2, $3, $4, FALSE)
     ON CONFLICT (type_code)
     DO UPDATE SET type_name = EXCLUDED.type_name, base_price = EXCLUDED.base_price`,
    [roomType, '抖音测试房型', basePrice, '抖音直连测试']
  );
  await query(
    `INSERT INTO rooms (room_number, type_code, status, price, is_closed)
     VALUES ($1, $2, 'available', $3, FALSE)
     ON CONFLICT (room_number)
     DO UPDATE SET type_code = EXCLUDED.type_code, status = EXCLUDED.status, price = EXCLUDED.price, is_closed = FALSE`,
    [overrides.roomNumber || 'DY101', roomType, basePrice]
  );
  await query(
    `INSERT INTO douyin_room_mapping (
       local_room_type, douyin_room_id, douyin_rate_plan_id, sync_inventory, sync_price, enabled, updated_at
     ) VALUES ($1, $2, $3, TRUE, TRUE, TRUE, now())
     ON CONFLICT (douyin_room_id, douyin_rate_plan_id)
     DO UPDATE SET local_room_type = EXCLUDED.local_room_type, enabled = TRUE, updated_at = now()`,
    [roomType, overrides.roomId || 'dy-room-1', overrides.ratePlanId || 'rp-1']
  );
}

/**
 * 清理抖音相关测试数据。
 * @returns {Promise<void>}
 */
async function clearDouyinData() {
  await query('DELETE FROM douyin_outbox');
  await query('DELETE FROM douyin_order_event');
  await query('DELETE FROM douyin_order');
  await query('DELETE FROM orders');
  await query('DELETE FROM rooms');
  await query('DELETE FROM douyin_room_mapping');
  await query('DELETE FROM room_types');
  await query('DELETE FROM douyin_account_config');
}

beforeEach(async () => {
  await clearDouyinData();
});

describe('抖音 OTA 创单接口', () => {
  test('首次创单成功，重复创单返回幂等结果', async () => {
    await seedDouyinAccount();
    await seedRoomMapping();

    const payload = {
      douyin_order_id: 'DY202603090001',
      order_out_id: 'OUT202603090001',
      guest_name: '张三',
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-12',
      total_price: 400
    };

    const createRes = await request(app)
      .post('/ota/douyin/order/create')
      .set(buildSignedHeaders(payload))
      .send(payload);

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.existing).toBe(false);
    expect(createRes.body.data.internal_order_id).toBeTruthy();
    expect(createRes.body.data.hotel_confirm_number).toBeTruthy();

    const duplicateRes = await request(app)
      .post('/ota/douyin/order/create')
      .set(buildSignedHeaders(payload))
      .send(payload);

    expect(duplicateRes.statusCode).toBe(200);
    expect(duplicateRes.body.existing).toBe(true);
    expect(duplicateRes.body.data.internal_order_id).toBe(createRes.body.data.internal_order_id);

    const orderRows = await query('SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date', [createRes.body.data.internal_order_id]);
    expect(orderRows.rows).toHaveLength(2);
  });

  test('签名错误时返回 401', async () => {
    await seedDouyinAccount();
    await seedRoomMapping();

    const payload = {
      douyin_order_id: 'DY202603090009',
      guest_name: '签名错误',
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-11',
      total_price: 200
    };

    const response = await request(app)
      .post('/ota/douyin/order/create')
      .set({
        'x-douyin-client-key': CLIENT_KEY,
        'x-douyin-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-douyin-signature': 'bad-sign'
      })
      .send(payload);

    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe('DOUYIN_AUTH_INVALID_SIGNATURE');
  });

  test('房型映射不存在时返回 404', async () => {
    await seedDouyinAccount();

    const payload = {
      douyin_order_id: 'DY202603090002',
      guest_name: '李四',
      room_id: 'not-found-room',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-11',
      total_price: 200
    };

    const response = await request(app)
      .post('/ota/douyin/order/create')
      .set(buildSignedHeaders(payload))
      .send(payload);

    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe('DOUYIN_ROOM_MAPPING_NOT_FOUND');
  });

  test('并发抢最后一间房时不会超卖', async () => {
    await seedDouyinAccount();
    await seedRoomMapping({ roomNumber: 'DY201' });

    const payload1 = {
      douyin_order_id: 'DY202603090003',
      order_out_id: 'OUT202603090003',
      guest_name: '并发1',
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-11',
      total_price: 200
    };
    const payload2 = {
      douyin_order_id: 'DY202603090004',
      order_out_id: 'OUT202603090004',
      guest_name: '并发2',
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-11',
      total_price: 200
    };

    const [res1, res2] = await Promise.all([
      request(app).post('/ota/douyin/order/create').set(buildSignedHeaders(payload1)).send(payload1),
      request(app).post('/ota/douyin/order/create').set(buildSignedHeaders(payload2)).send(payload2)
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);
  });
});

describe('抖音 OTA 取消接口', () => {
  test('未入住订单可取消，重复取消保持幂等', async () => {
    await seedDouyinAccount();
    await seedRoomMapping();

    const createPayload = {
      douyin_order_id: 'DY202603090005',
      order_out_id: 'OUT202603090005',
      guest_name: '取消测试',
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-12',
      total_price: 400
    };

    const createRes = await request(app)
      .post('/ota/douyin/order/create')
      .set(buildSignedHeaders(createPayload))
      .send(createPayload);

    const cancelPayload = {
      douyin_order_id: 'DY202603090005',
      cancel_reason: '用户取消'
    };

    const cancelRes = await request(app)
      .post('/ota/douyin/order/cancel')
      .set(buildSignedHeaders(cancelPayload))
      .send(cancelPayload);

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.cancelled).toBe(true);
    expect(cancelRes.body.alreadyCancelled).toBe(false);

    const duplicateCancelRes = await request(app)
      .post('/ota/douyin/order/cancel')
      .set(buildSignedHeaders(cancelPayload))
      .send(cancelPayload);

    expect(duplicateCancelRes.statusCode).toBe(200);
    expect(duplicateCancelRes.body.alreadyCancelled).toBe(true);

    const orderRows = await query('SELECT DISTINCT status FROM orders WHERE order_id = $1', [createRes.body.data.internal_order_id]);
    expect(orderRows.rows).toEqual([{ status: 'cancelled' }]);
  });

  test('已入住订单不可取消', async () => {
    await seedDouyinAccount();
    await seedRoomMapping();

    const createPayload = {
      douyin_order_id: 'DY202603090006',
      order_out_id: 'OUT202603090006',
      guest_name: '已入住',
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1',
      check_in_date: '2026-03-10',
      check_out_date: '2026-03-11',
      total_price: 200
    };

    const createRes = await request(app)
      .post('/ota/douyin/order/create')
      .set(buildSignedHeaders(createPayload))
      .send(createPayload);

    await query(`UPDATE orders SET status = 'checked-in' WHERE order_id = $1`, [createRes.body.data.internal_order_id]);

    const cancelPayload = { douyin_order_id: 'DY202603090006' };
    const cancelRes = await request(app)
      .post('/ota/douyin/order/cancel')
      .set(buildSignedHeaders(cancelPayload))
      .send(cancelPayload);

    expect(cancelRes.statusCode).toBe(409);
    expect(cancelRes.body.error.code).toBe('DOUYIN_ORDER_CANCEL_FORBIDDEN');
  });
});

describe('抖音 OTA 房态同步接口', () => {
  test('创建同步任务并对重复批次去重', async () => {
    await seedDouyinAccount({ mockMode: 'success' });
    await seedRoomMapping();

    const payload = {
      roomType: 'DY_ROOM',
      startDate: '2026-03-10',
      endDate: '2026-03-11',
      syncTypes: ['inventory', 'price']
    };

    const firstRes = await request(app)
      .post('/ota/douyin/room/sync')
      .send(payload);

    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body.data.jobs).toHaveLength(2);
    expect(firstRes.body.data.jobs.every((job) => job.existing === false)).toBe(true);

    const secondRes = await request(app)
      .post('/ota/douyin/room/sync')
      .send(payload);

    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body.data.jobs).toHaveLength(2);
    expect(secondRes.body.data.jobs.every((job) => job.existing === true)).toBe(true);

    const outboxRows = await query('SELECT * FROM douyin_outbox ORDER BY id');
    expect(outboxRows.rows).toHaveLength(2);

    const priceTask = outboxRows.rows.find((row) => row.sync_type === 'price');
    const inventoryTask = outboxRows.rows.find((row) => row.sync_type === 'inventory');
    expect(priceTask.request_payload.items[0]).toMatchObject({
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1'
    });
    expect(inventoryTask.request_payload.items[0]).toMatchObject({
      room_id: 'dy-room-1',
      rate_plan_id: 'rp-1'
    });
  });

  test('出站失败后任务进入重试状态', async () => {
    await seedDouyinAccount({ mockMode: 'fail' });
    await seedRoomMapping();

    const payload = {
      roomType: 'DY_ROOM',
      startDate: '2026-03-10',
      endDate: '2026-03-10',
      syncTypes: ['inventory']
    };

    const syncRes = await request(app)
      .post('/ota/douyin/room/sync')
      .send(payload);

    const taskId = syncRes.body.data.jobs[0].id;
    const taskResult = await processOutboxTask(taskId);

    expect(taskResult.task_status).toBe('retrying');
    expect(taskResult.retry_count).toBe(1);

    const dbTask = await query('SELECT task_status, retry_count FROM douyin_outbox WHERE id = $1', [taskId]);
    expect(dbTask.rows[0]).toEqual({
      task_status: 'retrying',
      retry_count: 1
    });
  });

  test('创建售卖房型静态信息同步任务并按 payload 去重', async () => {
    await seedDouyinAccount({ mockMode: 'success' });
    await seedRoomMapping();

    const payload = {
      roomType: 'DY_ROOM',
      ratePlanName: '标准价',
      active: true,
      policy: 1,
      settleType: 1,
      salesType: 1,
      confirmImmediately: true,
      currency: 'CNY'
    };

    const firstRes = await request(app)
      .post('/ota/douyin/room/static/sync')
      .send(payload);

    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body.success).toBe(true);
    expect(firstRes.body.data.jobs).toHaveLength(1);
    expect(firstRes.body.data.jobs[0].sync_type).toBe('rateplan');
    expect(firstRes.body.data.jobs[0].existing).toBe(false);

    const secondRes = await request(app)
      .post('/ota/douyin/room/static/sync')
      .send(payload);

    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body.data.jobs).toHaveLength(1);
    expect(secondRes.body.data.jobs[0].existing).toBe(true);

    const outboxRows = await query(
      `SELECT sync_type, request_payload
         FROM douyin_outbox
        WHERE sync_type = 'rateplan'
        ORDER BY id`
    );
    expect(outboxRows.rows).toHaveLength(1);
    expect(outboxRows.rows[0].request_payload.rooms[0]).toMatchObject({
      room_id: 'dy-room-1'
    });
    expect(outboxRows.rows[0].request_payload.rooms[0].rate_plans[0]).toMatchObject({
      out_rate_plan_id: 'rp-1',
      rate_plan_name: '标准价'
    });
  });

  test('售卖房型静态信息任务可正常出站并标记 sent', async () => {
    await seedDouyinAccount({ mockMode: 'success' });
    await seedRoomMapping();

    const syncRes = await request(app)
      .post('/ota/douyin/room/static/sync')
      .send({
        roomType: 'DY_ROOM',
        ratePlanName: '标准价',
        active: true
      });

    expect(syncRes.statusCode).toBe(200);
    const taskId = syncRes.body.data.jobs[0].id;
    const taskResult = await processOutboxTask(taskId);

    expect(taskResult.task_status).toBe('sent');
    expect(taskResult.response_payload).toMatchObject({
      ok: true,
      mock: true,
      endpoint: '/goodlife/v1/trip/hotel/rateplan/save/'
    });
  });
});

describe('抖音 OTA Webhook 接口', () => {
  test('verify_webhook 场景返回 challenge', async () => {
    await seedDouyinAccount();

    const payload = {
      event: 'verify_webhook',
      content: {
        challenge: 'challenge-token-001'
      }
    };

    const response = await request(app)
      .post('/ota/douyin/webhook')
      .set(buildWebhookSignedHeaders(payload))
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(parseJsonTextResponse(response)).toEqual({
      challenge: 'challenge-token-001'
    });
  });

  test('非 verify_webhook 场景缺少签名时拒绝接收', async () => {
    await seedDouyinAccount();

    const payload = {
      event: 'hotel_spot.order.pay_notify',
      content: {
        order_id: 'OUT-001'
      }
    };

    const response = await request(app)
      .post('/ota/douyin/webhook')
      .send(payload);

    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe('DOUYIN_WEBHOOK_SIGNATURE_REQUIRED');
  });

  test('verify_webhook 支持 text/plain JSON 字符串回调', async () => {
    await seedDouyinAccount();

    const payload = {
      event: 'verify_webhook',
      content: {
        challenge: 'challenge-text-plain-001'
      }
    };

    const response = await request(app)
      .post('/ota/douyin/webhook')
      .set('content-type', 'text/plain')
      .send(JSON.stringify(payload));

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(parseJsonTextResponse(response)).toEqual({
      challenge: 'challenge-text-plain-001'
    });
  });

  test('verify_webhook 支持 query.challenge 回调参数', async () => {
    await seedDouyinAccount();

    const response = await request(app)
      .post('/ota/douyin/webhook?challenge=query-challenge-001')
      .set('content-type', 'application/json')
      .send({});

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(parseJsonTextResponse(response)).toEqual({
      challenge: 'query-challenge-001'
    });
  });

  test('verify_webhook 数字 challenge 按原始类型返回', async () => {
    await seedDouyinAccount();

    const payload = {
      event: 'verify_webhook',
      content: {
        challenge: 1773051210
      }
    };

    const response = await request(app)
      .post('/ota/douyin/webhook')
      .set(buildWebhookSignedHeaders(payload))
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(parseJsonTextResponse(response)).toEqual({
      challenge: 1773051210
    });
  });
});

describe('飞猪占位接口', () => {
  test('飞猪创单接口返回未实现', async () => {
    const response = await request(app)
      .post('/ota/fliggy/order/create')
      .send({});

    expect(response.statusCode).toBe(501);
    expect(response.body.error.code).toBe('FLIGGY_NOT_IMPLEMENTED');
  });
});
