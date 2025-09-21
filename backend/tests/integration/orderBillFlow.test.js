// 订单 -> 账单 -> 退押金 集成流程（精简）
const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('订单到退押金集成流程', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });
  test('创建订单 -> 退房状态 -> 退押金成功写账单', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const orderData = await createTestOrder({
      room_type: rt.type_code,
      room_number: room.room_number,
      status: 'checked-out',
      deposit: '200.00',
      room_price: { '2025-02-01': 300 }
    });

    // 插入订单
    await query(`INSERT INTO orders (order_id, id_source, order_source, guest_name, phone, id_number, room_type, room_number, check_in_date, check_out_date, status, payment_method, total_price, deposit, create_time, remarks, stay_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)` , [
      orderData.order_id,
      orderData.id_source,
      orderData.order_source,
      orderData.guest_name,
      orderData.phone,
      orderData.id_number,
      orderData.room_type,
      orderData.room_number,
      orderData.check_in_date,
      orderData.check_out_date,
      orderData.status,
      orderData.payment_method,
      orderData.room_price && typeof orderData.room_price === 'object'
        ? Object.values(orderData.room_price).reduce((sum, price) => sum + price, 0)
        : (orderData.room_price || 0),
      orderData.deposit,
      new Date(),
      orderData.remarks,
      '客房'
    ]);

    // 发起退押金
    const res = await request(app)
      .post(`/api/orders/${orderData.order_id}/refund-deposit`)
      .send({ order_id: orderData.order_id, change_price: 200, method: 'cash', refundTime: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.order).toBeDefined();
    expect(Number(res.body.order.change_price)).toBeLessThan(0);
  });
});
