const express = require('express');
const request = require('supertest');

process.env.DOUYIN_ACCOUNT_ID = 'DY_VOUCHER_ACCOUNT';
process.env.DOUYIN_OPENAPI_BASE_URL = 'https://open.douyin.com';

jest.mock('../modules/douyin/token/token.service', () => ({ getToken: jest.fn() }));

const { query } = require('../database/postgreDB/pg');
const douyinTokenService = require('../modules/douyin/token/token.service');
const voucherRoute = require('../modules/douyin/presale-voucher/presaleVoucher.routes');

const originalFetch = global.fetch;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/douyin/presale-vouchers', voucherRoute);
  return app;
}

/** 建立已同步套餐，确保测试验证预售券只能依赖真实的抖音预定商品映射。 */
async function createSyncedRatePlan() {
  await query(`INSERT INTO room_types (type_code, type_name, base_price) VALUES ('PV_TEST', '预售券测试房型', 500)`);
  const result = await query(
    `INSERT INTO rate_plans (room_type_code, name, base_price) VALUES ('PV_TEST', '预售券测试套餐', 500) RETURNING id`
  );
  const ratePlanId = result.rows[0].id;
  await query(
    `INSERT INTO ota_channel_mappings (local_target_type, local_target_id, channel_code, channel_item_id)
     VALUES ('RATE_PLAN', $1, 'DOUYIN', 'DY_RATE_PLAN_001')`,
    [ratePlanId]
  );
  return ratePlanId;
}

/** 返回官方示例的最小本地请求，金额以元传入以验证服务层换算为分。 */
function payload(ratePlanId) {
  return {
    ratePlanId,
    name: '双人入住含双早',
    originalAmount: 1000,
    actualAmount: 800,
    inventoryIsLimited: true,
    inventoryCount: 100,
    saleStartAt: '2026-08-01 00:00',
    saleEndAt: '2026-08-31 23:59',
    bookStartDate: '2026-08-01',
    bookEndDate: '2026-12-31',
    imageUrls: ['https://example.com/head.jpg', 'https://example.com/detail.jpg']
  };
}

describe('抖音预售券创建和更新', () => {
  const app = buildApp();

  beforeEach(async () => {
    await query('DELETE FROM douyin_presale_vouchers');
    await query("DELETE FROM ota_channel_mappings WHERE local_target_type = 'RATE_PLAN'");
    await query("DELETE FROM rate_plans WHERE room_type_code = 'PV_TEST'");
    await query("DELETE FROM room_types WHERE type_code = 'PV_TEST'");
    douyinTokenService.getToken.mockReset();
    douyinTokenService.getToken.mockResolvedValue('TOKEN_001');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { error_code: 0, pre_sale_coupon_id: 'DY_VOUCHER_001' }, extra: { error_code: 0, logid: 'DY_LOG_001' } })
    });
  });

  afterAll(() => { global.fetch = originalFetch; });

  test('创建预售券会绑定已同步套餐、调用抖音并保存券ID', async () => {
    const response = await request(app).post('/api/douyin/presale-vouchers').send(payload(await createSyncedRatePlan()));

    expect(response.statusCode).toBe(200);
    expect(response.body.data.douyin_voucher_id).toBe('DY_VOUCHER_001');
    expect(response.body.data.audit_status).toBe('PENDING');
    const requestPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(global.fetch.mock.calls[0][1].headers['Rpc-Transit-Life-Account']).toBe('DY_VOUCHER_ACCOUNT');
    expect(requestPayload.account_id).toBe('DY_VOUCHER_ACCOUNT');
    expect(requestPayload.presale_info.category_id).toBe('8001001');
    expect(requestPayload.presale_info.settle_type).toBe(1);
    expect(requestPayload.presale_info.pre_sale_coupon_info.bind_rate_plans).toEqual(['DY_RATE_PLAN_001']);
    expect(requestPayload.presale_info.pre_sale_coupon_info.actual_amount).toBe(80000);
    expect(requestPayload.presale_info.trade_info.customer_can_use_date).toEqual({
      use_date_type: 1,
      use_date: { from: '2026-08-01', to: '2026-12-31' }
    });
    expect(requestPayload.presale_info.trade_info.customer_can_use_time).toEqual({ use_time_type: 1 });
    expect(requestPayload.presale_info.trade_info.limt_buy_rule).toEqual({ each_person_max: 1, each_person_each_order_max: 1 });
    expect(requestPayload.presale_info.trade_info.book_rule).toEqual({ earliest_book_day: 30 });
    expect(requestPayload.presale_info.trade_info.cancel_booking_rule).toEqual({ cancel_type: 3 });
    expect(requestPayload.presale_info.trade_info.invoic_info).toEqual({ provider: 1 });
    expect(requestPayload.presale_info.note_info).toEqual({
      check_time_range: { from: '14:00', to: '12:00' },
      other_remark_info: ['需提前预约，以门店确认为准'],
      service_for_foreign: false,
      superimposed_discounts: false
    });
    expect(requestPayload.presale_info.out_id).toBe(`voucher-${response.body.data.id}`);
  });

  test('未同步套餐不能创建预售券', async () => {
    await query(`INSERT INTO room_types (type_code, type_name, base_price) VALUES ('PV_TEST', '预售券测试房型', 500)`);
    const result = await query(`INSERT INTO rate_plans (room_type_code, name, base_price) VALUES ('PV_TEST', '未同步套餐', 500) RETURNING id`);

    const response = await request(app).post('/api/douyin/presale-vouchers').send(payload(result.rows[0].id));

    expect(response.statusCode).toBe(400);
  });

  test('Base64 图片会在调用抖音前被拒绝', async () => {
    const requestPayload = payload(1);
    requestPayload.imageUrls = ['data:image/jpeg;base64,/9j/4AAQ'];

    const response = await request(app).post('/api/douyin/presale-vouchers').send(requestPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('图片必须是抖音可访问的 http/https URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('抖音同步失败会返回原始原因和日志ID，便于运营完成授权', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { error_code: 2119005, description: '应用未获商家授权' },
        extra: { error_code: 2119005, logid: 'DY_AUTH_LOG' }
      })
    });

    const response = await request(app).post('/api/douyin/presale-vouchers').send(payload(await createSyncedRatePlan()));

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe('应用未获商家授权（抖音日志ID：DY_AUTH_LOG）');
    expect(response.body.douyin_log_id).toBe('DY_AUTH_LOG');
  });
});
