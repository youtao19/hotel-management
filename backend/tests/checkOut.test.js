const request = require('supertest');
const app = require('../app');
const tools = require('./tools');
const { createOrder } = require('../modules/order-create/orderCreate.service');
const { query } = require('../database/postgreDB/pg');

describe('订单退房接口', () => {
  beforeAll(async () => {
    await tools.addRoomType(tools.roomTypes);
    await tools.addRoom(tools.rooms);
  });

  test('单日订单成功办理退房', async () => {
    // 创建一个订单
    const order = tools.buildOrderPayload({
      orderId: 'TESTORDER001',
      guestName: '测试单日退房',
      roomType: 'sheng_sheng_man',
      roomNumber: '201',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-02',
      roomPrice: {
        '2025-12-01': 150.00
      }
    });

    await createOrder(order);

    // 调用退房接口
    const response = await tools.authedRequest()
      .post(`/api/orders/${order.orderId}/check-out`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('办理退房成功');

    // 验证订单状态
    const oSql = 'SELECT status FROM orders WHERE order_id = $1';
    const oResult = await query(oSql, [order.orderId]);
    expect(oResult.rows[0].status).toBe('checked-out');

    // 验证房间状态
    const rSql = 'SELECT status FROM rooms WHERE room_number = $1';
    const rResult = await query(rSql, [order.roomNumber]);
    expect(rResult.rows[0].status).toBe('cleaning');

  });

  test('多日订单成功办理退房', async () => {
    // 创建一个多日订单
    const order = tools.buildOrderPayload({
      orderId: 'TESTORDER002',
      guestName: '测试多日退房',
      roomType: 'nuan_ju_jiating',
      roomNumber: '210',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-05',
      roomPrice: {
        '2025-12-01': 320,
        '2025-12-02': 320,
        '2025-12-03': 350.5,
        '2025-12-04': 360.00
      }
    });

    await createOrder(order);

    // 调用退房接口
    const response = await tools.authedRequest()
      .post(`/api/orders/${order.orderId}/check-out`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('办理退房成功');

    // 验证订单状态
    const oSql = 'SELECT status FROM orders WHERE order_id = $1';
    const oResult = await query(oSql, [order.orderId]);
    expect(oResult.rows[0].status).toBe('checked-out');

    // 验证房间状态
    const rSql = 'SELECT status FROM rooms WHERE room_number = $1';
    const rResult = await query(rSql, [order.roomNumber]);
    expect(rResult.rows[0].status).toBe('cleaning');

  });

  test('休息房订单成功办理退房', async () => {
    // 创建一个休息房订单
    const order = tools.buildOrderPayload({
      orderId: 'TESTORDER003',
      guestName: '测试休息房退房',
      roomType: 'asu_xiao_zhu',
      roomNumber: '111',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-01',
      roomPrice: {
        '2025-12-01': 100.00
      }
    });

    await createOrder(order);

    // 调用退房接口
    const response = await tools.authedRequest()
      .post(`/api/orders/${order.orderId}/check-out`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('办理退房成功');

    // 验证订单状态
    const oSql = 'SELECT status FROM orders WHERE order_id = $1';
    const oResult = await query(oSql, [order.orderId]);
    expect(oResult.rows[0].status).toBe('checked-out');

    // 验证房间状态
    const rSql = 'SELECT status FROM rooms WHERE room_number = $1';
    const rResult = await query(rSql, [order.roomNumber]);
    expect(rResult.rows[0].status).toBe('cleaning');

  });

})

