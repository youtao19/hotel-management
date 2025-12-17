"use strict";

const Decimal = require("decimal.js");
const { query } = require("../database/postgreDB/pg");

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
  // 预期房费收入口径（与你确认一致）：
  // - 以 bills 表中 change_type='房费' 的记录为准
  // - 多日订单不做“均分”，而是按账单里每一天的实际房费（stay_date）累加
  // - 明确排除押金/收押：不统计 change_type='收押'/'押金'
  return `
    WITH room_fee_bills AS (
      SELECT
        b.order_id,
        o.room_type,
        b.room_number,
        MAX(b.guest_name) AS guest_name,
        MAX(b.pay_way) AS pay_way,
        b.stay_date::date AS stay_date,
        SUM(COALESCE(b.change_price, 0)) AS room_fee
      FROM bills b
      JOIN orders o ON o.order_id = b.order_id
      WHERE b.change_type = '房费'
        AND b.stay_date::date BETWEEN $1::date AND $2::date
        AND o.status NOT IN ('cancelled')
        AND ($3::text IS NULL OR o.room_type = $3::text)
      GROUP BY b.order_id, o.room_type, b.room_number, b.stay_date::date
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
        ROUND(SUM(room_fee)::numeric, 2) AS total_revenue
      FROM room_fee_bills
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
        ROUND(SUM(room_fee)::numeric, 2) AS total_revenue
      FROM room_fee_bills
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
        ROUND(SUM(room_fee)::numeric, 2) AS total_revenue
      FROM room_fee_bills
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
      ROUND(COALESCE(SUM(room_fee)::numeric, 0), 2) AS total_revenue
    FROM room_fee_bills
  `;

  const res = await query(sql, [startDate, endDate, null]);
  const row = res.rows?.[0] || {};
  return {
    total_orders: Number(row.total_orders || 0),
    total_revenue: round2(row.total_revenue || 0),
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
      SELECT
        room_type,
        COUNT(DISTINCT order_id)::int AS order_count,
        ROUND(SUM(room_fee)::numeric, 2) AS total_revenue
      FROM room_fee_bills
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
async function getRevenueBillDetails({ date: filterDate, roomNumber } = {}) {
  try {
    const params = [];
    const conditions = [];

    if (filterDate) {
      params.push(filterDate);
      conditions.push(`DATE(b.create_time) = $${params.length}`);
    }

    if (roomNumber) {
      params.push(roomNumber);
      conditions.push(`b.room_number = $${params.length}`);
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
        b.stay_date
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

module.exports = {
  getDailyRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getRoomTypeRevenue,
  getRevenueBillDetails,
  getOverview,
  // 供路由层“快速统计”使用的日期辅助函数
  getWeekStartDateString,
  getMonthStartDateString,
  addDaysToDateString,
  diffDays,
};
