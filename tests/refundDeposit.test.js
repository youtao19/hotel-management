const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

describe('POST /api/orders/:orderNumber/refund-deposit', () => {
  beforeEach(global.cleanupTestData);
  let testOrderData;

  beforeEach(async () => {
    // Create a room type and room for the test order
    const roomType = await createTestRoomType({ type_code: 'TEST_REFUND_TYPE' });
    const room = await createTestRoom(roomType.type_code);

    // Create the test order using the helper
    testOrderData = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-08-01',
      check_out_date: '2025-08-02',
      status: 'checked-out',
      payment_method: 'wechat',
      room_price: { '2025-08-01': 300.00 },
      deposit: '150.00',
      remarks: '测试退款订单'
    });
  // 将订单持久化到测试数据库，供退押金接口使用（直接插入以确保存在）
  await query(
    `INSERT INTO orders (
       order_id, id_source, order_source, guest_name, phone, id_number,
       room_type, room_number, check_in_date, check_out_date, status,
       payment_method, room_price, deposit, create_time, remarks
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)`,
    [
      testOrderData.order_id,
      testOrderData.id_source,
      testOrderData.order_source,
      testOrderData.guest_name,
      testOrderData.phone,
      testOrderData.id_number,
      testOrderData.room_type,
      testOrderData.room_number,
      testOrderData.check_in_date,
      testOrderData.check_out_date,
      testOrderData.status,
      testOrderData.payment_method,
      JSON.stringify(testOrderData.room_price),
      testOrderData.deposit,
      new Date(),
      testOrderData.remarks
    ]
  );
  });

  it('应成功处理退押金请求', async () => {
    const refundData = {
      refundAmount: '150.00',
      actualRefundAmount: '150.00',
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post(`/api/orders/${testOrderData.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('退押金处理成功');
    expect(res.body.order).toBeDefined();
    expect(res.body.refundData).toMatchObject({
      actualRefundAmount: refundData.actualRefundAmount,
      method: refundData.method,
    });
  });

  it('当缺少必要字段时应返回400错误', async () => {
    const refundData = {
      refundAmount: '150.00',
      // actualRefundAmount 缺失
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post(`/api/orders/${testOrderData.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('请求数据验证失败');
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.some(e => e.path === 'actualRefundAmount')).toBe(true);
  });

  it('当字段类型不正确时应返回400错误', async () => {
    const refundData = {
      refundAmount: 'not-a-number',
      actualRefundAmount: '150.00',
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post(`/api/orders/${testOrderData.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('请求数据验证失败');
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.some(e => e.path === 'refundAmount' && e.msg === '退押金金额必须是数字')).toBe(true);
  });

  it('当订单号不存在时应返回500错误', async () => {
    const refundData = {
      refundAmount: '150.00',
      actualRefundAmount: '150.00',
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post('/api/orders/NON_EXISTENT_ORDER/refund-deposit')
      .send(refundData);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('退押金处理失败');
  });
});
