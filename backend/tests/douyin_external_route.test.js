const crypto = require('crypto');
const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { URL } = require('url');

process.env.DOUYIN_CLIENT_KEY = 'DY_CLIENT_TEST';
process.env.DOUYIN_CLIENT_SECRET = 'DY_SECRET_TEST';

const { query } = require('../database/postgreDB/pg');
const { createDouyinExternalRouter } = require('../modules/douyin/external/external.routes');

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

async function seedBookableData() {
  await query("DELETE FROM orders WHERE room_type = 'BK_TEST'");
  await query("DELETE FROM ota_channel_mappings WHERE channel_item_id LIKE 'DY_RATE_BK_%'");
  await query("DELETE FROM rate_plans WHERE room_type_code = 'BK_TEST'");
  await query("DELETE FROM douyin_room_type_mapping WHERE local_room_type = 'BK_TEST'");
  await query("DELETE FROM douyin_physical_rooms WHERE room_id = 'DY_ROOM_BK_001'");
  await query("DELETE FROM rooms WHERE type_code = 'BK_TEST'");
  await query("DELETE FROM room_types WHERE type_code = 'BK_TEST'");

  await query(
    `
      INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
      VALUES ($1, $2, $3, $4, $5)
    `,
    ['BK_TEST', '可订检查测试房型', 399, '抖音可订检查测试', false]
  );
  await query(
    `
      INSERT INTO rooms (room_number, type_code, status, price, is_closed)
      VALUES
        ('BK101', 'BK_TEST', 'available', 399, false),
        ('BK102', 'BK_TEST', 'available', 399, false),
        ('BK103', 'BK_TEST', 'repair', 399, false)
    `
  );
  const ratePlanResult = await query(
    `
      INSERT INTO rate_plans (room_type_code, name, base_price, status, sales_type, currency)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    ['BK_TEST', '可订检查测试套餐', 399, 1, 1, 'CNY']
  );
  await query(
    `
      INSERT INTO ota_channel_mappings
        (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    ['RATE_PLAN', ratePlanResult.rows[0].id, 'DOUYIN', 'DY_RATE_BK_001', { hotel_id: 'DY_HOTEL_BK_001' }, 1]
  );
  await query(
    `
      INSERT INTO douyin_physical_rooms
        (account_id, room_id, room_name, status, raw_payload)
      VALUES ($1, $2, $3, $4, $5)
    `,
    ['DY_ACCOUNT_BK_001', 'DY_ROOM_BK_001', '抖音可订检查房型', 1, { hotel_id: 'DY_HOTEL_BK_001' }]
  );
  await query(
    `
      INSERT INTO douyin_room_type_mapping (douyin_room_id, douyin_room_name, local_room_type)
      VALUES ($1, $2, $3)
    `,
    ['DY_ROOM_BK_001', '抖音可订检查房型', 'BK_TEST']
  );
  await query(
    `
      INSERT INTO orders (
        order_id, order_source, guest_name, room_type, room_number,
        check_in_date, check_out_date, stay_date, status, total_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    ['BK_ORDER_001', 'manual', '可订检查客人', 'BK_TEST', 'BK101', '2026-04-24', '2026-04-25', '2026-04-24', 'pending', 399]
  );
}

describe('抖音 Webhooks 与价量态 SPI', () => {
  let redisClient;
  let app;
  let logFilePath;

  beforeEach(async () => {
    logFilePath = path.join(os.tmpdir(), `douyin-callback-logid-${process.pid}-${Date.now()}.jsonl`);
    process.env.DOUYIN_CALLBACK_LOG_FILE = logFilePath;
    redisClient = {
      set: jest.fn(async () => 'OK')
    };
    app = buildTestApp(redisClient);
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
    const logRecords = await readJsonLines(logFilePath);
    expect(logRecords).toEqual([
      expect.objectContaining({
        type: 'webhook',
        stage: 'processed',
        logId: 'DY_LOG_001',
        event: 'life_trade_order_notify',
        msgId: 'MSG_001',
        contentAction: 'pay_success'
      })
    ]);
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
      .set('x-bytedance-logid', 'DY_SPI_LOG_001')
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(0);
    expect(response.body.data.status).toBe(true);
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
    expect(console.log).toHaveBeenCalledWith(
      '[Douyin SPI] 已处理价量态拉取:',
      expect.objectContaining({
        logId: 'DY_SPI_LOG_001',
        ratePlanIds: ['DY_RATE_PV_001'],
        errorCode: 0,
        status: true,
        roomRateCount: 1
      })
    );
    const logRecords = await readJsonLines(logFilePath);
    expect(logRecords).toEqual([
      expect.objectContaining({
        type: 'spi_price_volume',
        stage: 'processed',
        logId: 'DY_SPI_LOG_001',
        ratePlanIds: ['DY_RATE_PV_001'],
        response: expect.objectContaining({
          errorCode: 0,
          status: true,
          roomRateCount: 1
        })
      })
    ]);
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
      .set('x-bytedance-logid', 'DY_SPI_BAD_SIGN_LOG_001')
      .send(body);

    expect(response.statusCode).toBe(401);
    const logRecords = await readJsonLines(logFilePath);
    expect(logRecords).toEqual([
      expect.objectContaining({
        type: 'spi_price_volume',
        stage: 'signature_failed',
        logId: 'DY_SPI_BAD_SIGN_LOG_001',
        ratePlanIds: ['DY_RATE_PV_001']
      })
    ]);
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
    expect(response.body.data.status).toBe(true);
    expect(response.body.data.room_rates[0]).toMatchObject({
      rate_plan_id: 'UNKNOWN_RATE_PLAN',
      status: false,
      sub_error: '售卖计划ID错误',
      sub_error_code: 60021
    });
  });

  test('预售券可订检查成功返回 error_code 0', async () => {
    await seedBookableData();

    const body = JSON.stringify({
      rate_plan_id: 'DY_RATE_BK_001',
      biz_type: 2011,
      check_in_date: '2026-04-24',
      check_out_date: '2026-04-25',
      number_of_units: 1,
      total_amount: 39900
    });
    const path = '/douyin/spi/bookable?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

    const response = await request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', buildSpiSign(path, body))
      .set('x-bytedance-logid', 'DY_SPI_BOOKABLE_OK_LOG_001')
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: {
        error_code: 0,
        description: 'success'
      }
    });
    expect(console.log).toHaveBeenCalledWith(
      '[Douyin SPI] 已处理预售券可订检查:',
      expect.objectContaining({
        logId: 'DY_SPI_BOOKABLE_OK_LOG_001',
        ratePlanId: 'DY_RATE_BK_001',
        errorCode: 0,
        stockAndAmountCount: 0
      })
    );
  });

  test('预售券可订检查库存不足返回 error_code 4 和 ari.stock_and_amount', async () => {
    await seedBookableData();

    const body = JSON.stringify({
      rate_plan_id: 'DY_RATE_BK_001',
      biz_type: 2011,
      check_in_date: '2026-04-24',
      check_out_date: '2026-04-25',
      number_of_units: 2,
      total_amount: 79800
    });
    const path = '/douyin/spi/bookable?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

    const response = await request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', buildSpiSign(path, body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(4);
    expect(response.body.data.ari.stock_and_amount).toHaveLength(1);
    expect(response.body.data.ari.stock_and_amount[0]).toMatchObject({
      room_id: 'DY_ROOM_BK_001',
      rate_plan_id: 'DY_RATE_BK_001',
      timerange: {
        start: '2026-04-24',
        end: '2026-04-25'
      },
      original_amount: 39900,
      currency: 'CNY',
      available: true,
      inventory: 1
    });
  });

  test('预售券可订检查价格不一致返回 error_code 8 和 ari.stock_and_amount', async () => {
    await seedBookableData();

    const body = JSON.stringify({
      rate_plan_id: 'DY_RATE_BK_001',
      biz_type: 2011,
      check_in_date: '2026-04-24',
      check_out_date: '2026-04-25',
      number_of_units: 1,
      total_amount: 39800
    });
    const path = '/douyin/spi/bookable?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

    const response = await request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', buildSpiSign(path, body))
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.error_code).toBe(8);
    expect(response.body.data.ari.stock_and_amount[0]).toMatchObject({
      room_id: 'DY_ROOM_BK_001',
      rate_plan_id: 'DY_RATE_BK_001',
      original_amount: 39900,
      available: true,
      inventory: 1
    });
  });

  test('预售券可订检查签名错误返回 401', async () => {
    const body = JSON.stringify({
      rate_plan_id: 'DY_RATE_BK_001',
      biz_type: 2011,
      check_in_date: '2026-04-24',
      check_out_date: '2026-04-25',
      number_of_units: 1,
      total_amount: 39900
    });

    const response = await request(app)
      .post('/douyin/spi/bookable?client_key=DY_CLIENT_TEST&timestamp=1777000000000')
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', 'bad-sign')
      .set('x-bytedance-logid', 'DY_SPI_BOOKABLE_BAD_SIGN_LOG_001')
      .send(body);

    expect(response.statusCode).toBe(401);
    const logRecords = await readJsonLines(logFilePath);
    expect(logRecords).toEqual([
      expect.objectContaining({
        type: 'spi_bookable',
        stage: 'signature_failed',
        logId: 'DY_SPI_BOOKABLE_BAD_SIGN_LOG_001',
        ratePlanId: 'DY_RATE_BK_001'
      })
    ]);
  });
});
