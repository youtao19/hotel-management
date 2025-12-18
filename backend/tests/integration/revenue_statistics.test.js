const path = require('path');
const fs = require('fs');
const request = require('supertest');
const Decimal = require('decimal.js');

const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');

/**
 * 收入统计验收用例（基于“交接班测试”SQL数据）
 *
 * 目的：
 * 1) 用固定 SQL 数据对账收入统计页的：首卡（今日/所选单日）+ 本周 + 本月（对应 quick-stats）
 * 2) 随机选择一个房型后，对账“每日营收明细”（daily-details）返回的每个订单贡献金额是否正确
 *
 * 收入口径（与你确认一致）：
 * - “收入”=房费的预期收入（以 bills.change_type='房费' 的记录为准），不包含收押/押金（bills.change_type='收押'/'押金'）
 * - 多日订单：不做均分，而是累加账单里每一天（stay_date）的实际房费
 * - 休息房：check_in_date = check_out_date，按 1 天计入当天
 *
 * 时区/日期规范说明：
 * - 业务 DATE 字段必须按字符串（YYYY-MM-DD）处理；不要 new Date(dateStr) 或 toISOString() 做业务计算
 * - 本文件仅在“计算星期/加减天数”时用 Date.UTC 构造 Date，并只使用 UTC getter
 */
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

const toDecimal = (v) => {
  if (Decimal.isDecimal(v)) return v;
  if (v === undefined || v === null || v === '') return new Decimal(0);
  const n = Number(v);
  return Number.isNaN(n) ? new Decimal(0) : new Decimal(n);
};

const round2 = (v) => Number(toDecimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const assertDateString = (dateStr) => {
  // 中文注释：所有日期参数必须是 YYYY-MM-DD 字符串，避免 Node.js Date 解析带来的时区偏差
  if (!DATE_REGEX.test(String(dateStr || ''))) throw new Error(`日期格式错误: ${dateStr}`);
  return String(dateStr);
};

const addDaysToDateString = (dateStr, days) => {
  // 中文注释：对 DATE 字符串做纯 UTC 计算（不依赖本机时区）
  const [y, m, d] = assertDateString(dateStr).split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out = new Date(base + days * DAY_MS);
  const outY = out.getUTCFullYear();
  const outM = String(out.getUTCMonth() + 1).padStart(2, '0');
  const outD = String(out.getUTCDate()).padStart(2, '0');
  return `${outY}-${outM}-${outD}`;
};

const enumerateDaysInclusive = (startDate, endDate) => {
  // 中文注释：生成 [startDate, endDate] 的每日列表（包含首尾）
  const out = [];
  let cursor = assertDateString(startDate);
  const end = assertDateString(endDate);
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDaysToDateString(cursor, 1);
  }
  return out;
};

// diffDays 在本测试中不再用于收入计算（房费以 bills.stay_date 明细为准），保留工具函数仅供必要时扩展

const getWeekStartDateString = (dateStr) => {
  // 中文注释：不使用 new Date(dateStr)，用 UTC 数值构造计算星期（周一为起始）
  const [y, m, d] = assertDateString(dateStr).split('-').map(Number);
  const tmp = new Date(Date.UTC(y, m - 1, d));
  const dow = tmp.getUTCDay(); // 0=周日
  const offset = (dow + 6) % 7; // 周一=0，周日=6
  return addDaysToDateString(dateStr, -offset);
};

/**
 * 计算“预期房费收入”（用于与 API 对账）
 *
 * 说明：
 * - 输入 bills 为 bills 表的行（本测试从数据库直接 select）
 * - 输出 overview：范围内总订单数（去重 order_id）与总收入（按 stay_date 的实际房费合计）
 * - 输出 daily：范围内每一天的订单数（去重 order_id）与当日收入（该日房费合计）
 */
