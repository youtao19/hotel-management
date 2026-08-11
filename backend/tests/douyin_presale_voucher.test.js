const express = require('express');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.DOUYIN_ACCOUNT_ID = 'DY_VOUCHER_ACCOUNT';
process.env.DOUYIN_OPENAPI_BASE_URL = 'https://open.douyin.com';
process.env.APP_URL = 'https://voucher-test.ngrok-free.app';

jest.mock('../modules/douyin/token/token.service', () => ({ getToken: jest.fn() }));

const { query } = require('../database/postgreDB/pg');
const douyinTokenService = require('../modules/douyin/token/token.service');
const voucherRoute = require('../modules/douyin/presale-voucher/presaleVoucher.routes');
const { router: voucherUploadRoute, uploadDirectory } = require('../modules/douyin/presale-voucher/presaleVoucherUpload.routes');

const originalFetch = global.fetch;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/douyin/presale-vouchers', voucherRoute);
  app.use('/api/douyin/presale-vouchers', voucherUploadRoute);
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
    eachPersonMax: 3,
    eachPersonEachOrderMax: 2,
    cancelBookingType: 1,
    saleStartAt: '2099-08-01 00:00',
    saleEndAt: '2099-08-31 23:59',
    bookStartDate: '2099-08-01',
    bookEndDate: '2099-12-31',
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

  afterAll(() => {
    global.fetch = originalFetch;
    fs.rmSync(uploadDirectory, { recursive: true, force: true });
  });

  test('本地券面图上传后返回 ngrok 公网链接', async () => {
    const response = await request(app)
      .post('/api/douyin/presale-vouchers/images')
      .attach('images', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'head.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatch(/^https:\/\/voucher-test\.ngrok-free\.app\/uploads\/presale-vouchers\/.+\.jpg$/);
    expect(fs.existsSync(path.join(uploadDirectory, path.basename(response.body.data[0])))).toBe(true);
  });

  test('本地地址不能生成会提交给抖音的券面图链接', async () => {
    process.env.APP_URL = 'http://localhost:3000';

    const response = await request(app)
      .post('/api/douyin/presale-vouchers/images')
      .attach('images', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'head.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('APP_URL');
    process.env.APP_URL = 'https://voucher-test.ngrok-free.app';
  });

  test('新增预售券默认使用两分钟后的北京时间，并拒绝已过期的售卖时间', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-11T01:42:00.000Z'));
    try {
      const defaultResponse = await request(app).get('/api/douyin/presale-vouchers/sale-time-default');
      expect(defaultResponse.statusCode).toBe(200);
      expect(defaultResponse.body.data.saleStartAt).toBe('2026-08-11 09:44');

      const expiredPayload = payload(1);
      expiredPayload.saleStartAt = '2026-08-11 09:42';
      expiredPayload.saleEndAt = '2026-08-11 10:00';
      const response = await request(app).post('/api/douyin/presale-vouchers').send(expiredPayload);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('售卖开始时间必须晚于当前北京时间 2026-08-11 09:42');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

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
    expect(requestPayload.presale_info.pre_sale_coupon_id).toBeUndefined();
    expect(requestPayload.presale_info.pre_sale_coupon_info.bind_rate_plans).toEqual(['DY_RATE_PLAN_001']);
    expect(requestPayload.presale_info.pre_sale_coupon_info.actual_amount).toBe(80000);
    expect(requestPayload.presale_info.trade_info.customer_can_use_date).toEqual({
      use_date_type: 1,
      use_date: { from: '2099-08-01', to: '2099-12-31' }
    });
    expect(requestPayload.presale_info.trade_info.customer_can_use_time).toEqual({ use_time_type: 1 });
    expect(response.body.data).toMatchObject({ each_person_max: 3, each_person_each_order_max: 2 });
    expect(requestPayload.presale_info.trade_info.limt_buy_rule).toEqual({ each_person_max: 3, each_person_each_order_max: 2 });
    expect(requestPayload.presale_info.trade_info.book_rule).toEqual({ earliest_book_day: 30 });
    expect(response.body.data.cancel_booking_type).toBe(1);
    expect(requestPayload.presale_info.trade_info.cancel_booking_rule).toEqual({ cancel_type: 1 });
    expect(requestPayload.presale_info.trade_info.invoic_info).toEqual({ provider: 1 });
    expect(requestPayload.presale_info.note_info).toEqual({
      check_time_range: { from: '14:00', to: '12:00' },
      other_remark_info: ['需提前预约，以门店确认为准'],
      service_for_foreign: false,
      superimposed_discounts: false
    });
    expect(requestPayload.presale_info.out_id).toBe(`voucher-${response.body.data.id}`);
  });

  test('创建预售券会保存指定日期加价规则并按分同步到抖音', async () => {
    const requestPayload = payload(await createSyncedRatePlan());
    requestPayload.markupRules = [{
      amount: 88.5,
      startDate: '2099-10-01',
      endDate: '2099-10-07',
      weekdays: [5, 6, 7]
    }];

    const response = await request(app).post('/api/douyin/presale-vouchers').send(requestPayload);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.markup_rules).toEqual(requestPayload.markupRules);
    const douyinPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(douyinPayload.presale_info.pre_sale_coupon_info).toMatchObject({
      markup_type: 1,
      markup_info: [{
        markup_amount: 8850,
        markup_date_type: 1,
        markup_days: { from: '2099-10-01', to: '2099-10-07' },
        markup_days_of_week: [5, 6, 7]
      }]
    });
  });

  test('加价日期超出可预约范围时在调用抖音前拒绝', async () => {
    const requestPayload = payload(1);
    requestPayload.markupRules = [{ amount: 100, startDate: '2099-07-31', endDate: '2099-08-02', weekdays: [1, 2, 3, 4, 5, 6, 7] }];

    const response = await request(app).post('/api/douyin/presale-vouchers').send(requestPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('必须在可预约日期范围内');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('旧调用方未传退款规则时保持不可取消默认值', async () => {
    const requestPayload = payload(await createSyncedRatePlan());
    delete requestPayload.cancelBookingType;

    const response = await request(app).post('/api/douyin/presale-vouchers').send(requestPayload);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.cancel_booking_type).toBe(3);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).presale_info.trade_info.cancel_booking_rule).toEqual({ cancel_type: 3 });
  });

  test('限时取消会保存截止时间并按抖音契约同步免费取消规则', async () => {
    const requestPayload = payload(await createSyncedRatePlan());
    requestPayload.cancelBookingType = 2;
    requestPayload.cancelBookingOffsetDays = 2;
    requestPayload.cancelBookingOffsetHours = 6;

    const response = await request(app).post('/api/douyin/presale-vouchers').send(requestPayload);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({
      cancel_booking_type: 2,
      cancel_booking_offset_days: 2,
      cancel_booking_offset_hours: 6
    });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).presale_info.trade_info.cancel_booking_rule).toEqual({
      cancel_type: 2,
      cancel_time_type: 2,
      cancel_offset: [{
        time_offset: { day: 2, hour: 6 },
        cut_type: 1,
        cut_value: 0
      }]
    });
  });

  test('更新预售券会保存并同步新的用户限购配置', async () => {
    const ratePlanId = await createSyncedRatePlan();
    const created = await request(app).post('/api/douyin/presale-vouchers').send(payload(ratePlanId));
    const updatedPayload = { ...payload(ratePlanId), eachPersonMax: 5, eachPersonEachOrderMax: 3 };

    const response = await request(app)
      .put(`/api/douyin/presale-vouchers/${created.body.data.id}`)
      .send(updatedPayload);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({ each_person_max: 5, each_person_each_order_max: 3 });
    const requestPayload = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(requestPayload.presale_info.pre_sale_coupon_id).toBe('DY_VOUCHER_001');
    expect(requestPayload.presale_info.trade_info.limt_buy_rule).toEqual({ each_person_max: 5, each_person_each_order_max: 3 });
    expect(requestPayload.presale_info.pre_sale_coupon_info).toMatchObject({ markup_type: 1, markup_info: [] });
  });

  test('单笔限购大于累计限购时拒绝同步', async () => {
    const invalidPayload = payload(1);
    invalidPayload.eachPersonMax = 1;
    invalidPayload.eachPersonEachOrderMax = 2;

    const response = await request(app).post('/api/douyin/presale-vouchers').send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('单笔限购不能大于单用户累计限购');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('不支持的取消方式会在调用抖音前被拒绝', async () => {
    const invalidPayload = payload(1);
    invalidPayload.cancelBookingType = 4;

    const response = await request(app).post('/api/douyin/presale-vouchers').send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('cancelBookingType');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('限时取消缺少入住前截止时间时在调用抖音前被拒绝', async () => {
    const invalidPayload = payload(1);
    invalidPayload.cancelBookingType = 2;

    const response = await request(app).post('/api/douyin/presale-vouchers').send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('限时取消必须填写入住前的天数和小时数');
    expect(global.fetch).not.toHaveBeenCalled();
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
    expect(response.body.voucher_id).toEqual(expect.any(Number));
  });

  test('已同步预售券可调用商品状态接口上线，并保存状态与抖音日志ID', async () => {
    const created = await request(app).post('/api/douyin/presale-vouchers').send(payload(await createSyncedRatePlan()));
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ product_id: 'DY_VOUCHER_001', code: 0 }], extra: { error_code: 0, logid: 'DY_STATUS_ONLINE_LOG' } })
    });

    const response = await request(app)
      .patch(`/api/douyin/presale-vouchers/${created.body.data.id}/product-status`)
      .send({ operation: 'ONLINE' });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('预售券已上线');
    expect(response.body.data.product_status).toBe('ONLINE');
    expect(response.body.data.last_product_status_log_id).toBe('DY_STATUS_ONLINE_LOG');
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({
      account_id: 'DY_VOUCHER_ACCOUNT',
      product_id_list: ['DY_VOUCHER_001'],
      op_type: 1
    });
  });

  test('抖音商品状态失败会保留错误与日志ID，且不改变已确认状态', async () => {
    const created = await request(app).post('/api/douyin/presale-vouchers').send(payload(await createSyncedRatePlan()));
    await query(
      `UPDATE douyin_presale_vouchers SET product_status = 'ONLINE' WHERE id = $1`,
      [created.body.data.id]
    );
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ product_id: 'DY_VOUCHER_001', code: 3000001, message: '商品审核中，暂不能下线' }], extra: { error_code: 0, logid: 'DY_STATUS_FAILED_LOG' } })
    });

    const response = await request(app)
      .patch(`/api/douyin/presale-vouchers/${created.body.data.id}/product-status`)
      .send({ operation: 'OFFLINE' });

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe('商品审核中，暂不能下线（抖音日志ID：DY_STATUS_FAILED_LOG）');
    const saved = await query(
      'SELECT product_status, last_product_status_log_id, last_product_status_error FROM douyin_presale_vouchers WHERE id = $1',
      [created.body.data.id]
    );
    expect(saved.rows[0]).toEqual(expect.objectContaining({
      product_status: 'ONLINE',
      last_product_status_log_id: 'DY_STATUS_FAILED_LOG',
      last_product_status_error: '商品审核中，暂不能下线'
    }));
  });

  test('未同步预售券与不支持的操作类型不能请求抖音商品状态接口', async () => {
    const unsynced = await query(
      `INSERT INTO douyin_presale_vouchers
        (rate_plan_id, name, original_amount, actual_amount, inventory_is_limited, sale_start_at, sale_end_at, book_start_date, book_end_date, image_urls)
       VALUES ($1, '未同步预售券', 100, 80, false, '2026-08-01 00:00+08', '2026-08-31 23:59+08', '2026-08-01', '2026-12-31', '[]')
       RETURNING id`,
      [await createSyncedRatePlan()]
    );

    const unsyncedResponse = await request(app)
      .patch(`/api/douyin/presale-vouchers/${unsynced.rows[0].id}/product-status`)
      .send({ operation: 'ONLINE' });

    expect(unsyncedResponse.statusCode).toBe(400);
    expect(unsyncedResponse.body.message).toBe('预售券尚未成功同步到抖音，不能修改商品状态');
    await query(
      `UPDATE douyin_presale_vouchers SET sync_status = 1, douyin_voucher_id = 'DY_VOUCHER_001' WHERE id = $1`,
      [unsynced.rows[0].id]
    );
    const unsupportedResponse = await request(app)
      .patch(`/api/douyin/presale-vouchers/${unsynced.rows[0].id}/product-status`)
      .send({ operation: 'DELETE' });

    expect(unsupportedResponse.statusCode).toBe(400);
    expect(unsupportedResponse.body.message).toBe('操作类型仅支持 ONLINE 或 OFFLINE');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
