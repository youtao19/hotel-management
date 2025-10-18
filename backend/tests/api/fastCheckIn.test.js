/**
 * 快速入住接口测试
 *
 * 接口：POST /api/orders/fast-check-in
 * 场景：
 * 1. 成功创建已入住订单并生成账单、更新房间状态
 * 2. 缺少必填字段时返回 400
 */

const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom } = require('../test-helpers');

describe('快速入住 API - POST /api/orders/fast-check-in', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });

  it('成功创建已入住订单并生成账单', async () => {
    const suffix = Date.now().toString();
    const roomType = await createTestRoomType({ type_code: `FAST_${suffix}` });
    const room = await createTestRoom(roomType.type_code, { room_number: `FAST_${suffix}` });

    const orderId = `FAST_ORDER_${suffix}`;
    const payload = {
      order_id: orderId,
      guest_name: `快速入住客人_${suffix}`,
      id_number: '123456789012345678',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-10',
      check_out_date: '2025-10-11',
      status: 'checked-in',
      total_price: 388.00,
      payment_method: 'cash',
      deposit: 200,
      phone: '13800138000',
      order_source: 'front_desk'
    };

    const res = await request(app).post('/api/orders/fast-check-in').send(payload);

    if (res.status !== 200) {
      // 失败时输出响应内容，便于调试
      // eslint-disable-next-line no-console
      console.error('快速入住失败响应:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('快速入住成功');
    expect(res.body.data).toHaveProperty('order');
    expect(res.body.data.order.status).toBe('checked-in');
    expect(Number(res.body.data.order.deposit)).toBeCloseTo(200, 2);

    const { rows: [orderRow] } = await query(
      'SELECT status, stay_type, deposit, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );

    expect(orderRow).toBeDefined();
    expect(orderRow.status).toBe('checked-in');
    expect(orderRow.stay_type).toBe('客房');
    expect(Number(orderRow.deposit)).toBeCloseTo(200, 2);
    expect(Number(orderRow.total_price)).toBeCloseTo(388, 5);

    const { rows: bills } = await query(
      'SELECT change_type, change_price FROM bills WHERE order_id = $1',
      [orderId]
    );

    expect(bills.length).toBe(2);
    const changeTypes = bills.map(bill => bill.change_type);
    expect(changeTypes).toEqual(expect.arrayContaining(['房费', '收押']));

    const { rows: [roomRow] } = await query(
      'SELECT status FROM rooms WHERE room_number = $1',
      [room.room_number]
    );

    expect(roomRow).toBeDefined();
    expect(roomRow.status).toBe('occupied');
  });

  it('缺少必填字段时返回 400', async () => {
    const res = await request(app).post('/api/orders/fast-check-in').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});
