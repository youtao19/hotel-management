const request = require('supertest');
const app = require('../app');
const { authedRequest } = require('./tools');

describe('创建订单定价拆分接口', () => {
  test('from-room-price：多日初始化每日价格', async () => {
    const res = await authedRequest()
      .post('/api/orders/pricing/breakdown')
      .send({
        checkInDate: '2025-11-01',
        checkOutDate: '2025-11-03',
        mode: 'from-room-price',
        basePrice: 100
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stay_dates).toEqual(['2025-11-01', '2025-11-02']);
    expect(res.body.data.daily_prices).toEqual({ '2025-11-01': 100, '2025-11-02': 100 });
    expect(res.body.data.total_price).toBe(200);
    expect(res.body.data.average_price).toBe(100);
    expect(res.body.data.is_rest_room).toBe(false);
  });

  test('from-room-price：休息房自动半价', async () => {
    const res = await authedRequest()
      .post('/api/orders/pricing/breakdown')
      .send({
        checkInDate: '2025-11-01',
        checkOutDate: '2025-11-01',
        mode: 'from-room-price',
        basePrice: 100
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stay_dates).toEqual(['2025-11-01']);
    expect(res.body.data.daily_prices).toEqual({ '2025-11-01': 50 });
    expect(res.body.data.total_price).toBe(50);
    expect(res.body.data.average_price).toBe(50);
    expect(res.body.data.is_rest_room).toBe(true);
  });

  test('distribute-total：按天平均分摊并处理分余数', async () => {
    const res = await authedRequest()
      .post('/api/orders/pricing/breakdown')
      .send({
        checkInDate: '2025-11-01',
        checkOutDate: '2025-11-04',
        mode: 'distribute-total',
        totalPrice: 100
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stay_dates).toEqual(['2025-11-01', '2025-11-02', '2025-11-03']);
    expect(res.body.data.daily_prices).toEqual({
      '2025-11-01': 33.34,
      '2025-11-02': 33.33,
      '2025-11-03': 33.33
    });
    expect(res.body.data.total_price).toBe(100);
    expect(res.body.data.average_price).toBeCloseTo(33.33, 2);
  });

  test('参数缺失时返回 400', async () => {
    const res = await authedRequest()
      .post('/api/orders/pricing/breakdown')
      .send({
        checkInDate: '2025-11-01',
        checkOutDate: '2025-11-02',
        mode: 'from-room-price'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('请求参数验证失败');
  });
});

