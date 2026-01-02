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

const parseCsvLine = (line) => {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
};

const toNullable = (value) => {
  if (value === undefined || value === null) return null;
  const s = String(value);
  return s === '' ? null : s;
};

const toNonEmptyString = (value, fallback) => {
  const s = toNullable(value);
  if (s) return s;
  return String(fallback || '');
};

const parseCsvRecords = (raw) => {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };

  const pushRecord = () => {
    // 忽略完全空行
    if (record.length === 1 && String(record[0] || '').trim() === '') {
      record = [];
      return;
    }
    records.push(record);
    record = [];
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (ch === '\r') {
      continue;
    }

    if (inQuotes) {
      if (ch === '"') {
        const next = raw[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      pushField();
      continue;
    }

    if (ch === '\n') {
      pushField();
      pushRecord();
      continue;
    }

    field += ch;
  }

  // flush last record
  pushField();
  pushRecord();

  return records;
};

const loadOrdersFromCsv = async (csvPath) => {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const records = parseCsvRecords(raw);
  if (!records.length) return;

  const header = (records[0] || []).map((h) => String(h || '').trim());
  const idx = (name) => header.indexOf(name);

  const required = [
    'order_id',
    'id_source',
    'order_source',
    'guest_name',
    'phone',
    'room_type',
    'room_number',
    'check_in_date',
    'check_out_date',
    'stay_date',
    'status',
    'payment_method',
    'total_price',
    'deposit',
    'create_time',
    'stay_type',
    'remarks',
    'is_prepaid',
    'prepaid_amount',
  ];

  required.forEach((col) => {
    if (idx(col) === -1) {
      throw new Error(`orders.csv missing required column: ${col}`);
    }
  });

  await query('DROP INDEX IF EXISTS uniq_orders_guest_stay;');
  await query('BEGIN;');
  try {
    for (let lineNo = 1; lineNo < records.length; lineNo++) {
      const fields = records[lineNo] || [];
      const v = (col) => toNullable(fields[idx(col)]);
      const orderId = toNonEmptyString(v('order_id'), `CSV_ROW_${lineNo}`);
      const guestName = toNonEmptyString(v('guest_name'), orderId);

      const requiredNotNull = [
        ['order_source', v('order_source')],
        ['room_type', v('room_type')],
        ['room_number', v('room_number')],
        ['check_in_date', v('check_in_date')],
        ['check_out_date', v('check_out_date')],
        ['stay_date', v('stay_date')],
        ['status', v('status')],
      ];
      const missing = requiredNotNull.filter(([, value]) => !value).map(([key]) => key);
      if (missing.length) {
        throw new Error(`orders.csv row ${lineNo + 1} missing required fields: ${missing.join(', ')}`);
      }

      await query(
        `
          INSERT INTO orders (
            order_id,
            id_source,
            order_source,
            guest_name,
            phone,
            room_type,
            room_number,
            check_in_date,
            check_out_date,
            stay_date,
            status,
            payment_method,
            total_price,
            deposit,
            create_time,
            stay_type,
            remarks,
            is_prepaid,
            prepaid_amount
          ) VALUES (
            $1::text,
            $2::text,
            $3::text,
            $4::text,
            $5::text,
            $6::text,
            $7::text,
            $8::date,
            $9::date,
            $10::date,
            $11::text,
            $12::text,
            $13::numeric,
            $14::numeric,
            $15::timestamptz,
            $16::text,
            $17::text,
            $18::boolean,
            $19::numeric
          )
        `,
        [
          orderId,
          v('id_source'),
          v('order_source'),
          guestName,
          v('phone'),
          v('room_type'),
          v('room_number'),
          v('check_in_date'),
          v('check_out_date'),
          v('stay_date'),
          v('status'),
          v('payment_method'),
          v('total_price'),
          v('deposit'),
          v('create_time'),
          v('stay_type'),
          v('remarks'),
          v('is_prepaid'),
          v('prepaid_amount'),
        ]
      );
    }

    await query('COMMIT;');
  } catch (e) {
    await query('ROLLBACK;');
    throw e;
  }
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
    const roomsSqlPath = path.resolve(__dirname, '../../../sql/rooms.sql');
    const roomTypesSqlPath = path.resolve(__dirname, '../../../sql/room_types.sql');
    const ordersCsvPath = path.resolve(__dirname, '../../../sql/orders.csv');

    const executeSqlFile = async (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf8').trim();
      if (sql) {
        await query(sql);
      }
    };

    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

    await executeSqlFile(roomTypesSqlPath);
    await executeSqlFile(roomsSqlPath);
    await loadOrdersFromCsv(ordersCsvPath);
  });

  test.each([
    ['2025-11-02', 3115.14],
    ['2025-11-03', 3233.97],
    ['2025-11-04', 3462.66],
    ['2025-11-05', 3675.12],
    ['2025-11-06', 2891.76],
    ['2025-11-07', 4845.85],
  ])('GET /api/revenue/quick-stats 单日范围：%s 今日收入=%s（来自 orders.csv）', async (date, expectedRevenue) => {
    const res = await request(app)
      .get('/api/revenue/quick-stats')
      .query({ startDate: date, endDate: date });

    expect(res.statusCode).toBe(200);
    expect(res.body?.data?.today?.date).toBe(date);
    expect(Number(res.body?.data?.today?.total_revenue || 0)).toBe(expectedRevenue);
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

  test('GET /api/revenue/daily-details：返回 orders 明细（排除 cancelled）', async () => {
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
