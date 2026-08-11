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

function buildTestApp(redisClient, options = {}) {
  const app = express();
  app.use(express.json({
    strict: false,
    verify: captureRawBody
  }));
  app.use('/douyin', createDouyinExternalRouter({
    redisProvider: {
      getClient: () => redisClient
    },
    scheduleBookingConfirmation: options.scheduleBookingConfirmation,
    scheduleNegotiatedCancelAudit: options.scheduleNegotiatedCancelAudit,
    autoConfirmEnabled: options.autoConfirmEnabled
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
  await query("DELETE FROM douyin_calendar_room_prices WHERE rate_plan_id IN (SELECT id FROM rate_plans WHERE room_type_code = 'BK_TEST')");
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

  return ratePlanResult.rows[0].id;
}

describe('抖音 Webhooks 与价量态 SPI', () => {
  let redisClient;
  let app;
  let logFilePath;
  let scheduleBookingConfirmation;

  beforeEach(async () => {
    await query('DELETE FROM system_notifications');
    logFilePath = path.join(os.tmpdir(), `douyin-callback-logid-${process.pid}-${Date.now()}.jsonl`);
    process.env.DOUYIN_CALLBACK_LOG_FILE = logFilePath;
    redisClient = {
      set: jest.fn(async () => 'OK')
    };
    scheduleBookingConfirmation = jest.fn();
    app = buildTestApp(redisClient, { scheduleBookingConfirmation });
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

  test('预售券审核结果会创建系统通知，并以 Msg-Id 持久化去重', async () => {
    const body = JSON.stringify({
      event: 'life_hotel_presale_audit_result',
      client_key: 'DY_CLIENT_TEST',
      content: JSON.stringify({
        id: 'DY_VOUCHER_001',
        out_id: 'LOCAL_VOUCHER_001',
        audit_result: 2,
        audit_message: '商品图片不符合要求'
      }),
      log_id: 'DY_AUDIT_LOG_001'
    });

    const firstResponse = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('Msg-Id', 'DY_AUDIT_MSG_001')
      .set('X-Douyin-Signature', buildWebhookSign(body))
      .send(body);
    const duplicateResponse = await request(app)
      .post('/douyin/webhooks')
      .set('Content-Type', 'application/json')
      .set('Msg-Id', 'DY_AUDIT_MSG_001')
      .set('X-Douyin-Signature', buildWebhookSign(body))
      .send(body);

    expect(firstResponse.statusCode).toBe(200);
    expect(duplicateResponse.statusCode).toBe(200);
    expect(redisClient.set).not.toHaveBeenCalled();

    const notificationResult = await query(
      'SELECT title, content, level, is_read FROM system_notifications WHERE external_message_id = $1',
      ['DY_AUDIT_MSG_001']
    );
    expect(notificationResult.rows).toEqual([
      expect.objectContaining({
        title: '抖音预售券审核未通过',
        content: '预售券：LOCAL_VOUCHER_001；商品图片不符合要求',
        level: 'warning',
        is_read: false
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

  test('酒店预约单可订检查按套餐价格返回 error_code 8', async () => {
    await seedBookableData();

    const body = JSON.stringify({
      rate_plan_id: 'DY_RATE_BK_001',
      biz_type: 2012,
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
    expect(response.body.data.ari.stock_and_amount[0]).toMatchObject({ original_amount: 39900 });
  });

  test('日历房可订检查按最新日历房价返回 error_code 8', async () => {
    const localRatePlanId = await seedBookableData();
    await query(
      `
        INSERT INTO douyin_calendar_room_prices (rate_plan_id, stay_date, original_amount)
        VALUES ($1, $2, $3)
      `,
      [localRatePlanId, '2026-04-24', 398]
    );

    const body = JSON.stringify({
      rate_plan_id: 'DY_RATE_BK_001',
      biz_type: 2021,
      check_in_date: '2026-04-24',
      check_out_date: '2026-04-25',
      number_of_units: 1,
      total_amount: 39700
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
      original_amount: 39800,
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

  test('预售券支付通知验签后更新本地订单，重复通知只确认成功', async () => {
    const localOrderId = 'DYPS_PAY_NOTICE_TEST_001';
    const douyinOrderId = 'DY_PAY_NOTICE_TEST_001';
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, raw_payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [localOrderId, douyinOrderId, 2011, 'CREATED', JSON.stringify({ order_id: douyinOrderId })]
    );

    try {
      const body = JSON.stringify({
        order_id: douyinOrderId,
        order_out_id: localOrderId,
        biz_type: 2011,
        pay_time_unix: 1785561600,
        currency: 'CNY',
        pay_amount: 19900
      });
      const path = '/douyin/spi/presale-order/payment-notice?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

      const firstResponse = await request(app)
        .post(path)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(path, body))
        .set('x-bytedance-logid', 'DY_SPI_PAY_NOTICE_LOG_001')
        .send(body);
      const duplicateResponse = await request(app)
        .post(path)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(path, body))
        .set('x-bytedance-logid', 'DY_SPI_PAY_NOTICE_LOG_002')
        .send(body);

      expect(firstResponse.statusCode).toBe(200);
      expect(firstResponse.body).toEqual({ data: { error_code: 0, description: 'success' } });
      expect(duplicateResponse.statusCode).toBe(200);
      const orderResult = await query(
        'SELECT order_stage, douyin_log_id, raw_payload FROM douyin_presale_orders WHERE order_id = $1',
        [localOrderId]
      );
      expect(orderResult.rows[0]).toMatchObject({
        order_stage: 'PAID',
        douyin_log_id: 'DY_SPI_PAY_NOTICE_LOG_002',
        raw_payload: expect.objectContaining({
          payment_notice: expect.objectContaining({
            pay_amount: 19900,
            pay_time_unix: 1785561600
          })
        })
      });
      const logRecords = await readJsonLines(logFilePath);
      expect(logRecords).toEqual([
        expect.objectContaining({ type: 'spi_presale_payment_notice', stage: 'processed', logId: 'DY_SPI_PAY_NOTICE_LOG_001' }),
        expect.objectContaining({ type: 'spi_presale_payment_notice', stage: 'duplicate', logId: 'DY_SPI_PAY_NOTICE_LOG_002' })
      ]);
    } finally {
      await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    }
  });

  test('创建预约单验签后返回异步接单，并写入本地占房记录', async () => {
    const sourceOrderId = 'DY_PRESALE_BOOKING_SOURCE_001';
    const bookingOrderId = 'DY_BOOKING_CREATE_001';
    await seedBookableData();
    await query('DELETE FROM douyin_presale_booking_orders WHERE ota_order_id = $1', [bookingOrderId]);
    await query('DELETE FROM douyin_presale_orders WHERE ota_order_id = $1', [sourceOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, raw_payload
       ) VALUES ($1, $2, 2011, 'PAID', $3::jsonb)`,
      ['DYPS_BOOKING_SOURCE_001', sourceOrderId, JSON.stringify({ order_id: sourceOrderId })]
    );

    try {
      const body = JSON.stringify({
        order_id: bookingOrderId,
        source_order_id: sourceOrderId,
        rate_plan_id: 'DY_RATE_BK_001',
        hotel_id: 'DY_HOTEL_BK_001',
        room_id: 'DY_ROOM_BK_001',
        biz_type: 2012,
        check_in_date: '2026-04-24',
        check_out_date: '2026-04-25',
        number_of_units: 1,
        number_of_guests: 1,
        total_amount: 39900,
        currency: 'CNY',
        daily_rates: [{
          period_start_date: '2026-04-24',
          period_end_date: '2026-04-25',
          original_amount: 39900
        }]
      });
      const path = '/douyin/spi/presale-order/booking?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const response = await request(app)
        .post(path)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(path, body))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_CREATE_LOG_001')
        .send(body);

      expect(response.statusCode).toBe(200);
      expect(response.body.data).toEqual(expect.objectContaining({
        error_code: 0,
        order_id: bookingOrderId,
        confirm_info: expect.objectContaining({ confirm_mode: 2 })
      }));
      expect(scheduleBookingConfirmation).toHaveBeenCalledWith(response.body.data.order_out_id);
      const bookingResult = await query(
        `SELECT source_order_id, booking_status, confirm_status, create_log_id, assigned_rooms
         FROM douyin_presale_booking_orders
         WHERE ota_order_id = $1`,
        [bookingOrderId]
      );
      expect(bookingResult.rows[0]).toMatchObject({
        source_order_id: sourceOrderId,
        booking_status: 'CREATED',
        confirm_status: 'PENDING',
        create_log_id: 'DY_SPI_BOOKING_CREATE_LOG_001',
        assigned_rooms: ['BK102']
      });
      const localOrderResult = await query(
        `SELECT room_number, status, order_source
         FROM orders
         WHERE id_source = $1 AND order_source = 'douyin_presale'`,
        [bookingOrderId]
      );
      expect(localOrderResult.rows).toEqual([
        expect.objectContaining({ room_number: 'BK102', status: 'pending', order_source: 'douyin_presale' })
      ]);

      const refundBody = JSON.stringify({
        order_id: bookingOrderId,
        order_out_id: response.body.data.order_out_id,
        refund_total_amount: 0,
        refund_amount: 0,
        user_refund_amount: 0,
        biz_type: 2012,
        refund_type: 11
      });
      const refundPath = '/douyin/spi/presale-order/refund-result?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const refundResponse = await request(app)
        .post(refundPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(refundPath, refundBody))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_REFUND_RESULT_LOG_001')
        .send(refundBody);

      expect(refundResponse.body).toEqual({ data: { error_code: 0, description: 'success' } });
      const refundedBookingResult = await query(
        `SELECT booking_status, refund_status, refund_log_id
         FROM douyin_presale_booking_orders
         WHERE ota_order_id = $1`,
        [bookingOrderId]
      );
      expect(refundedBookingResult.rows[0]).toEqual(expect.objectContaining({
        booking_status: 'REFUNDED',
        refund_status: 'COMPLETED',
        refund_log_id: 'DY_SPI_BOOKING_REFUND_RESULT_LOG_001'
      }));
      const refundedLocalOrderResult = await query(
        `SELECT status FROM orders
         WHERE id_source = $1 AND order_source = 'douyin_presale'`,
        [bookingOrderId]
      );
      expect(refundedLocalOrderResult.rows).toEqual([{ status: 'cancelled' }]);
      const notificationResult = await query(
        `SELECT booking_order_id, refund_amount, user_refund_amount, match_status, douyin_log_id
         FROM douyin_presale_refund_notifications
         WHERE ota_order_id = $1`,
        [bookingOrderId]
      );
      expect(notificationResult.rows).toEqual([expect.objectContaining({
        booking_order_id: expect.any(Number),
        refund_amount: 0,
        user_refund_amount: 0,
        match_status: 'MATCHED',
        douyin_log_id: 'DY_SPI_BOOKING_REFUND_RESULT_LOG_001'
      })]);
    } finally {
      await query('DELETE FROM douyin_presale_refund_notifications WHERE ota_order_id = $1', [bookingOrderId]);
      await query("DELETE FROM orders WHERE id_source = $1 AND order_source = 'douyin_presale'", [bookingOrderId]);
      await query('DELETE FROM douyin_presale_booking_orders WHERE ota_order_id = $1', [bookingOrderId]);
      await query('DELETE FROM douyin_presale_orders WHERE ota_order_id = $1', [sourceOrderId]);
    }
  });

  test('关闭自动确认时创建预约单不会调用确认接单接口', async () => {
    const sourceOrderId = 'DY_PRESALE_BOOKING_TIMEOUT_SOURCE_001';
    const bookingOrderId = 'DY_BOOKING_TIMEOUT_001';
    const noConfirmScheduler = jest.fn();
    const noConfirmApp = buildTestApp(redisClient, {
      scheduleBookingConfirmation: noConfirmScheduler,
      autoConfirmEnabled: false
    });
    await seedBookableData();
    await query('DELETE FROM douyin_presale_booking_orders WHERE ota_order_id = $1', [bookingOrderId]);
    await query('DELETE FROM douyin_presale_orders WHERE ota_order_id = $1', [sourceOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (order_id, ota_order_id, biz_type, order_stage, raw_payload)
       VALUES ($1, $2, 2011, 'PAID', $3::jsonb)`,
      ['DYPS_BOOKING_TIMEOUT_SOURCE_001', sourceOrderId, JSON.stringify({ order_id: sourceOrderId })]
    );

    try {
      const body = JSON.stringify({
        order_id: bookingOrderId,
        source_order_id: sourceOrderId,
        rate_plan_id: 'DY_RATE_BK_001',
        hotel_id: 'DY_HOTEL_BK_001',
        room_id: 'DY_ROOM_BK_001',
        biz_type: 2012,
        check_in_date: '2026-04-24',
        check_out_date: '2026-04-25',
        number_of_units: 1,
        number_of_guests: 1,
        total_amount: 39900,
        daily_rates: [{ period_start_date: '2026-04-24', period_end_date: '2026-04-25', original_amount: 39900 }]
      });
      const requestPath = '/douyin/spi/presale-order/booking?client_key=DY_CLIENT_TEST&timestamp=1777000000001';
      const response = await request(noConfirmApp)
        .post(requestPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(requestPath, body))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_TIMEOUT_LOG_001')
        .send(body);

      expect(response.body.data.confirm_info.confirm_mode).toBe(2);
      expect(noConfirmScheduler).not.toHaveBeenCalled();
      const bookingResult = await query(
        `SELECT booking_status, confirm_status, confirm_log_id
         FROM douyin_presale_booking_orders WHERE ota_order_id = $1`,
        [bookingOrderId]
      );
      expect(bookingResult.rows[0]).toEqual(expect.objectContaining({
        booking_status: 'CREATED',
        confirm_status: 'PENDING',
        confirm_log_id: null
      }));
    } finally {
      await query("DELETE FROM orders WHERE id_source = $1 AND order_source = 'douyin_presale'", [bookingOrderId]);
      await query('DELETE FROM douyin_presale_booking_orders WHERE ota_order_id = $1', [bookingOrderId]);
      await query('DELETE FROM douyin_presale_orders WHERE ota_order_id = $1', [sourceOrderId]);
    }
  });

  test('加价预约未支付超时取消时释放占房，并按 cancel_id 幂等', async () => {
    const sourceOrderId = 'DY_PRESALE_MARKUP_SOURCE_001';
    const bookingOrderId = 'DY_BOOKING_MARKUP_TIMEOUT_001';
    const cancelId = 'DY_BOOKING_MARKUP_CANCEL_001';
    const noConfirmScheduler = jest.fn();
    const noConfirmApp = buildTestApp(redisClient, { scheduleBookingConfirmation: noConfirmScheduler, autoConfirmEnabled: false });
    await seedBookableData();
    await query('DELETE FROM douyin_presale_booking_orders WHERE ota_order_id = $1', [bookingOrderId]);
    await query('DELETE FROM douyin_presale_orders WHERE ota_order_id = $1', [sourceOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (order_id, ota_order_id, biz_type, order_stage, raw_payload)
       VALUES ($1, $2, 2011, 'PAID', $3::jsonb)`,
      ['DYPS_MARKUP_SOURCE_001', sourceOrderId, JSON.stringify({ order_id: sourceOrderId })]
    );

    try {
      const bookingBody = JSON.stringify({
        order_id: bookingOrderId,
        source_order_id: sourceOrderId,
        rate_plan_id: 'DY_RATE_BK_001',
        hotel_id: 'DY_HOTEL_BK_001',
        room_id: 'DY_ROOM_BK_001',
        biz_type: 2012,
        check_in_date: '2026-04-24',
        check_out_date: '2026-04-25',
        number_of_units: 1,
        number_of_guests: 1,
        total_amount: 39900,
        daily_rates: [{ period_start_date: '2026-04-24', period_end_date: '2026-04-25', original_amount: 39900, daily_add_amount: 1200 }]
      });
      const bookingPath = '/douyin/spi/presale-order/booking?client_key=DY_CLIENT_TEST&timestamp=1777000000002';
      const bookingResponse = await request(noConfirmApp)
        .post(bookingPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(bookingPath, bookingBody))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_MARKUP_LOG_001')
        .send(bookingBody);
      const localOrderId = bookingResponse.body.data.order_out_id;

      const cancelBody = JSON.stringify({
        order_id: bookingOrderId,
        order_out_id: localOrderId,
        cancel_id: cancelId,
        cancel_type: 2,
        biz_type: 2012,
        after_sale_type: 2,
        refund_type: 11
      });
      const cancelPath = '/douyin/spi/order/cancel?client_key=DY_CLIENT_TEST&timestamp=1777000000002';
      const firstResponse = await request(noConfirmApp)
        .post(cancelPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(cancelPath, cancelBody))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_MARKUP_CANCEL_LOG_001')
        .send(cancelBody);
      const duplicateResponse = await request(noConfirmApp)
        .post(cancelPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(cancelPath, cancelBody))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_MARKUP_CANCEL_LOG_002')
        .send(cancelBody);

      expect(firstResponse.body.data.cancel_result).toBe(1);
      expect(duplicateResponse.body.data.cancel_result).toBe(1);
      const bookingResult = await query(
        `SELECT booking_status, payment_status, add_amount, cancel_id, cancel_status, cancel_log_id
         FROM douyin_presale_booking_orders WHERE ota_order_id = $1`,
        [bookingOrderId]
      );
      expect(bookingResult.rows[0]).toEqual(expect.objectContaining({
        booking_status: 'CANCELLED', payment_status: 'CANCELLED', add_amount: '1200',
        cancel_id: cancelId, cancel_status: 'CANCELLED', cancel_log_id: 'DY_SPI_BOOKING_MARKUP_CANCEL_LOG_001'
      }));
      const localOrderResult = await query(
        `SELECT status FROM orders WHERE id_source = $1 AND order_source = 'douyin_presale'`,
        [bookingOrderId]
      );
      expect(localOrderResult.rows).toEqual([{ status: 'cancelled' }]);
    } finally {
      await query("DELETE FROM orders WHERE id_source = $1 AND order_source = 'douyin_presale'", [bookingOrderId]);
      await query('DELETE FROM douyin_presale_booking_orders WHERE ota_order_id = $1', [bookingOrderId]);
      await query('DELETE FROM douyin_presale_orders WHERE ota_order_id = $1', [sourceOrderId]);
    }
  });

  test('预售券取消订单验签后写入取消状态，相同 cancel_id 幂等成功', async () => {
    const localOrderId = 'DYPS_CANCEL_TEST_001';
    const douyinOrderId = 'DY_CANCEL_TEST_001';
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, raw_payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [localOrderId, douyinOrderId, 2011, 'PAID', JSON.stringify({ order_id: douyinOrderId })]
    );

    try {
      const body = JSON.stringify({
        order_id: douyinOrderId,
        order_out_id: localOrderId,
        cancel_id: 'DY_CANCEL_REQUEST_001',
        cancel_type: 1,
        biz_type: 2011,
        after_sale_type: 1,
        refund_type: 11
      });
      const path = '/douyin/spi/order/cancel?client_key=DY_CLIENT_TEST&timestamp=1777000000000';

      const firstResponse = await request(app)
        .post(path)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(path, body))
        .set('x-bytedance-logid', 'DY_SPI_CANCEL_LOG_001')
        .send(body);
      const duplicateResponse = await request(app)
        .post(path)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(path, body))
        .set('x-bytedance-logid', 'DY_SPI_CANCEL_LOG_002')
        .send(body);

      expect(firstResponse.statusCode).toBe(200);
      expect(firstResponse.body).toEqual({
        data: { error_code: 0, description: 'success', cancel_mode: 1, cancel_result: 1, reason: '' }
      });
      expect(duplicateResponse.body.data.cancel_result).toBe(1);
      const orderResult = await query(
        'SELECT order_stage, cancel_id, cancel_status, cancel_log_id, cancel_payload FROM douyin_presale_orders WHERE order_id = $1',
        [localOrderId]
      );
      expect(orderResult.rows[0]).toMatchObject({
        order_stage: 'CANCELLED',
        cancel_id: 'DY_CANCEL_REQUEST_001',
        cancel_status: 'CANCELLED',
        cancel_log_id: 'DY_SPI_CANCEL_LOG_001',
        cancel_payload: expect.objectContaining({ cancel_id: 'DY_CANCEL_REQUEST_001' })
      });
      const logRecords = await readJsonLines(logFilePath);
      expect(logRecords).toEqual([
        expect.objectContaining({ type: 'spi_order_cancel', stage: 'processed', logId: 'DY_SPI_CANCEL_LOG_001', cancelResult: 1 }),
        expect.objectContaining({ type: 'spi_order_cancel', stage: 'duplicate', logId: 'DY_SPI_CANCEL_LOG_002', cancelResult: 1 })
      ]);
    } finally {
      await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    }
  });

  test('需要人工审核的预售券取消申请异步返回并按 cancel_id 幂等入库', async () => {
    const localOrderId = 'DYPS_CANCEL_AUDIT_TEST_001';
    const douyinOrderId = 'DY_CANCEL_AUDIT_TEST_001';
    const cancelId = 'DY_CANCEL_AUDIT_REQUEST_001';
    await query('DELETE FROM douyin_presale_cancel_audits WHERE cancel_id = $1', [cancelId]);
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, raw_payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [localOrderId, douyinOrderId, 2011, 'PAID', JSON.stringify({ order_id: douyinOrderId })]
    );

    try {
      const body = JSON.stringify({
        order_id: douyinOrderId,
        order_out_id: localOrderId,
        cancel_id: cancelId,
        cancel_type: 2,
        biz_type: 2011,
        after_sale_type: 1,
        refund_type: 11,
        need_audit: true
      });
      const requestPath = '/douyin/spi/order/cancel?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const sendCancelAudit = (logId) => request(app)
        .post(requestPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(requestPath, body))
        .set('x-bytedance-logid', logId)
        .send(body);

      const firstResponse = await sendCancelAudit('DY_SPI_CANCEL_AUDIT_LOG_001');
      const duplicateResponse = await sendCancelAudit('DY_SPI_CANCEL_AUDIT_LOG_002');

      expect(firstResponse.body).toEqual({ data: { error_code: 0, description: 'success', cancel_mode: 2 } });
      expect(duplicateResponse.body).toEqual({ data: { error_code: 0, description: 'success', cancel_mode: 2 } });
      const auditResult = await query(
        `SELECT biz_type, ota_order_id, order_out_id, audit_status, request_log_id
         FROM douyin_presale_cancel_audits WHERE cancel_id = $1`,
        [cancelId]
      );
      expect(auditResult.rows).toEqual([expect.objectContaining({
        biz_type: 2011,
        ota_order_id: douyinOrderId,
        order_out_id: localOrderId,
        audit_status: 'PENDING',
        request_log_id: 'DY_SPI_CANCEL_AUDIT_LOG_001'
      })]);
    } finally {
      await query('DELETE FROM douyin_presale_cancel_audits WHERE cancel_id = $1', [cancelId]);
      await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    }
  });

  test('用户协商退未携带 need_audit 时异步返回并自动发起审核回传', async () => {
    const localOrderId = 'DYPS_NEGOTIATED_CANCEL_TEST_001';
    const douyinOrderId = 'DY_NEGOTIATED_CANCEL_TEST_001';
    const cancelId = 'DY_NEGOTIATED_CANCEL_REQUEST_001';
    await query('DELETE FROM douyin_presale_cancel_audits WHERE cancel_id = $1', [cancelId]);
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, raw_payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [localOrderId, douyinOrderId, 2011, 'PAID', JSON.stringify({ order_id: douyinOrderId })]
    );

    const scheduleNegotiatedCancelAudit = jest.fn();
    const negotiatedCancelApp = buildTestApp(redisClient, { scheduleNegotiatedCancelAudit });

    try {
      const body = JSON.stringify({
        order_id: douyinOrderId,
        order_out_id: localOrderId,
        cancel_id: cancelId,
        cancel_type: 2,
        biz_type: 2011,
        after_sale_type: 1,
        refund_type: 21
      });
      const requestPath = '/douyin/spi/order/cancel?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const response = await request(negotiatedCancelApp)
        .post(requestPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(requestPath, body))
        .set('x-bytedance-logid', 'DY_SPI_NEGOTIATED_CANCEL_LOG_001')
        .send(body);

      expect(response.body).toEqual({ data: { error_code: 0, description: 'success', cancel_mode: 2 } });
      expect(scheduleNegotiatedCancelAudit).toHaveBeenCalledWith(cancelId);
      const auditResult = await query(
        'SELECT audit_status, request_log_id FROM douyin_presale_cancel_audits WHERE cancel_id = $1',
        [cancelId]
      );
      expect(auditResult.rows).toEqual([expect.objectContaining({
        audit_status: 'PENDING',
        request_log_id: 'DY_SPI_NEGOTIATED_CANCEL_LOG_001'
      })]);
      const orderResult = await query(
        'SELECT order_stage, cancel_id FROM douyin_presale_orders WHERE order_id = $1',
        [localOrderId]
      );
      expect(orderResult.rows).toEqual([expect.objectContaining({ order_stage: 'PAID', cancel_id: null })]);
    } finally {
      await query('DELETE FROM douyin_presale_cancel_audits WHERE cancel_id = $1', [cancelId]);
      await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    }
  });

  test('预售券仅退款受理后由退款结果通知确认，重复通知不重复落库', async () => {
    const localOrderId = 'DYPS_REFUND_RESULT_TEST_001';
    const douyinOrderId = 'DY_REFUND_RESULT_TEST_001';
    await query('DELETE FROM douyin_presale_refund_notifications WHERE ota_order_id = $1', [douyinOrderId]);
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, raw_payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [localOrderId, douyinOrderId, 2011, 'PAID', JSON.stringify({ order_id: douyinOrderId })]
    );

    try {
      const cancelBody = JSON.stringify({
        order_id: douyinOrderId,
        order_out_id: localOrderId,
        cancel_id: 'DY_REFUND_CANCEL_REQUEST_001',
        cancel_type: 2,
        biz_type: 2011,
        after_sale_type: 3,
        refund_type: 12
      });
      const cancelPath = '/douyin/spi/order/cancel?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const cancelResponse = await request(app)
        .post(cancelPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(cancelPath, cancelBody))
        .set('x-bytedance-logid', 'DY_SPI_REFUND_CANCEL_LOG_001')
        .send(cancelBody);

      const refundBody = JSON.stringify({
        order_id: douyinOrderId,
        order_out_id: localOrderId,
        refund_total_amount: 20000,
        refund_amount: 19900,
        user_refund_amount: 18900,
        refund_time_unix: 1785561600,
        currency: 'CNY',
        biz_type: 2011,
        refund_type: 12,
        audit_user_type: 1,
        applicant_type: 1,
        refund_reason: '用户申请部分退款',
        refund_order_detail: [{ rate_plan_id: 'DY_RATE_001', daily_refund_amount: 19900, period_start_date: '2026-08-10' }]
      });
      const refundPath = '/douyin/spi/presale-order/refund-result?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const firstResponse = await request(app)
        .post(refundPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(refundPath, refundBody))
        .set('x-bytedance-logid', 'DY_SPI_REFUND_RESULT_LOG_001')
        .send(refundBody);
      const duplicateResponse = await request(app)
        .post(refundPath)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(refundPath, refundBody))
        .set('x-bytedance-logid', 'DY_SPI_REFUND_RESULT_LOG_002')
        .send(refundBody);

      expect(cancelResponse.body.data.cancel_result).toBe(1);
      expect(firstResponse.body).toEqual({ data: { error_code: 0, description: 'success' } });
      expect(duplicateResponse.body).toEqual({ data: { error_code: 0, description: 'success' } });
      const orderResult = await query(
        'SELECT order_stage, cancel_status, refund_status, refund_log_id FROM douyin_presale_orders WHERE order_id = $1',
        [localOrderId]
      );
      expect(orderResult.rows[0]).toEqual(expect.objectContaining({
        order_stage: 'PAID',
        cancel_status: 'REFUND_PENDING',
        refund_status: 'COMPLETED',
        refund_log_id: 'DY_SPI_REFUND_RESULT_LOG_001'
      }));
      const notificationResult = await query(
        `SELECT refund_amount, user_refund_amount, refund_type, match_status, douyin_log_id, refund_order_detail
         FROM douyin_presale_refund_notifications WHERE ota_order_id = $1`,
        [douyinOrderId]
      );
      expect(notificationResult.rows).toEqual([expect.objectContaining({
        refund_amount: 19900,
        user_refund_amount: 18900,
        refund_type: 12,
        match_status: 'MATCHED',
        douyin_log_id: 'DY_SPI_REFUND_RESULT_LOG_001',
        refund_order_detail: expect.arrayContaining([expect.objectContaining({ rate_plan_id: 'DY_RATE_001' })])
      })]);
      const logRecords = await readJsonLines(logFilePath);
      expect(logRecords).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'spi_order_cancel', stage: 'processed', logId: 'DY_SPI_REFUND_CANCEL_LOG_001', cancelResult: 1 }),
        expect.objectContaining({ type: 'spi_presale_refund_result', stage: 'matched', logId: 'DY_SPI_REFUND_RESULT_LOG_001' }),
        expect.objectContaining({ type: 'spi_presale_refund_result', stage: 'duplicate', logId: 'DY_SPI_REFUND_RESULT_LOG_002' })
      ]));
    } finally {
      await query('DELETE FROM douyin_presale_refund_notifications WHERE ota_order_id = $1', [douyinOrderId]);
      await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
    }
  });

  test('预约单零金额退款未匹配本地订单时仍记录通知并成功响应', async () => {
    const douyinOrderId = 'DY_BOOKING_REFUND_UNMATCHED_001';
    await query('DELETE FROM douyin_presale_refund_notifications WHERE ota_order_id = $1', [douyinOrderId]);

    try {
      const body = JSON.stringify({
        order_id: douyinOrderId,
        refund_total_amount: 0,
        refund_amount: 0,
        user_refund_amount: 0,
        biz_type: 2012,
        refund_type: 11
      });
      const path = '/douyin/spi/presale-order/refund-result?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
      const response = await request(app)
        .post(path)
        .set('Content-Type', 'application/json')
        .set('x-life-clientkey', 'DY_CLIENT_TEST')
        .set('x-life-sign', buildSpiSign(path, body))
        .set('x-bytedance-logid', 'DY_SPI_BOOKING_REFUND_UNMATCHED_LOG_001')
        .send(body);

      expect(response.body).toEqual({ data: { error_code: 0, description: 'success' } });
      const notificationResult = await query(
        `SELECT booking_order_id, refund_amount, user_refund_amount, match_status, douyin_log_id
         FROM douyin_presale_refund_notifications
         WHERE ota_order_id = $1`,
        [douyinOrderId]
      );
      expect(notificationResult.rows).toEqual([expect.objectContaining({
        booking_order_id: null,
        refund_amount: 0,
        user_refund_amount: 0,
        match_status: 'ORDER_NOT_FOUND',
        douyin_log_id: 'DY_SPI_BOOKING_REFUND_UNMATCHED_LOG_001'
      })]);
    } finally {
      await query('DELETE FROM douyin_presale_refund_notifications WHERE ota_order_id = $1', [douyinOrderId]);
    }
  });

  test('非预售券取消订单返回占位拒绝，不伪造取消成功', async () => {
    const body = JSON.stringify({
      order_id: 'DY_CALENDAR_CANCEL_001',
      cancel_id: 'DY_CALENDAR_CANCEL_REQUEST_001',
      cancel_type: 2,
      biz_type: 2021,
      after_sale_type: 1,
      refund_type: 11
    });
    const path = '/douyin/spi/order/cancel?client_key=DY_CLIENT_TEST&timestamp=1777000000000';
    const response = await request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('x-life-clientkey', 'DY_CLIENT_TEST')
      .set('x-life-sign', buildSpiSign(path, body))
      .set('x-bytedance-logid', 'DY_SPI_CANCEL_CALENDAR_LOG_001')
      .send(body);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: {
        error_code: 0,
        description: 'success',
        cancel_mode: 1,
        cancel_result: 2,
        reason: '暂未实现 biz_type=2021 的取消订单'
      }
    });
  });
});
