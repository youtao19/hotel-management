const express = require('express');
const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const presaleOrderRoute = require('../modules/douyin/presale-order/presaleOrder.routes');

/** 创建仅挂载预售订单列表路由的测试应用。 */
function buildApp() {
  const app = express();
  app.use('/api/douyin/presale-orders', presaleOrderRoute);
  return app;
}

describe('抖音预售订单列表', () => {
  const localOrderId = 'DYPS_LIST_TEST_001';

  beforeEach(async () => {
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
  });

  afterEach(async () => {
    await query('DELETE FROM douyin_presale_orders WHERE order_id = $1', [localOrderId]);
  });

  test('返回预售券主订单而不混入普通入住订单', async () => {
    await query(
      `INSERT INTO douyin_presale_orders (
         order_id, ota_order_id, biz_type, order_stage, pre_sale_coupon_id,
         voucher_count, total_amount, currency, raw_payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [localOrderId, 'DY_LIST_TEST_001', 2011, 'PAID', 'DY_VOUCHER_LIST_001', 1, 900, 'CNY', JSON.stringify({ order_id: 'DY_LIST_TEST_001' })]
    );

    const response = await request(buildApp()).get('/api/douyin/presale-orders');

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        order_id: localOrderId,
        ota_order_id: 'DY_LIST_TEST_001',
        order_stage: 'PAID',
        total_amount: '900.00',
        currency: 'CNY'
      })
    ]));
  });
});
