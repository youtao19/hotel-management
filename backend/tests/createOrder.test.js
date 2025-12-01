const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const app = require('../app');

const { roomTypes, rooms, ORDERS, addRoom, addRoomType } = require('./tools');


const baseOrderData = ORDERS[0]

const buildOrderPayload = (overrides = {}) => ({
  ...baseOrderData,
  orderId: `TEST_ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  ...overrides
});

describe('参数验证', () => {
    test('缺少 order_id 时返回 400', async () => {
      const payload = buildOrderPayload();
      delete payload.orderId;

      const response = await request(app)
        .post('/api/orders/new')
        .send(payload);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
    });

    test('status 不在允许列表时返回 400', async () => {
      const response = await request(app)
        .post('/api/orders/new')
        .send(buildOrderPayload({ status: 'invalid-status' }));

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
    });

    test('check_in_date 格式错误时返回 400', async () => {
      const response = await request(app)
        .post('/api/orders/new')
        .send(buildOrderPayload({ checkInDate: '2025/10/20' }));

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
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


    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1', [payload.orderId]);
    expect(storedOrder.rows.length).toBe(2);
    expect(storedOrder.rows[0].room_number).toBe("403");
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
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-02',
      roomPrice: {
        '2025-11-01': 168.00
      }
    });

    const response = await request(app)
      .post('/api/orders/new')
      .send(singleDayOrder);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);

    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1', [singleDayOrder.orderId]);
    expect(storedOrder.rows.length).toBe(1);
    expect(parseFloat(storedOrder.rows[0].total_price)).toBeCloseTo(168.0, 5);
  });

  test('创建休息房订单', async () => {
    const restOrder = buildOrderPayload({
      checkInDate: '2025-12-12',
      checkOutDate: '2025-12-12',
      roomPrice: {
        '2025-12-12': 88.0
      },
      stayType: '休息房',
      remarks: '测试休息房'
    });

    const response = await request(app)
      .post('/api/orders/new')
      .send(restOrder);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1', [restOrder.orderId]);
    expect(storedOrder.rows.length).toBe(1);
    expect(storedOrder.rows[0].stay_type).toBe('休息房');
    expect(storedOrder.rows[0].remarks).toContain('测试休息房');
  });

  test('创建多日订单', async () => {
    const mulOrder = buildOrderPayload({
      orderSource: "官网预订",
      guestName: "张伟",
      roomType: "asu_xiao_zhu",
      roomNumber: "101",
      checkInDate: "2025-10-28",
      checkOutDate: "2025-10-30",
      status: "pending",
      paymentMethod: "微邮付",
      roomPrice: {
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

    const storedOrder = await query('SELECT * FROM orders WHERE order_id = $1',[mulOrder.orderId]);

    expect(storedOrder.rows.length).toBe(2);
    expect(storedOrder.rows[0]).toMatchObject({
      order_id: mulOrder.orderId,
      room_number: mulOrder.roomNumber,
      guest_name: mulOrder.guestName,
      total_price: '288.00',
    });
  });
});
