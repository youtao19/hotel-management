"use strict";

const Decimal = require("decimal.js");
const { query } = require("../../database/postgreDB/pg");

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toDecimal = (value) => {
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
};

const round2 = (val) =>
  Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());

function assertDateString(dateStr, fieldName) {
  const s = String(dateStr || "");
  if (!DATE_REGEX.test(s)) {
    throw new Error(`${fieldName || "date"} 格式错误，请使用 YYYY-MM-DD`);
  }
  return s;
}

function addDaysToDateString(dateStr, days) {
  const [y, m, d] = assertDateString(dateStr, "date").split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out = new Date(base + days * DAY_MS);
  const outY = out.getUTCFullYear();
  const outM = String(out.getUTCMonth() + 1).padStart(2, "0");
  const outD = String(out.getUTCDate()).padStart(2, "0");
  return `${outY}-${outM}-${outD}`;
}

function getWeekStartDateString(dateStr) {
  // 中文注释：周起始口径=周一；禁止对业务 DATE 字段使用 new Date(dateStr)，这里用 UTC 数值构造，避免时区解析偏差。
  const [y, m, d] = assertDateString(dateStr, "baseDate").split("-").map(Number);
  const tmp = new Date(Date.UTC(y, m - 1, d));
  const dow = tmp.getUTCDay(); // 0=周日
  const offset = (dow + 6) % 7; // 把周一映射为 0，周日映射为 6
  return addDaysToDateString(dateStr, -offset);
}

function getMonthStartDateString(dateStr) {
  const [y, m] = assertDateString(dateStr, "baseDate").split("-");
  return `${y}-${m}-01`;
}

/**
 * 计算两个 YYYY-MM-DD 字符串相差多少天
 * @param {string} date1 - 'YYYY-MM-DD'
 * @param {string} date2 - 'YYYY-MM-DD'
 * @returns {number} 天数差（date2 - date1）
 */
function diffDays(date1, date2) {
  const [y1, m1, d1] = date1.split("-").map(Number);
  const [y2, m2, d2] = date2.split("-").map(Number);

  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((t2 - t1) / DAY_MS);
}

function buildRevenueExpandedCTE() {
  // 中文注释：
  // 统一“收入统计”口径：
  // 1) 基础房费：orders.total_price（按 stay_date 计入，排除 cancelled）
  // 2) 订单补收：bills.change_type='补收' 且金额>0（按 DATE(create_time) 计入）
  // 3) 租车收入：bills.stay_type='租车收入' 且金额>0（按 DATE(create_time) 计入）
  // 说明：将不同来源收入统一映射到 revenue_events，后续统计统一从该 CTE 聚合，避免接口口径不一致。
  return `
    WITH order_room_fee AS (
      SELECT
        o.order_id,
        o.room_type,
        o.stay_date::date AS stay_date,
        SUM(COALESCE(o.total_price, 0)) AS room_fee
      FROM orders o
      WHERE o.stay_date::date BETWEEN $1::date AND $2::date
        AND o.status NOT IN ('cancelled')
        AND ($3::text IS NULL OR o.room_type = $3::text)
      GROUP BY o.order_id, o.room_type, o.stay_date::date
    ),
    bill_extra_income AS (
      SELECT
        b.order_id,
        CASE
          WHEN COALESCE(b.stay_type, '') = '租车收入' THEN NULL
          ELSE ord.room_type
        END AS room_type,
        DATE(b.create_time) AS stay_date,
        SUM(COALESCE(b.change_price, 0)) AS extra_income
      FROM bills b
      LEFT JOIN LATERAL (
        SELECT
          o.room_type
        FROM orders o
        WHERE o.order_id = b.order_id
        ORDER BY o.stay_date DESC NULLS LAST, o.create_time DESC NULLS LAST
        LIMIT 1
      ) ord ON TRUE
      WHERE DATE(b.create_time) BETWEEN $1::date AND $2::date
        AND COALESCE(b.change_price, 0) > 0
        AND (
          b.change_type = '补收'
          OR COALESCE(b.stay_type, '') = '租车收入'
        )
        AND (
          $3::text IS NULL
          OR (
            COALESCE(b.stay_type, '') <> '租车收入'
            AND ord.room_type = $3::text
          )
        )
      GROUP BY
        b.order_id,
        CASE
          WHEN COALESCE(b.stay_type, '') = '租车收入' THEN NULL
          ELSE ord.room_type
        END,
        DATE(b.create_time)
    ),
    revenue_events AS (
      SELECT
        order_id,
        room_type,
        stay_date,
        room_fee AS revenue_amount
      FROM order_room_fee
      UNION ALL
      SELECT
        order_id,
        room_type,
        stay_date,
        extra_income AS revenue_amount
      FROM bill_extra_income
    )
  `;
}

