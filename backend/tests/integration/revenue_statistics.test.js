const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const assertDateString = (s) => {
  const value = String(s || '');
  if (!DATE_REGEX.test(value)) {
    throw new Error(`Invalid date string: ${value}`);
  }
  return value;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const addDaysToDateString = (dateStr, days) => {
  const [y, m, d] = assertDateString(dateStr).split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out = new Date(base + days * DAY_MS);
  const outY = out.getUTCFullYear();
  const outM = String(out.getUTCMonth() + 1).padStart(2, '0');
  const outD = String(out.getUTCDate()).padStart(2, '0');
  return `${outY}-${outM}-${outD}`;
};

const buildDateSeries = (startDate, endDate) => {
  const start = assertDateString(startDate);
  const end = assertDateString(endDate);
  const list = [];
  for (let cur = start; cur <= end; cur = addDaysToDateString(cur, 1)) {
    list.push(cur);
  }
  return list;
};

const loadSqlFile = async (filePath) => {
  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (sql) {
    await query(sql);
  }
};

const loadFixtureData = async () => {
  const roomsSqlPath = path.resolve(__dirname, '../../../sql/rooms.sql');
  const roomTypesSqlPath = path.resolve(__dirname, '../../../sql/room_types.sql');
  const ordersSqlPath = path.resolve(__dirname, '../../../sql/orders.sql');
  const billsSqlPath = path.resolve(__dirname, '../../../sql/bills.sql');

  await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
  await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
  await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
  await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

  await loadSqlFile(roomTypesSqlPath);
  await loadSqlFile(roomsSqlPath);
  await loadSqlFile(ordersSqlPath);
  await loadSqlFile(billsSqlPath);
};

const getExpectedOverview = async ({ startDate, endDate, roomType = null }) => {
  const res = await query(
    `
      SELECT
        COUNT(DISTINCT order_id)::int AS total_orders,
        ROUND(COALESCE(SUM(COALESCE(total_price, 0))::numeric, 0), 2) AS total_revenue
      FROM orders
      WHERE stay_date::date BETWEEN $1::date AND $2::date
        AND status NOT IN ('cancelled')
        AND ($3::text IS NULL OR room_type = $3::text)
    `,
    [startDate, endDate, roomType]
  );
  const row = res.rows?.[0] || {};
  return {
    total_orders: Number(row.total_orders || 0),
    total_revenue: Number(row.total_revenue || 0),
  };
};

const getExpectedDailyMap = async ({ startDate, endDate, roomType = null }) => {
  const res = await query(
    `
      SELECT
        to_char(stay_date::date, 'YYYY-MM-DD') AS date,
        COUNT(DISTINCT order_id)::int AS order_count,
        ROUND(COALESCE(SUM(COALESCE(total_price, 0))::numeric, 0), 2) AS total_revenue
      FROM orders
      WHERE stay_date::date BETWEEN $1::date AND $2::date
        AND status NOT IN ('cancelled')
        AND ($3::text IS NULL OR room_type = $3::text)
      GROUP BY stay_date::date
    `,
    [startDate, endDate, roomType]
  );

  return (res.rows || []).reduce((acc, r) => {
    acc[r.date] = {
      order_count: Number(r.order_count || 0),
      total_revenue: Number(r.total_revenue || 0),
    };
    return acc;
  }, {});
};

describe('收入统计接口对账（复用交接班 SQL 数据，orders 口径）', () => {
  beforeAll(async () => {
    await loadFixtureData();
  });

  test.each([
    '2025-11-02',
    '2025-11-03',
    '2025-11-04',
    '2025-11-05',
    '2025-11-06',
    '2025-11-07',
    '2025-11-08',
    '2025-11-09',
  ])('GET /api/revenue/quick-stats 单日范围：%s 今日收入与 orders 对齐（排除 cancelled）', async (date) => {
    const expected = await getExpectedOverview({ startDate: date, endDate: date });

    const res = await request(app)
      .get('/api/revenue/quick-stats')
      .query({ startDate: date, endDate: date });

    expect(res.statusCode).toBe(200);
    expect(res.body?.data?.today?.date).toBe(date);
    expect(res.body?.data?.today?.total_orders).toBe(expected.total_orders);
    expect(Number(res.body?.data?.today?.total_revenue || 0)).toBe(expected.total_revenue);
  });

  test('GET /api/revenue/daily：返回完整日期区间（缺失天补0），数值与 orders 聚合一致', async () => {
    const startDate = '2025-11-01';
    const endDate = '2025-11-03';

    const expectedMap = await getExpectedDailyMap({ startDate, endDate });
    const expectedSeries = buildDateSeries(startDate, endDate);

    const res = await request(app)
      .get('/api/revenue/daily')
      .query({ startDate, endDate });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data.length).toBe(expectedSeries.length);

    // 后端当前按 date DESC 返回
    const returnedDates = res.body.data.map((r) => r.date);
    expect(returnedDates).toEqual([...expectedSeries].reverse());

    res.body.data.forEach((row) => {
      const date = row.date;
      const expected = expectedMap[date] || { order_count: 0, total_revenue: 0 };
      expect(Number(row.order_count || 0)).toBe(expected.order_count);
      expect(Number(row.total_revenue || 0)).toBe(expected.total_revenue);
    });
  });

  test('GET /api/revenue/daily-details：返回 orders 明细（排除 cancelled 且 total_price>0）', async () => {
    const date = '2025-11-04';

    const expectedRes = await query(
      `
        SELECT
          order_id,
          room_number,
          stay_date::text AS stay_date,
          COALESCE(total_price, 0) AS total_price,
          payment_method
        FROM orders
        WHERE stay_date::date BETWEEN $1::date AND $2::date
          AND status NOT IN ('cancelled')
          AND COALESCE(total_price, 0) > 0
        ORDER BY stay_date::date DESC, room_number ASC, order_id ASC
      `,
      [date, date]
    );

    const expectedRows = (expectedRes.rows || []).map((r) => ({
      order_id: String(r.order_id),
      room_number: String(r.room_number),
      stay_date: String(r.stay_date),
      total_amount: Number(r.total_price || 0),
      payment_method: r.payment_method,
    }));

    const res = await request(app)
      .get('/api/revenue/daily-details')
      .query({ startDate: date, endDate: date });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body?.data)).toBe(true);

    const actual = res.body.data.map((r) => ({
      order_id: String(r.order_number || r.order_id || ''),
      room_number: String(r.room_number),
      stay_date: String(r.stay_date),
      total_amount: Number(r.total_amount || 0),
      payment_method: r.payment_method,
    }));

    expect(actual.length).toBe(expectedRows.length);
    expectedRows.forEach((expectedRow) => {
      const found = actual.find((a) =>
        a.order_id === expectedRow.order_id &&
        a.room_number === expectedRow.room_number &&
        a.stay_date === expectedRow.stay_date
      );
      expect(found).toBeTruthy();
      expect(found.total_amount).toBe(expectedRow.total_amount);
    });
  });
});

