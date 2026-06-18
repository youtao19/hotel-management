const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { authedRequest } = require('../tools');

// 中文注释：固定测试日期，避免依赖数据库 current_date 导致断言不稳定。
const TARGET_DATE = '2026-02-10';
const PREV_DATE = '2026-02-09';

describe('收入统计：补收与租车收入口径', () => {
  beforeAll(async () => {
    // 中文注释：清理相关表，确保每次测试从干净数据开始。
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

    // 中文注释：准备最小化房型与房间数据，满足 orders 外键约束。
    await query(
      `
        INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
        VALUES ('TEST_STD_ROOM', '测试标准房', 200, '测试房型', false)
      `
    );
    await query(
      `
        INSERT INTO rooms (room_number, type_code, status, price, is_closed)
        VALUES
          ('TEST_101', 'TEST_STD_ROOM', 'available', 200, false),
          ('TEST_102', 'TEST_STD_ROOM', 'available', 200, false)
      `
    );

    // 中文注释：插入“今日订单”与“昨日订单”，用于验证补收跨 stay_date 计入 create_time 当天。
    await query(
      `
        INSERT INTO orders (
          order_id, id_source, order_source, guest_name, phone, room_type, room_number,
          check_in_date, check_out_date, stay_date, status, payment_method, total_price,
          deposit, is_prepaid, prepaid_amount, create_time, stay_type, remarks
        ) VALUES
          ($1, 'SRC-TODAY', '前台', '今日客人', '13800000001', 'TEST_STD_ROOM', 'TEST_101',
           $2::date, ($2::date + INTERVAL '1 day')::date, $2::date, 'pending', '微信', 200,
           0, false, 0, ($2::text || 'T08:00:00+08:00')::timestamptz, '客房', '今日房费'),
          ($3, 'SRC-PREV', '前台', '昨日客人', '13800000002', 'TEST_STD_ROOM', 'TEST_102',
           $4::date, ($4::date + INTERVAL '1 day')::date, $4::date, 'pending', '现金', 300,
           0, false, 0, ($4::text || 'T08:00:00+08:00')::timestamptz, '客房', '昨日房费')
      `,
      ['ORDER_TODAY_001', TARGET_DATE, 'ORDER_PREV_001', PREV_DATE]
    );

    // 中文注释：插入金额调整“补收”（发生在 TARGET_DATE），应计入 TARGET_DATE 收入。
    await query(
      `
        INSERT INTO bills (
          order_id, room_number, guest_name, change_price, change_type, pay_way,
          create_time, remarks, stay_type, stay_date
        ) VALUES (
          'ORDER_PREV_001', 'TEST_102', '昨日客人', 80, '补收', '微信',
          ($1::text || 'T10:00:00+08:00')::timestamptz, '补收测试', '客房', $1::date
        )
      `,
      [TARGET_DATE]
    );

    // 中文注释：插入租车收入（无订单号），应计入 TARGET_DATE 收入。
    await query(
      `
        INSERT INTO bills (
          order_id, room_number, guest_name, change_price, change_type, pay_way,
          create_time, remarks, stay_type, stay_date
        ) VALUES (
          NULL, NULL, '租车客户', 50, '租车收入', '现金',
          ($1::text || 'T11:00:00+08:00')::timestamptz, '租车收入测试', '租车收入', $1::date
        )
      `,
      [TARGET_DATE]
    );

    // 中文注释：插入一条退款记录，确保负向账单不会被误算到收入中。
    await query(
      `
        INSERT INTO bills (
          order_id, room_number, guest_name, change_price, change_type, pay_way,
          create_time, remarks, stay_type, stay_date
        ) VALUES (
          'ORDER_TODAY_001', 'TEST_101', '今日客人', -20, '退款', '现金',
          ($1::text || 'T12:00:00+08:00')::timestamptz, '退款测试', '客房', $1::date
        )
      `,
      [TARGET_DATE]
    );
  });

  test('GET /api/revenue/quick-stats：单日口径包含补收与租车收入', async () => {
    const res = await authedRequest()
      .get('/api/revenue/quick-stats')
      .query({ startDate: TARGET_DATE, endDate: TARGET_DATE });

    expect(res.statusCode).toBe(200);
    expect(res.body?.data?.today?.total_revenue).toBe(330);
    expect(res.body?.data?.today?.total_orders).toBe(2);
  });

  test('GET /api/revenue/series?bucket=daily：每日趋势包含补收与租车收入', async () => {
    const res = await authedRequest()
      .get('/api/revenue/series')
      .query({
        startDate: PREV_DATE,
        endDate: TARGET_DATE,
        bucket: 'daily'
      });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);

    // 中文注释：后端按日期倒序返回，这里用 map 断言避免依赖数组顺序。
    const byDate = new Map(
      (res.body.data || []).map((item) => [
        String(item.date || ''),
        {
          total_revenue: Number(item.total_revenue || 0),
          order_count: Number(item.order_count || 0)
        }
      ])
    );

    expect(byDate.get(PREV_DATE)).toEqual({ total_revenue: 300, order_count: 1 });
    expect(byDate.get(TARGET_DATE)).toEqual({ total_revenue: 330, order_count: 2 });
  });

  test('GET /api/revenue/daily-details：明细表口径与今日收入一致', async () => {
    const res = await authedRequest()
      .get('/api/revenue/daily-details')
      .query({
        startDate: TARGET_DATE,
        endDate: TARGET_DATE
      });

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data)).toBe(true);

    // 中文注释：验证明细总额=当日房费(200)+补收(80)+租车收入(50)，且包含租车收入行。
    const totalAmount = (res.body.data || []).reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0
    );
    const hasCarIncome = (res.body.data || []).some(
      (row) => String(row.room_number || '') === '租车收入'
    );

    expect(Number(totalAmount.toFixed(2))).toBe(330);
    expect(hasCarIncome).toBe(true);
  });

  test('GET /api/revenue/bills：支持多条件筛选（日期+支付方式+账单类型）', async () => {
    const res = await authedRequest()
      .get('/api/revenue/bills')
      .query({
        date: TARGET_DATE,
        payWay: '现金',
        changeType: '租车收入'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data)).toBe(true);

    // 中文注释：目标只应命中“租车收入”这条现金账单。
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].change_type).toBe('租车收入');
    expect(Number(res.body.data[0].change_price)).toBe(50);
  });
});
