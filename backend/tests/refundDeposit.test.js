const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

describe('POST /api/orders/:orderNumber/refund-deposit (新退押逻辑: 使用 change_price 负值写入账单)', () => {
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

  it('应成功处理退押金请求并写入账单 (change_type=退押, change_price 为负数)', async () => {
    const refundData = {
      order_id: testOrderData.order_id,
      change_price: 150, // 正值，模块内部会转成负数
      method: 'wechat',
      notes: '测试退押金',
      refundTime: new Date().toISOString()
    };

    const res = await request(app)
      .post(`/api/orders/${testOrderData.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('退押金处理成功');
    // 返回的 order 实际是新增的账单记录
    expect(res.body.order).toBeDefined();
    expect(res.body.order.order_id).toBe(testOrderData.order_id);
    expect(res.body.order.change_type).toBe('退押');
    // change_price 应为负数
    const cp = Number(res.body.order.change_price);
    expect(cp).toBeLessThan(0);
    expect(Math.abs(cp)).toBe(150);
    // refundData 回传
    expect(res.body.refundData).toMatchObject({
      change_price: -150,
      method: 'wechat'
    });
  });

  it('缺少 order_id 时应返回 500 并提示处理失败 (当前实现未做字段级校验)', async () => {
    const refundData = {
      change_price: 150,
      method: 'wechat'
    };
    const res = await request(app)
      .post(`/api/orders/${testOrderData.order_id}/refund-deposit`)
      .send(refundData);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('退押金处理失败');
  });

  it('change_price 非数字时应返回 500 (数据库写入失败)', async () => {
    const refundData = {
      order_id: testOrderData.order_id,
      change_price: 'not-a-number',
      method: 'wechat'
    };
    const res = await request(app)
      .post(`/api/orders/${testOrderData.order_id}/refund-deposit`)
      .send(refundData);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('退押金处理失败');
  });

  it('订单号不存在时应返回500错误', async () => {
    const refundData = {
      order_id: 'NON_EXISTENT_ORDER',
      change_price: 80,
      method: 'wechat'
    };
    const res = await request(app)
      .post('/api/orders/NON_EXISTENT_ORDER/refund-deposit')
      .send(refundData);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('退押金处理失败');
  });
});
