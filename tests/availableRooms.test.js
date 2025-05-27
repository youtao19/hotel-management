// tests/availableRooms.test.js
const request = require('supertest');
const app = require('../app'); // 注意是 app，不是 server

describe('GET /api/rooms/available', () => {
  it('返回可用房间(200)', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-03',
      typeCode: 'A'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('缺少参数应返回400', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01'
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('必须提供入住日期和退房日期');
  });
});
