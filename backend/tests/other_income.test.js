const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { authedRequest } = require('./tools');

const TEST_GUEST = `OTHER_INCOME_${Date.now()}`;
const TEST_TYPE = '租车收入';
const TEST_PAY_WAY = '微信';

describe('POST /api/bills/other-income', () => {
  afterAll(async () => {
    await query('DELETE FROM bills WHERE guest_name = $1', [TEST_GUEST]);
  });

  test('创建其他收入账单（含时分秒的 date-time）', async () => {
    const incomeDate = new Date().toISOString(); // RFC3339，含秒和时区 Z
    const payload = {
      income_type: TEST_TYPE,
      amount: 188.88,
      pay_way: TEST_PAY_WAY,
      income_date: incomeDate,
      guest_name: TEST_GUEST,
      remarks: 'API 自动化测试'
    };

    const res = await authedRequest().post('/api/bills/other-income').send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const stored = await query(
      'SELECT order_id, change_price, change_type, pay_way, create_time, stay_date, guest_name FROM bills WHERE guest_name = $1 ORDER BY bill_id DESC LIMIT 1',
      [TEST_GUEST]
    );

    expect(stored.rows.length).toBe(1);
    const row = stored.rows[0];
    expect(row.order_id).toBeNull();
    expect(Number(row.change_price)).toBeCloseTo(payload.amount);
    expect(row.change_type).toBe(payload.income_type);
    expect(row.pay_way).toBe(payload.pay_way);
    expect(row.guest_name).toBe(TEST_GUEST);
    expect(row.create_time).toBeTruthy();
    expect(row.stay_date).toBeTruthy();
  });

  test('收入时间非 date-time 应返回 400', async () => {
    const payload = {
      income_type: TEST_TYPE,
      amount: 50,
      pay_way: TEST_PAY_WAY,
      income_date: '2025-11-18', // 非 date-time
      guest_name: `${TEST_GUEST}_INVALID`,
      remarks: '无效时间格式'
    };

    const res = await authedRequest().post('/api/bills/other-income').send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('请求数据格式不正确');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});
