const request = require('supertest');
const { initializeHotelDB, closePool } = require('../backend/database/postgreDB/pg');
const app = require('../app'); // 注意是 app，不是 server


describe('POST /api/orders/new', () => {

  it('应成功创建一个新订单', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const orderId = 'TEST' + Date.now();

    const orderData = {
      order_id: orderId,
      order_source: 'front_desk',
      guest_name: '张三',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: 'standard', // 确保数据库有这个房型
      room_number: '101',  // 确保数据库有这个房间
      check_in_date: now.toISOString().split('T')[0],
      check_out_date: tomorrow.toISOString().split('T')[0],
      status: 'pending',
      payment_method: 'cash',
      room_price: '200.00',
      deposit: '100.00',
      create_time: now.toISOString(),
      remarks: '测试订单'
    };

    const res = await request(app)
      .post('/api/orders/new')
      .send(orderData)
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order).toMatchObject({
      order_id: orderData.order_id,
      guest_name: orderData.guest_name
    });
  });

  it('应验证必填字段，缺失时返回400', async () => {
    const res = await request(app)
      .post('/api/orders/new')
      .send({}) // 发送空对象
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});