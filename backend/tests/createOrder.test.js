const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const app = require('../app');

const { roomTypes, rooms, addRoom, addRoomType } = require('./tools');
const TEST_ROOM_TYPE = 'TEST_STD_ROOM';
const TEST_ROOM_NUMBER = 'TEST_ROOM_101';

const baseOrderData = {
  id_source: 'ID_CARD',
  order_source: 'WEB',
  guest_name: '测试用户',
  room_type: TEST_ROOM_TYPE,
  room_number: TEST_ROOM_NUMBER,
  check_in_date: '2025-10-20',
  check_out_date: '2025-10-25',
  status: 'pending',
  payment_method: 'credit_card',
  phone: '13800138000',
  total_price: {
    '2025-10-20': 100,
    '2025-10-21': 100,
    '2025-10-22': 100,
    '2025-10-23': 100,
    '2025-10-24': 100
  },
  deposit: 100.00,
  stay_type: '客房',
  create_time: '2024-06-01T12:00:00Z',
  remarks: '无'
};

const buildOrderPayload = (overrides = {}) => ({
  ...baseOrderData,
  order_id: `TEST_ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  ...overrides
});

describe('参数验证', () => {
    test('缺少 order_id 时返回 400', async () => {
      const payload = buildOrderPayload();
      delete payload.order_id;

      const response = await request(app)
        .post('/api/orders/new')
        .send(payload);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('order_id')
          })
        ])
      );
    });

    test('status 不在允许列表时返回 400', async () => {
      const response = await request(app)
        .post('/api/orders/new')
        .send(buildOrderPayload({ status: 'invalid-status' }));

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/status'
          })
        ])
      );
    });

    test('check_in_date 格式错误时返回 400', async () => {
      const response = await request(app)
        .post('/api/orders/new')
        .send(buildOrderPayload({ check_in_date: '2025/10/20' }));

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/check_in_date'
          })
        ])
      );
    });
});

describe('创建订单接口', () => {
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await query(`DELETE FROM orders WHERE order_id LIKE 'TEST_ORDER_%'`);
  });

  test('创建订单成功', async () => {
    const payload = buildOrderPayload();
    const response = await request(app)
      .post('/api/orders/new')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('订单创建成功');
    expect(response.body.data.order).toMatchObject({
      order_id: payload.order_id,
      room_number: payload.room_number,
      guest_name: payload.guest_name
    });

    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1', [payload.order_id]);
    expect(storedOrder.rows.length).toBe(1);
    expect(storedOrder.rows[0].room_number).toBe(TEST_ROOM_NUMBER);
  });

  test('phone 为空字符串时仍可创建', async () => {
    const payload = buildOrderPayload({ phone: '' });
    const response = await request(app)
      .post('/api/orders/new')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test('创建单日订单', async () => {
    const singleDayOrder = buildOrderPayload({
      check_in_date: '2025-11-01',
      check_out_date: '2025-11-02',
      total_price: {
        '2025-11-01': 168.00
      }
    });

    const response = await request(app)
      .post('/api/orders/new')
      .send(singleDayOrder);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(parseFloat(response.body.data.order.total_price)).toBeCloseTo(168.0, 5);

    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1', [singleDayOrder.order_id]);
    expect(storedOrder.rows.length).toBe(1);
    expect(parseFloat(storedOrder.rows[0].total_price)).toBeCloseTo(168.0, 5);
  });

  test('创建休息房订单', async () => {
    const restOrder = buildOrderPayload({
      check_in_date: '2025-12-12',
      check_out_date: '2025-12-12',
      total_price: {
        '2025-12-12': 88.0
      },
      remarks: '测试休息房'
    });

    const response = await request(app)
      .post('/api/orders/new')
      .send(restOrder);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.order.stay_type).toBe('休息房');
    expect(response.body.data.order.remarks).toContain('【休息房】');

    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1', [restOrder.order_id]);
    expect(storedOrder.rows.length).toBe(1);
    expect(storedOrder.rows[0].stay_type).toBe('休息房');
    expect(storedOrder.rows[0].remarks).toContain('【休息房】');
  });

  test('创建多日订单', async () => {
    const mulOrder = buildOrderPayload({
      order_source: "官网预订",
      guest_name: "张伟",
      room_type: "阿苏晓筑",
      room_number: "101",
      check_in_date: "2025-10-28",
      check_out_date: "2025-10-30",
      status: "reserved",
      payment_method: "微邮付",
      total_price: {
        '2025-10-28': 288.00,
        '2025-10-29': 288.00
      },
      deposit: 200.00,
      remarks: "提前入住，请准备好房卡"
    });

    const response = await request(app)
      .post('/api/orders/new')
      .send(mulOrder);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('订单创建成功');
    expect(response.body.data.order).toMatchObject({
      order_id: mulOrder.order_id,
      room_number: mulOrder.room_number,
      guest_name: mulOrder.guest_name
    });
    expect(parseFloat(response.body.data.order.total_price)).toBeCloseTo(576.0, 5);
  });
});