/**
 * 获取每日收入统计（返回完整日期区间，缺失天补 0）
 */
async function getDailyRevenue(startDate, endDate, roomType) {
  assertDateString(startDate, "startDate");
  assertDateString(endDate, "endDate");

  const sql = `
    ${buildRevenueExpandedCTE()}
    , daily_agg AS (
      SELECT
        stay_date AS date,
        COUNT(DISTINCT order_id) AS order_count,
        ROUND(SUM(revenue_amount)::numeric, 2) AS total_revenue
      FROM revenue_events
      GROUP BY stay_date
    ),
    calendar AS (
      SELECT generate_series($1::date, $2::date, interval '1 day')::date AS date
    )
    SELECT
      to_char(c.date, 'YYYY-MM-DD') AS date,
      COALESCE(d.order_count, 0)::int AS order_count,
      COALESCE(d.total_revenue, 0)::numeric AS total_revenue
    FROM calendar c
    LEFT JOIN daily_agg d ON d.date = c.date
    ORDER BY c.date DESC
  `;

  const res = await query(sql, [startDate, endDate, roomType || null]);
  return (res.rows || []).map((r) => ({
    date: r.date,
    order_count: Number(r.order_count || 0),
    total_revenue: round2(r.total_revenue || 0),
  }));
}

/**
 * 获取每周收入统计（按周日为周起始）
 */
async function getWeeklyRevenue(startDate, endDate, roomType) {
  assertDateString(startDate, "startDate");
  assertDateString(endDate, "endDate");

  const sql = `
    ${buildRevenueExpandedCTE()}
    , daily_agg AS (
      SELECT
        stay_date AS date,
        COUNT(DISTINCT order_id) AS order_count,
        ROUND(SUM(revenue_amount)::numeric, 2) AS total_revenue
      FROM revenue_events
      GROUP BY stay_date
    ),
    weekly AS (
      SELECT
        date_trunc('week', date::timestamp)::date AS week_start,
        (date_trunc('week', date::timestamp)::date + interval '6 day')::date AS week_end,
        SUM(order_count)::int AS order_count,
        ROUND(SUM(total_revenue)::numeric, 2) AS total_revenue
      FROM daily_agg
      GROUP BY 1, 2
    )
    SELECT
      to_char(week_start, 'YYYY-MM-DD') AS week_start,
      to_char(week_end, 'YYYY-MM-DD') AS week_end,
      order_count,
      total_revenue
    FROM weekly
    ORDER BY week_start DESC
  `;

  const res = await query(sql, [startDate, endDate, roomType || null]);
  return (res.rows || []).map((r) => ({
    week_start: r.week_start,
    week_end: r.week_end,
    order_count: Number(r.order_count || 0),
    total_revenue: round2(r.total_revenue || 0),
  }));
}

/**
 * 获取每月收入统计
 */
