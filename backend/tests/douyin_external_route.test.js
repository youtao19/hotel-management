const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { URL } = require('url');

process.env.DOUYIN_CLIENT_KEY = 'DY_CLIENT_TEST';
process.env.DOUYIN_CLIENT_SECRET = 'DY_SECRET_TEST';

const { query } = require('../database/postgreDB/pg');
const { createDouyinExternalRouter } = require('../routes/douyinExternalRoute');

function captureRawBody(req, _res, buf) {
  req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
}

function buildTestApp(redisClient) {
  const app = express();
  app.use(express.json({
    strict: false,
    verify: captureRawBody
  }));
  app.use('/douyin', createDouyinExternalRouter({
    redisProvider: {
      getClient: () => redisClient
    }
  }));
  return app;
}

function buildWebhookSign(body) {
  return crypto
    .createHash('sha1')
    .update(process.env.DOUYIN_CLIENT_SECRET + body.split(/\r?\n/).join(''))
    .digest('hex');
}

function buildSpiSign(urlPath, body) {
  const url = new URL(urlPath, 'http://localhost');
  const keys = [];

  for (const [key] of url.searchParams.entries()) {
    if (key.toLowerCase() === 'sign') {
      continue;
    }
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }

  keys.sort();

  let signString = process.env.DOUYIN_CLIENT_SECRET;
  for (const key of keys) {
    const values = url.searchParams.getAll(key).sort();
    for (const value of values) {
      signString += `&${key}=${value}`;
    }
  }
  signString += `&http_body=${body}`;

  return crypto.createHash('sha256').update(signString).digest('hex').toLowerCase();
}