const computeExpected = ({ bills, startDate, endDate, roomType = null }) => {
  const days = enumerateDaysInclusive(startDate, endDate);
  const daily = new Map(days.map(d => [d, { date: d, orderIds: new Set(), total: new Decimal(0) }]));
  const rangeOrderIds = new Set();

  for (const b of bills) {
    // 中文注释：只统计房费，且 stay_date 必须落在查询区间
    if (b.change_type !== '房费') continue;
    const stayDate = assertDateString(b.stay_date);
    if (stayDate < startDate || stayDate > endDate) continue;
    if (roomType && b.room_type !== roomType) continue;

    rangeOrderIds.add(b.order_id);
    const bucket = daily.get(stayDate);
    if (!bucket) continue; // 理论上不会发生（因为 stayDate 已在 days 内）
    bucket.orderIds.add(b.order_id);
    bucket.total = bucket.total.plus(toDecimal(b.change_price || 0));
  }

  const dailyRows = days.map(d => {
    const bucket = daily.get(d);
    return {
      date: d,
      order_count: bucket.orderIds.size,
      total_revenue: round2(bucket.total)
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalRevenue = dailyRows.reduce((sum, r) => sum.plus(toDecimal(r.total_revenue)), new Decimal(0));
  return {
    overview: {
      total_orders: rangeOrderIds.size,
      total_revenue: round2(totalRevenue)
    },
    daily: dailyRows
  };
};

describe('收入统计接口对账（基于交接班测试 SQL 数据）', () => {
  beforeAll(async () => {
    // 中文注释：导入交接班测试使用的 SQL 数据（与 handover 集成测试一致）
    const roomsSqlPath = path.resolve(__dirname, '../../../sql/rooms.sql');
    const roomTypesSqlPath = path.resolve(__dirname, '../../../sql/room_types.sql');
    const ordersSqlPath = path.resolve(__dirname, '../../../sql/orders.sql');
    const billsSqlPath = path.resolve(__dirname, '../../../sql/bills.sql');

    const executeSqlFile = async (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf8').trim();
      if (sql) await query(sql);
    };

    // 清空相关表，防止主键冲突
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

    await executeSqlFile(roomTypesSqlPath);
    await executeSqlFile(roomsSqlPath);
    await executeSqlFile(ordersSqlPath);
    await executeSqlFile(billsSqlPath);
  });

  test('快速统计：非单日选择时 today 仍为 current_date（不跟随 endDate）', async () => {
    const startDate = '2025-11-03';
    const endDate = '2025-11-05';

    const dbTodayRes = await query('SELECT current_date::text AS today', []);
    const dbToday = dbTodayRes.rows?.[0]?.today;
    expect(DATE_REGEX.test(String(dbToday))).toBe(true);

    const apiRes = await request(app)
      .get('/api/revenue/quick-stats')
      .query({ startDate, endDate });

    expect(apiRes.status).toBe(200);
    const data = apiRes.body?.data || {};
    expect(data.today).toMatchObject({ date: dbToday, period: 'today', label: '今日收入' });
  });

  test('快速统计：单日选择时 today 使用所选日期（首卡展示所选日期收入）', async () => {
    const selectedDate = '2025-11-04';

    const billRes = await query(
      `SELECT b.order_id, b.change_type, b.change_price, b.stay_date::text AS stay_date, o.room_type
         FROM bills b
         JOIN orders o ON o.order_id = b.order_id
        WHERE o.status NOT IN ('cancelled')`,
      []
    );
    const expected = computeExpected({ bills: billRes.rows, startDate: selectedDate, endDate: selectedDate }).overview;

    const apiRes = await request(app)
      .get('/api/revenue/quick-stats')
      .query({ startDate: selectedDate, endDate: selectedDate });

    expect(apiRes.status).toBe(200);
    const data = apiRes.body?.data || {};
    expect(data.today).toMatchObject({
      ...expected,
      date: selectedDate,
      period: 'today',
      label: `${selectedDate} 收入`
    });
  });

  test('每日趋势 /revenue/daily 返回完整日期区间，且与预期一致', async () => {
    // 中文注释：覆盖“每日趋势图”（后端应补齐日期区间，缺失天返回 0）
    const startDate = '2025-11-03';
    const endDate = '2025-11-05';

    const billRes = await query(
      `SELECT b.order_id, b.change_type, b.change_price, b.stay_date::text AS stay_date, o.room_type
         FROM bills b
         JOIN orders o ON o.order_id = b.order_id
        WHERE o.status NOT IN ('cancelled')`,
      []
    );
    const expected = computeExpected({ bills: billRes.rows, startDate, endDate });

    const apiRes = await request(app)
      .get('/api/revenue/daily')
      .query({ startDate, endDate });

    expect(apiRes.status).toBe(200);
    expect(apiRes.body).toHaveProperty('data');
    expect(apiRes.body.data).toEqual(expected.daily);
  });

  test('房型筛选后每日趋势 /revenue/daily?roomType=... 与预期一致', async () => {
    // 中文注释：覆盖“房型筛选”后的趋势数据（后端执行房型过滤逻辑，前端不做二次判断）
    const startDate = '2025-11-03';
    const endDate = '2025-11-05';

    const rtRes = await query('SELECT type_code FROM room_types ORDER BY type_code LIMIT 1', []);
    const roomType = rtRes.rows?.[0]?.type_code;
    expect(roomType).toBeTruthy();

    const billRes = await query(
      `SELECT b.order_id, b.change_type, b.change_price, b.stay_date::text AS stay_date, o.room_type
         FROM bills b
         JOIN orders o ON o.order_id = b.order_id
        WHERE o.status NOT IN ('cancelled')`,
      []
    );
    const expected = computeExpected({ bills: billRes.rows, startDate, endDate, roomType });

    const apiRes = await request(app)
      .get('/api/revenue/daily')
      .query({ startDate, endDate, roomType });

    expect(apiRes.status).toBe(200);
    expect(apiRes.body).toHaveProperty('data');
    expect(apiRes.body.data).toEqual(expected.daily);
  });

  test('快速统计 /revenue/quick-stats?baseDate=... 与预期一致（周起始=周一）', async () => {
    // 中文注释：
    // - quick-stats 用于收入统计页的“今日/本周/本月”
    // - 为了使用固定 SQL 数据对账，这里传 baseDate 来模拟“今天”
    // - 周起始口径：周一为一周开始
    const baseDate = '2025-11-04';
    const weekStart = getWeekStartDateString(baseDate);
    const monthStart = '2025-11-01';

    const billRes = await query(
      `SELECT b.order_id, b.change_type, b.change_price, b.stay_date::text AS stay_date, o.room_type
         FROM bills b
         JOIN orders o ON o.order_id = b.order_id
        WHERE o.status NOT IN ('cancelled')`,
      []
    );
    const expectedToday = computeExpected({ bills: billRes.rows, startDate: baseDate, endDate: baseDate }).overview;
    const expectedWeek = computeExpected({ bills: billRes.rows, startDate: weekStart, endDate: baseDate }).overview;
    const expectedMonth = computeExpected({ bills: billRes.rows, startDate: monthStart, endDate: baseDate }).overview;

    const apiRes = await request(app)
      .get('/api/revenue/quick-stats')
      .query({ baseDate });

    expect(apiRes.status).toBe(200);
    const data = apiRes.body?.data || {};
    expect(data.today).toMatchObject({ ...expectedToday, date: baseDate, period: 'today' });
    expect(data.thisWeek).toMatchObject({ ...expectedWeek, startDate: weekStart, endDate: baseDate, period: 'thisWeek' });
    expect(data.thisMonth).toMatchObject({ ...expectedMonth, startDate: monthStart, endDate: baseDate, period: 'thisMonth' });
  });

  test('随机房型：每日营收明细 /revenue/daily-details 展示金额与预期一致', async () => {
    // 中文注释：
    // - daily-details 是“每日营收明细表”（前端随机选择房型后用于展示订单级明细）
    // - 接口返回每个订单在查询区间内的“房费贡献金额”（按 nights 均分）
    const startDate = '2025-11-04';
    const endDate = '2025-11-05';

    const rtRes = await query('SELECT type_code FROM room_types ORDER BY type_code LIMIT 1', []);
    const roomType = rtRes.rows?.[0]?.type_code;
    expect(roomType).toBeTruthy();

    const billRes = await query(
      `SELECT b.order_id, b.change_type, b.change_price, b.stay_date::text AS stay_date, o.room_type, o.status
         FROM bills b
         JOIN orders o ON o.order_id = b.order_id
        WHERE o.status NOT IN ('cancelled')`,
      []
    );

    // 预期“每日营收明细”是一行一个订单在某一天(stay_date)的房费，因此按 (order_id|stay_date) 汇总
    const expectedByOrderDay = new Map();
    for (const b of billRes.rows) {
      if (b.change_type !== '房费') continue;
      if (b.room_type !== roomType) continue;
      const stayDate = assertDateString(b.stay_date);
      if (stayDate < startDate || stayDate > endDate) continue;
      const key = `${b.order_id}|${stayDate}`;
      const prev = toDecimal(expectedByOrderDay.get(key) || 0);
      expectedByOrderDay.set(key, round2(prev.plus(toDecimal(b.change_price || 0))));
    }

    const apiRes = await request(app)
      .get('/api/revenue/daily-details')
      .query({ startDate, endDate, roomType });

    expect(apiRes.status).toBe(200);
    expect(apiRes.body).toHaveProperty('success', true);
    const rows = apiRes.body.data || [];
    expect(rows.length).toBeGreaterThan(0);

    for (const r of rows) {
      const key = `${r.order_number}|${r.stay_date}`;
      const expectedAmount = expectedByOrderDay.get(key);
      expect(expectedAmount).toBeDefined();
      expect(round2(r.total_amount)).toBe(expectedAmount);
    }
  });
});