async function getMonthlyRevenue(startDate, endDate, roomType) {
  assertDateString(startDate, "startDate");
  assertDateString(endDate, "endDate");

  const sql = `
    ${buildRevenueExpandedCTE()}
    , daily_agg AS (
      SELECT
        stay_date AS date,
        COUNT(DISTINCT order_id) AS order_count,
        ROUND(SUM(revenue_amount)::numeric, 2) AS total_revenue
      FROM revenue_events
      GROUP BY stay_date
    ),
    monthly AS (
      SELECT
        date_trunc('month', date::timestamp)::date AS month_start,
        SUM(order_count)::int AS order_count,
        ROUND(SUM(total_revenue)::numeric, 2) AS total_revenue
      FROM daily_agg
      GROUP BY 1
    )
    SELECT
      to_char(month_start, 'YYYY-MM-DD') AS month_start,
      EXTRACT(YEAR FROM month_start)::int AS year,
      EXTRACT(MONTH FROM month_start)::int AS month,
      order_count,
      total_revenue
    FROM monthly
    ORDER BY month_start DESC
  `;

  const res = await query(sql, [startDate, endDate, roomType || null]);
  return (res.rows || []).map((r) => ({
    month_start: r.month_start,
    year: Number(r.year || 0),
    month: Number(r.month || 0),
    order_count: Number(r.order_count || 0),
    total_revenue: round2(r.total_revenue || 0),
  }));
}

/**
 * 获取收入概览统计（所选范围统计用）
 */
async function getOverview(startDate, endDate) {
  assertDateString(startDate, "startDate");
  assertDateString(endDate, "endDate");

  const sql = `
    ${buildRevenueExpandedCTE()}
    SELECT
      COUNT(DISTINCT order_id)::int AS total_orders,
      ROUND(COALESCE(SUM(revenue_amount)::numeric, 0), 2) AS total_revenue
    FROM revenue_events
  `;

  const res = await query(sql, [startDate, endDate, null]);
  const row = res.rows?.[0] || {};
  return {
    total_orders: Number(row.total_orders || 0),
    total_revenue: round2(row.total_revenue || 0),
  };
}

function minDateString(a, b) {
  // 中文注释：日期字符串 YYYY-MM-DD 可直接用字典序比较
  const sa = String(a || "");
  const sb = String(b || "");
  return sa <= sb ? sa : sb;
}

/**
 * 获取快速统计（今日/本周/本月）
 * 中文注释：
 * - 今日收入：orders.total_price + bills(补收/租车收入) 的合并口径
 * - 本周/本月：始终以数据库 current_date 为截止日（不跟随前端单日筛选）
 * - 通过 1 次汇总 SQL 同时计算三张卡片数据，减少重复查询
 */
async function getQuickStatsSummary(selectedToday) {
  const dbNow = await query(`SELECT current_date::text AS today`, []);
  const currentToday = dbNow.rows?.[0]?.today;

  const today = selectedToday ? assertDateString(selectedToday, "selectedToday") : currentToday;
  const thisWeekStartStr = getWeekStartDateString(currentToday);
  const thisMonthStartStr = getMonthStartDateString(currentToday);

  // 中文注释：选中日期可能早于本周/本月起始日，因此扩大底层扫描范围，保证 today/week/month 都可命中
  let rangeStart = minDateString(thisWeekStartStr, thisMonthStartStr);
  rangeStart = minDateString(rangeStart, today);

  const sql = `
    ${buildRevenueExpandedCTE()}
    SELECT
      COUNT(DISTINCT CASE WHEN stay_date = $4::date THEN order_id END)::int AS today_orders,
      ROUND(COALESCE(SUM(CASE WHEN stay_date = $4::date THEN revenue_amount END)::numeric, 0), 2) AS today_revenue,

      COUNT(DISTINCT CASE WHEN stay_date BETWEEN $5::date AND $2::date THEN order_id END)::int AS week_orders,
      ROUND(COALESCE(SUM(CASE WHEN stay_date BETWEEN $5::date AND $2::date THEN revenue_amount END)::numeric, 0), 2) AS week_revenue,

      COUNT(DISTINCT CASE WHEN stay_date BETWEEN $6::date AND $2::date THEN order_id END)::int AS month_orders,
      ROUND(COALESCE(SUM(CASE WHEN stay_date BETWEEN $6::date AND $2::date THEN revenue_amount END)::numeric, 0), 2) AS month_revenue
    FROM revenue_events
  `;

  const res = await query(sql, [
    rangeStart, // $1
    currentToday, // $2
    null, // $3 roomType：quick-stats 不做房型筛选
    today, // $4
    thisWeekStartStr, // $5
    thisMonthStartStr, // $6
  ]);

  const row = res.rows?.[0] || {};
  return {
    currentToday,
    today,
    thisWeekStartStr,
    thisMonthStartStr,
    todayStats: {
      total_orders: Number(row.today_orders || 0),
      total_revenue: round2(row.today_revenue || 0),
    },
    weekStats: {
      total_orders: Number(row.week_orders || 0),
      total_revenue: round2(row.week_revenue || 0),
    },
    monthStats: {
      total_orders: Number(row.month_orders || 0),
      total_revenue: round2(row.month_revenue || 0),
    },
  };
}

