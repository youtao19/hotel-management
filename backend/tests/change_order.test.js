const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom,buildOrderPayload,roomTypes,rooms } = require('./tools');
const { createOrder } = require('../modules/orderModule');

describe('订单修改接口集成测试', () => {
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  test('通过接口完成订单的创建、查询与修改', async () => {
    orderId = `ORDER_UPDATE_${Date.now()}`;
    const createPayload = buildOrderPayload({
      orderId
    });
    // 步骤 1：调用创建接口生成测试订单
    await createOrder(createPayload);

    // 步骤 2：调用详情接口确认订单已存在
    const detailResponse = await request(app)
      .get(`/api/orders/${orderId}`);

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.data).toBeDefined();
    // API now returns an array of rows (multi-day support)
    expect(Array.isArray(detailResponse.body.data)).toBe(true);
    expect(detailResponse.body.data[0].order_id).toBe(orderId);

    const updatePayload = {
      payment_method: 'wechat_pay',
      reason: '集成测试修改订单'
    };

    // 步骤 3：调用修改接口更新订单关键信息
    const updateResponse = await request(app)
      .put(`/api/orders/${orderId}`)
      .send(updatePayload);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data[0].payment_method).toBe(updatePayload.payment_method);

    // 步骤 4：再次查询订单，确认所有修改生效
    const finalDetailResponse = await request(app)
      .get(`/api/orders/${orderId}`);

    expect(finalDetailResponse.statusCode).toBe(200);
    const updatedOrder = finalDetailResponse.body.data[0];
    expect(updatedOrder.payment_method).toBe(updatePayload.payment_method);
  });
});