async function seedPriceVolumeData() {
  await query("DELETE FROM orders WHERE room_type = 'PV_TEST'");
  await query("DELETE FROM ota_channel_mappings WHERE channel_item_id LIKE 'DY_RATE_PV_%'");
  await query("DELETE FROM rate_plans WHERE room_type_code = 'PV_TEST'");
  await query("DELETE FROM douyin_room_type_mapping WHERE local_room_type = 'PV_TEST'");
  await query("DELETE FROM douyin_physical_rooms WHERE room_id = 'DY_ROOM_PV_001'");
  await query("DELETE FROM rooms WHERE type_code = 'PV_TEST'");
  await query("DELETE FROM room_types WHERE type_code = 'PV_TEST'");

  await query(
    `
      INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
      VALUES ($1, $2, $3, $4, $5)
    `,
    ['PV_TEST', '价量态测试房型', 399, '抖音价量态测试', false]
  );
  await query(
    `
      INSERT INTO rooms (room_number, type_code, status, price, is_closed)
      VALUES
        ('PV101', 'PV_TEST', 'available', 399, false),
        ('PV102', 'PV_TEST', 'repair', 399, false),
        ('PV103', 'PV_TEST', 'available', 399, false),
        ('PV104', 'PV_TEST', 'available', 399, true)
    `
  );
  const ratePlanResult = await query(
    `
      INSERT INTO rate_plans (room_type_code, name, base_price, status, sales_type, currency)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    ['PV_TEST', '价量态测试套餐', 399, 1, 1, 'CNY']
  );
  await query(
    `
      INSERT INTO ota_channel_mappings
        (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    ['RATE_PLAN', ratePlanResult.rows[0].id, 'DOUYIN', 'DY_RATE_PV_001', { hotel_id: 'DY_HOTEL_PV_001' }, 1]
  );
  await query(
    `
      INSERT INTO douyin_physical_rooms
        (account_id, room_id, room_name, status, raw_payload)
      VALUES ($1, $2, $3, $4, $5)
    `,
    ['DY_ACCOUNT_PV_001', 'DY_ROOM_PV_001', '抖音价量态房型', 1, { hotel_id: 'DY_HOTEL_PV_001' }]
  );
  await query(
    `
      INSERT INTO douyin_room_type_mapping (douyin_room_id, douyin_room_name, local_room_type)
      VALUES ($1, $2, $3)
    `,
    ['DY_ROOM_PV_001', '抖音价量态房型', 'PV_TEST']
  );
  await query(
    `
      INSERT INTO orders (
        order_id, order_source, guest_name, room_type, room_number,
        check_in_date, check_out_date, stay_date, status, total_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    ['PV_ORDER_001', 'manual', '价量态客人', 'PV_TEST', 'PV101', '2026-04-24', '2026-04-25', '2026-04-24', 'pending', 399]
  );
}

describe('抖音 Webhooks 与价量态 SPI', () => {
  let redisClient;
  let app;

  beforeEach(async () => {
    redisClient = {
      set: jest.fn(async () => 'OK')
    };
    app = buildTestApp(redisClient);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Webhook 验证请求验签成功后返回 challenge', async () => {
    const body = JSON.stringify({
      event: 'verify_webhook',
      client_key: 'DY_CLIENT_TEST',
      content: {
        challenge: 12345
      }
    });

    const response = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('X-Douyin-Signature', buildWebhookSign(body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ challenge: 12345 });
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test('Webhook 普通消息会双层解析 content 并记录幂等', async () => {
    const body = JSON.stringify({
      event: 'life_trade_order_notify',
      client_key: 'DY_CLIENT_TEST',
      content: JSON.stringify({
        action: 'pay_success',
        order: {
          order_id: 'DY_ORDER_001'
        }
      }),
      log_id: 'DY_LOG_001'
    });

    const response = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('Msg-Id', 'MSG_001')
      .set('X-Douyin-Signature', buildWebhookSign(body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(0);
    expect(redisClient.set).toHaveBeenCalledWith('douyin:webhook:msg:MSG_001', '1', {
      NX: true,
      EX: 86400
    });
    expect(console.log).toHaveBeenCalledWith(
      '[Douyin Webhook] 已接收消息:',
      expect.objectContaining({
        event: 'life_trade_order_notify',
        msgId: 'MSG_001',
        content: expect.objectContaining({
          action: 'pay_success'
        })
      })
    );
  });

  test('Webhook 重复 Msg-Id 直接返回成功', async () => {
    redisClient.set.mockResolvedValueOnce(null);
    const body = JSON.stringify({
      event: 'life_trade_order_notify',
      client_key: 'DY_CLIENT_TEST',
      content: JSON.stringify({ action: 'pay_success' })
    });

    const response = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('Msg-Id', 'MSG_DUP')
      .set('X-Douyin-Signature', buildWebhookSign(body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      '[Douyin Webhook] 重复消息已跳过:',
      expect.objectContaining({ msgId: 'MSG_DUP' })
    );
  });

  test('Webhook 签名错误返回 401', async () => {
    const response = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('X-Douyin-Signature', 'bad-sign')
      .send(JSON.stringify({ event: 'verify_webhook', content: { challenge: 1 } }));

    expect(response.statusCode).toBe(401);
  });

  test('Webhook 普通消息缺少 Msg-Id 时不继续处理', async () => {
    const body = JSON.stringify({
      event: 'life_trade_order_notify',
      client_key: 'DY_CLIENT_TEST',
      content: JSON.stringify({ action: 'pay_success' })
    });

    const response = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('X-Douyin-Signature', buildWebhookSign(body))
      .send(body);

    expect(response.statusCode).toBe(400);
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test('SPI 签名正确时返回官方 room_rates 结构', async () => {
    await seedPriceVolumeData();

    const body = JSON.stringify({
      rate_plan_ids: ['DY_RATE_PV_001'],
      date_range: {
        start: '2026-04-24',
        end: '2026-04-24'
      }
    });
    const path = '/douyin/spi/price-volume?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

    const response = await request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', buildSpiSign(path, body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(0);
    expect(response.body.data.room_rates).toHaveLength(1);
    expect(response.body.data.room_rates[0]).toMatchObject({
      rate_plan_id: 'DY_RATE_PV_001',
      status: true
    });
    expect(response.body.data.room_rates[0].rate_avail_infos[0]).toMatchObject({
      timerange: {
        start: '2026-04-24',
        end: '2026-04-24'
      },
      original_amount: 39900,
      retail_amount: 39900,
      currency: 'CNY',
      available: true,
      inventory: 1
    });
  });

  test('SPI 签名错误返回 401', async () => {
    const body = JSON.stringify({
      rate_plan_ids: ['DY_RATE_PV_001'],
      date_range: {
        start: '2026-04-24',
        end: '2026-04-24'
      }
    });

    const response = await request(app)
      .post('/douyin/spi/price-volume?client_key=DY_CLIENT_TEST&timestamp=1777000000000')
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', 'bad-sign')
      .send(body);

    expect(response.statusCode).toBe(401);
  });

  test('SPI 未知 rate_plan_id 返回售卖计划级错误', async () => {
    const body = JSON.stringify({
      rate_plan_ids: ['UNKNOWN_RATE_PLAN'],
      date_range: {
        start: '2026-04-24',
        end: '2026-04-24'
      }
    });
    const path = '/douyin/spi/price-volume?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

    const response = await request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', buildSpiSign(path, body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(0);
    expect(response.body.data.room_rates[0]).toMatchObject({
      rate_plan_id: 'UNKNOWN_RATE_PLAN',
      status: false,
      sub_error: '售卖计划ID错误',
      sub_error_code: 60021
    });
  });
});