/**
 * 获取房型收入统计
 */
async function getRoomTypeRevenue(startDate, endDate) {
  assertDateString(startDate, "startDate");
  assertDateString(endDate, "endDate");

  const sql = `
    ${buildRevenueExpandedCTE()}
    , type_agg AS (
      -- 中文注释：房型维度仅统计可归属房型的收入；租车收入无房型归属，不纳入该表。
      SELECT
        room_type,
        COUNT(DISTINCT order_id)::int AS order_count,
        ROUND(SUM(revenue_amount)::numeric, 2) AS total_revenue
      FROM revenue_events
      WHERE room_type IS NOT NULL
      GROUP BY room_type
    )
    SELECT
      t.room_type,
      rt.type_name,
      t.order_count,
      t.total_revenue,
      CASE WHEN t.order_count > 0 THEN ROUND((t.total_revenue / t.order_count)::numeric, 2) ELSE 0 END AS avg_revenue_per_order
    FROM type_agg t
    LEFT JOIN room_types rt ON rt.type_code = t.room_type
    ORDER BY t.total_revenue DESC
  `;

  const res = await query(sql, [startDate, endDate, null]);
  return (res.rows || []).map((r) => ({
    room_type: r.room_type,
    type_name: r.type_name,
    order_count: Number(r.order_count || 0),
    total_revenue: round2(r.total_revenue || 0),
    avg_revenue_per_order: round2(r.avg_revenue_per_order || 0),
  }));
}

/**
 * 详细收入数据（账单明细）
 */
