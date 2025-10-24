const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const app = require('../app');



describe('创建订单接口', () => {
  test('创建订单成功', async () => {
    const response = await request(app).post('/api/orders').send({
    });
  });
});

