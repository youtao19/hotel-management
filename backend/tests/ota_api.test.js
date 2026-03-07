const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { buildSignatureBase, signPayload } = require('../modules/otaAuthModule');
const { addRoomType, addRoom, roomTypes, rooms } = require('./tools');

const OTA_CHANNEL = 'meituan';
const OTA_KEY = process.env.OTA_MEITUAN_KEY;
const OTA_SECRET = process.env.OTA_MEITUAN_SECRET;
const TEST_ORDER_PREFIX = 'OTA-MEITUAN-';
const TEST_EXTERNAL_PREFIX = 'MT-OTA-TEST-';

// 测试签名必须与服务端完全一致，因此直接复用同一套签名基串规则。
function buildSignedHeaders(method, path, rawBody = '', overrides = {}) {
  const timestamp = overrides.timestamp || String(Math.floor(Date.now() / 1000));
  const nonce = overrides.nonce || `nonce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const signatureBase = buildSignatureBase({
    method,
    path,
    timestamp,
    nonce,
    rawBody
  });
  const signature = signPayload(OTA_SECRET, signatureBase);

  return {
    'x-ota-channel': OTA_CHANNEL,
    'x-ota-key': OTA_KEY,
    'x-ota-timestamp': timestamp,
    'x-ota-nonce': nonce,
    'x-ota-signature': signature
  };
}

async function clearOtaTestData() {
  await query(`DELETE FROM ota_inventory_quota WHERE channel_code = $1`, [OTA_CHANNEL]);
  await query(`DELETE FROM orders WHERE order_id LIKE $1 OR id_source LIKE $2`, [`${TEST_ORDER_PREFIX}%`, `${TEST_EXTERNAL_PREFIX}%`]);
}

describe('OTA API', () => {
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await clearOtaTestData();
  });

  afterAll(async () => {
    await clearOtaTestData();
  });

  test('GET /api/ota/v1/inventory 鉴权成功', async () => {
    const headers = buildSignedHeaders('GET', '/api/ota/v1/inventory');
    const response = await request(app)
      .get('/api/ota/v1/inventory')
      .query({ startDate: '2026-04-01', endDate: '2026-04-01', roomType: 'asu_xiao_zhu' })
      .set(headers);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/ota/v1/inventory 签名错误返回 401', async () => {
    const headers = buildSignedHeaders('GET', '/api/ota/v1/inventory');
    const response = await request(app)
      .get('/api/ota/v1/inventory')
      .query({ startDate: '2026-04-01', endDate: '2026-04-01', roomType: 'asu_xiao_zhu' })
      .set({ ...headers, 'x-ota-signature': 'invalid-signature' });

    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe('OTA_SIGNATURE_INVALID');
  });

  test('GET /api/ota/v1/inventory 时间戳超窗返回 401', async () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 1000);
    const headers = buildSignedHeaders('GET', '/api/ota/v1/inventory', '', { timestamp: oldTimestamp });
    const response = await request(app)
      .get('/api/ota/v1/inventory')
      .query({ startDate: '2026-04-01', endDate: '2026-04-01', roomType: 'asu_xiao_zhu' })
      .set(headers);

    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe('OTA_TIMESTAMP_EXPIRED');
  });

  test('GET /api/ota/v1/inventory nonce 重放返回 401', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = `replay-${Date.now()}`;
    const headers = buildSignedHeaders('GET', '/api/ota/v1/inventory', '', { timestamp, nonce });

    const firstResponse = await request(app)
      .get('/api/ota/v1/inventory')
      .query({ startDate: '2026-04-01', endDate: '2026-04-01', roomType: 'asu_xiao_zhu' })
      .set(headers);
    const secondResponse = await request(app)
      .get('/api/ota/v1/inventory')
      .query({ startDate: '2026-04-01', endDate: '2026-04-01', roomType: 'asu_xiao_zhu' })
      .set(headers);

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(401);
    expect(secondResponse.body.error.code).toBe('OTA_NONCE_REPLAYED');
  });

  test('POST /api/ota/v1/orders 仅传总价时成功创建多日订单并自动分房', async () => {
    const payload = {
      externalOrderId: `${TEST_EXTERNAL_PREFIX}CREATE-1`,
      guestName: 'OTA客人甲',
      roomType: 'asu_xiao_zhu',
      checkInDate: '2026-04-10',
      checkOutDate: '2026-04-12',
      totalPrice: 200,
      paymentMethod: '平台',
      remarks: 'OTA 推单测试'
    };
    const rawBody = JSON.stringify(payload);
    const headers = buildSignedHeaders('POST', '/api/ota/v1/orders', rawBody);

    const response = await request(app)
      .post('/api/ota/v1/orders')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.existing).toBe(false);
    expect(response.body.data.order).toHaveLength(2);
    expect(response.body.data.order[0].order_source).toBe(OTA_CHANNEL);
    expect(response.body.data.order[0].id_source).toBe(payload.externalOrderId);
    expect(response.body.data.order[0].room_number).toBe('101');

    const storedRows = await query(
      `SELECT order_id, room_number, total_price, order_source, id_source
         FROM orders
        WHERE id_source = $1
        ORDER BY stay_date`,
      [payload.externalOrderId]
    );
    expect(storedRows.rows).toHaveLength(2);
    expect(Number(storedRows.rows[0].total_price)).toBe(100);
    expect(Number(storedRows.rows[1].total_price)).toBe(100);
  });

  test('POST /api/ota/v1/orders 重复推送返回 existing=true 且不重复插入', async () => {
    const payload = {
      externalOrderId: `${TEST_EXTERNAL_PREFIX}IDEMPOTENT-1`,
      guestName: 'OTA客人乙',
      roomType: 'asu_xiao_zhu',
      checkInDate: '2026-04-13',
      checkOutDate: '2026-04-15',
      totalPrice: 300
    };
    const rawBody = JSON.stringify(payload);

    const firstResponse = await request(app)
      .post('/api/ota/v1/orders')
      .set(buildSignedHeaders('POST', '/api/ota/v1/orders', rawBody))
      .set('Content-Type', 'application/json')
      .send(rawBody);
    const secondResponse = await request(app)
      .post('/api/ota/v1/orders')
      .set(buildSignedHeaders('POST', '/api/ota/v1/orders', rawBody))
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body.existing).toBe(true);

    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE id_source = $1`,
      [payload.externalOrderId]
    );
    expect(Number(countResult.rows[0].count)).toBe(2);
  });

  test('POST /api/ota/v1/orders 库存不足返回 409', async () => {
    const inventoryPayload = {
      entries: [
        { roomType: 'asu_xiao_zhu', stayDate: '2026-04-20', quota: 0 },
        { roomType: 'asu_xiao_zhu', stayDate: '2026-04-21', quota: 0 }
      ]
    };
    const inventoryRawBody = JSON.stringify(inventoryPayload);
    await request(app)
      .put('/api/ota/v1/inventory')
      .set(buildSignedHeaders('PUT', '/api/ota/v1/inventory', inventoryRawBody))
      .set('Content-Type', 'application/json')
      .send(inventoryRawBody);

    const orderPayload = {
      externalOrderId: `${TEST_EXTERNAL_PREFIX}CONFLICT-1`,
      guestName: 'OTA客人丙',
      roomType: 'asu_xiao_zhu',
      checkInDate: '2026-04-20',
      checkOutDate: '2026-04-22',
      totalPrice: 260
    };
    const orderRawBody = JSON.stringify(orderPayload);

    const response = await request(app)
      .post('/api/ota/v1/orders')
      .set(buildSignedHeaders('POST', '/api/ota/v1/orders', orderRawBody))
      .set('Content-Type', 'application/json')
      .send(orderRawBody);

    expect(response.statusCode).toBe(409);
    expect(response.body.error.code).toBe('OTA_INVENTORY_CONFLICT');
  });

  test('库存查询与写入支持绝对覆盖和清空', async () => {
    const updatePayload = {
      entries: [
        { roomType: 'asu_xiao_zhu', stayDate: '2026-04-25', quota: 1 }
      ]
    };
    const updateRawBody = JSON.stringify(updatePayload);
    const updateResponse = await request(app)
      .put('/api/ota/v1/inventory')
      .set(buildSignedHeaders('PUT', '/api/ota/v1/inventory', updateRawBody))
      .set('Content-Type', 'application/json')
      .send(updateRawBody);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.data[0].quota_limit).toBe(1);
    expect(updateResponse.body.data[0].sellable_available).toBe(1);
    expect(updateResponse.body.data[0].physical_available).toBeGreaterThan(1);

    const queryResponse = await request(app)
      .get('/api/ota/v1/inventory')
      .query({ startDate: '2026-04-25', endDate: '2026-04-25', roomType: 'asu_xiao_zhu' })
      .set(buildSignedHeaders('GET', '/api/ota/v1/inventory'));

    expect(queryResponse.statusCode).toBe(200);
    expect(queryResponse.body.data[0].quota_limit).toBe(1);

    const clearPayload = {
      entries: [
        { roomType: 'asu_xiao_zhu', stayDate: '2026-04-25', quota: null }
      ]
    };
    const clearRawBody = JSON.stringify(clearPayload);
    const clearResponse = await request(app)
      .put('/api/ota/v1/inventory')
      .set(buildSignedHeaders('PUT', '/api/ota/v1/inventory', clearRawBody))
      .set('Content-Type', 'application/json')
      .send(clearRawBody);

    expect(clearResponse.statusCode).toBe(200);
    expect(clearResponse.body.data[0].quota_limit).toBeNull();
    expect(clearResponse.body.data[0].sellable_available).toBe(clearResponse.body.data[0].physical_available);
  });

  test('并发推单抢最后一间房时只允许一单成功', async () => {
    // TEST_STD_ROOM 只有一间房，用它来验证 FOR UPDATE SKIP LOCKED 的效果。
    const payloadA = {
      externalOrderId: `${TEST_EXTERNAL_PREFIX}RACE-A`,
      guestName: '并发客人A',
      roomType: 'TEST_STD_ROOM',
      checkInDate: '2026-04-30',
      checkOutDate: '2026-05-01',
      totalPrice: 120
    };
    const payloadB = {
      externalOrderId: `${TEST_EXTERNAL_PREFIX}RACE-B`,
      guestName: '并发客人B',
      roomType: 'TEST_STD_ROOM',
      checkInDate: '2026-04-30',
      checkOutDate: '2026-05-01',
      totalPrice: 120
    };
    const rawBodyA = JSON.stringify(payloadA);
    const rawBodyB = JSON.stringify(payloadB);

    const [responseA, responseB] = await Promise.all([
      request(app)
        .post('/api/ota/v1/orders')
        .set(buildSignedHeaders('POST', '/api/ota/v1/orders', rawBodyA))
        .set('Content-Type', 'application/json')
        .send(rawBodyA),
      request(app)
        .post('/api/ota/v1/orders')
        .set(buildSignedHeaders('POST', '/api/ota/v1/orders', rawBodyB))
        .set('Content-Type', 'application/json')
        .send(rawBodyB)
    ]);

    const statusCodes = [responseA.statusCode, responseB.statusCode].sort((left, right) => left - right);
    expect(statusCodes).toEqual([201, 409]);

    const countResult = await query(
      `SELECT COUNT(*)::int AS count
         FROM orders
        WHERE id_source IN ($1, $2)`,
      [payloadA.externalOrderId, payloadB.externalOrderId]
    );
    expect(Number(countResult.rows[0].count)).toBe(1);
  });
});
