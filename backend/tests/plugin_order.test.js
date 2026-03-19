const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const app = require('../app');
const { addRoomType, addRoom, roomTypes, rooms } = require('./tools');

/**
 * 构造插件订单测试请求体。
 * @param {object} overrides 覆盖字段
 * @returns {object} 插件订单请求体
 */
function buildPluginOrderPayload(overrides = {}) {
  return {
    platform: 'ctrip',
    otaOrderId: `PLUGIN_TEST_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    guestName: 'WANG/YITING',
    roomType: 'xing_yun_ge',
    checkInDate: '2026-04-25',
    checkOutDate: '2026-04-27',
    roomPrice: {
      '2026-04-25': 0,
    },
    totalPrice: 0,
    otaOrderStatus: 'reserved',
    ...overrides,
  };
}

describe('插件订单创建接口', () => {
  const originalPluginApiToken = process.env.PLUGIN_API_TOKEN;
  const pluginApiToken = 'test-plugin-token';

  beforeAll(async () => {
    process.env.PLUGIN_API_TOKEN = pluginApiToken;
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await query(`DELETE FROM ota_order_relation WHERE ota_order_id LIKE 'PLUGIN_TEST_%'`);
    await query(`DELETE FROM orders`);
  });

  afterAll(() => {
    process.env.PLUGIN_API_TOKEN = originalPluginApiToken;
  });

  test('同一 OTA 订单重复创建时优先返回重复订单，而不是无可用房间', async () => {
    const payload = buildPluginOrderPayload();

    const firstResponse = await request(app)
      .post('/api/plugin/orders')
      .set('Authorization', `Bearer ${pluginApiToken}`)
      .send(payload);

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.body.success).toBe(true);
    expect(firstResponse.body.code).toBe('PLUGIN_ORDER_CREATED');

    const secondResponse = await request(app)
      .post('/api/plugin/orders')
      .set('Authorization', `Bearer ${pluginApiToken}`)
      .send(payload);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body.success).toBe(false);
    expect(secondResponse.body.code).toBe('PLUGIN_ORDER_ALREADY_EXISTS');
    expect(secondResponse.body.message).toBe('插件订单已存在');
  });
});