async function getRevenueBillDetails({
  date: filterDate,
  roomNumber,
  orderId,
  guestName,
  payWay,
  changeType
} = {}) {
  try {
    const params = [];
    const conditions = [];

    // 按单日过滤（create_time 的日期）
    if (filterDate) {
      params.push(filterDate);
      conditions.push(`DATE(b.create_time) = $${params.length}`);
    }

    // 房号精确匹配
    if (roomNumber) {
      params.push(roomNumber);
      conditions.push(`b.room_number = $${params.length}`);
    }

    // 订单号模糊匹配，便于快速检索
    if (orderId) {
      params.push(`%${orderId}%`);
      conditions.push(`b.order_id ILIKE $${params.length}`);
    }

    // 客人名模糊匹配
    if (guestName) {
      params.push(`%${guestName}%`);
      conditions.push(`b.guest_name ILIKE $${params.length}`);
    }

    // 支付方式精确筛选
    if (payWay) {
      params.push(payWay);
      conditions.push(`b.pay_way = $${params.length}`);
    }

    // 账单类型精确筛选
    if (changeType) {
      params.push(changeType);
      conditions.push(`b.change_type = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        b.bill_id,
        b.order_id,
        b.room_number,
        b.guest_name,
        b.change_price,
        b.change_type,
        b.pay_way,
        b.create_time,
        b.remarks,
        b.stay_date,
        b.stay_type
      FROM bills b
      ${whereClause}
      ORDER BY DATE(b.create_time) DESC, b.room_number DESC, b.bill_id DESC
    `;

    const result = await query(sql, params);
    return result.rows || [];
  } catch (error) {
    console.error("获取收入账单明细失败:", error);
    throw error;
  }
}

/**
 * 获取每日营收明细。
 */
async function getDailyRevenueDetails(startDate, endDate, roomType) {
  assertDateString(startDate, "startDate");
  assertDateString(endDate, "endDate");

  const sql = `
    WITH order_income AS (
      SELECT
        o.order_id::text AS id,
        o.order_id::text AS order_number,
        o.room_number,
        o.guest_name,
        o.room_type,
        rt.type_name AS room_type_name,
        o.stay_date::date AS stay_date,
        COALESCE(o.total_price, 0) AS total_amount,
        o.payment_method,
        o.check_out_date,
        1 AS sort_type
      FROM orders o
      LEFT JOIN room_types rt ON o.room_type = rt.type_code
      WHERE o.stay_date::date BETWEEN $1::date AND $2::date
        AND o.status NOT IN ('cancelled')
        AND ($3::text IS NULL OR o.room_type = $3::text)
    ),
    bill_income AS (
      SELECT
        ('BILL-' || b.bill_id)::text AS id,
        COALESCE(b.order_id, ('CAR-' || b.bill_id)::text) AS order_number,
        COALESCE(b.room_number, '租车收入') AS room_number,
        COALESCE(b.guest_name, '未知客户') AS guest_name,
        CASE
          WHEN COALESCE(b.stay_type, '') = '租车收入' THEN NULL
          ELSE ord.room_type
        END AS room_type,
        CASE
          WHEN COALESCE(b.stay_type, '') = '租车收入' THEN '租车收入'
          ELSE COALESCE(rt.type_name, ord.room_type)
        END AS room_type_name,
        DATE(b.create_time) AS stay_date,
        COALESCE(b.change_price, 0) AS total_amount,
        b.pay_way AS payment_method,
        NULL::date AS check_out_date,
        2 AS sort_type
      FROM bills b
      LEFT JOIN LATERAL (
        SELECT
          o.room_type
        FROM orders o
        WHERE o.order_id = b.order_id
        ORDER BY o.stay_date DESC NULLS LAST, o.create_time DESC NULLS LAST
        LIMIT 1
      ) ord ON TRUE
      LEFT JOIN room_types rt ON rt.type_code = ord.room_type
      WHERE DATE(b.create_time) BETWEEN $1::date AND $2::date
        AND COALESCE(b.change_price, 0) > 0
        AND (
          b.change_type = '补收'
          OR COALESCE(b.stay_type, '') = '租车收入'
        )
        AND (
          $3::text IS NULL
          OR (
            COALESCE(b.stay_type, '') <> '租车收入'
            AND ord.room_type = $3::text
          )
        )
    )
    SELECT
      id,
      order_number,
      room_number,
      guest_name,
      room_type,
      room_type_name,
      stay_date,
      total_amount,
      payment_method,
      check_out_date
    FROM (
      SELECT * FROM order_income
      UNION ALL
      SELECT * FROM bill_income
    ) t
    ORDER BY stay_date DESC, sort_type ASC, room_number ASC, order_number ASC
  `;

  const result = await query(sql, [startDate, endDate, roomType || null]);
  return (result.rows || []).map(row => ({
    id: row.id,
    order_number: row.order_number,
    room_number: row.room_number,
    guest_name: row.guest_name || "未知客户",
    room_type: row.room_type,
    room_type_name: row.room_type_name || row.room_type,
    total_amount: parseFloat(row.total_amount || 0),
    payment_method: row.payment_method,
    stay_date: String(row.stay_date || ""),
    check_out_date: row.check_out_date ? String(row.check_out_date) : "",
    stay_date_display: String(row.stay_date || "")
  }));
}

module.exports = {
  getDailyRevenue,
  getDailyRevenueDetails,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getRoomTypeRevenue,
  getRevenueBillDetails,
  getOverview,
  getQuickStatsSummary,
  // 供路由层“快速统计”使用的日期辅助函数
  getWeekStartDateString,
  getMonthStartDateString,
  addDaysToDateString,
  diffDays,
};
