"use strict";

const { query } = require('../database/postgreDB/pg');

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEZONE = 'Asia/Shanghai';

// 支付方式标准化到中文标签
function normalizePaymentMethod(method) {
  if (!method) return '现金';
  const m = String(method).toLowerCase().trim();
  if (m.includes('现') || m.includes('cash')) return '现金';
  if (m.includes('微') && m.includes('信') || m.includes('wechat') || m.includes('weixin')) return '微信';
  if (m.includes('邮付') || m.includes('ali') || m.includes('pay') || m.includes('支付宝')) return '微邮付';
  if (m.includes('信') && m.includes('用') && m.includes('卡') || m.includes('credit')) return '信用卡';
  if (m === '微信') return '微信';
  if (m === '微邮付') return '微邮付';
  if (m === '现金') return '现金';
  if (m === '信用卡') return '信用卡';
  return '其他';
}

async function getPayWayMapByOrder(startDate, endDate) {
  // 选取每个订单的一条 pay_way 作为归类（如存在账单则优先用账单）
  const sql = `
        SELECT DISTINCT ON (b.order_id)
            b.order_id,
            b.pay_way
        FROM bills b
        JOIN orders o ON o.order_id = b.order_id
        WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
        ORDER BY b.order_id, b.bill_id ASC
    `;
  const res = await query(sql, [startDate, endDate]);
  const map = new Map();
  for (const r of res.rows) map.set(r.order_id, normalizePaymentMethod(r.pay_way));
  return map;
}

const DATE_FORMATTER_CACHE = new Map();

function getFormatter(timezone = TIMEZONE) {
  if (!DATE_FORMATTER_CACHE.has(timezone)) {
    DATE_FORMATTER_CACHE.set(timezone, new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }));
  }
  return DATE_FORMATTER_CACHE.get(timezone);
}

function formatDateOnly(dateInput, timezone = TIMEZONE) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now());
  return getFormatter(timezone).format(d); // YYYY-MM-DD
}

function toDateOnlyInTz(dateInput, timezone = TIMEZONE) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now());
  const formatted = getFormatter(timezone).format(d); // YYYY-MM-DD in target TZ
  return new Date(`${formatted}T00:00:00Z`); // treat as date-only anchor
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}



async function getRefundMapByDate(startDate, endDate) {
  const res = await query(
    `SELECT b.create_time::date as date, SUM(COALESCE(b.change_price,0) * -1) AS amount
           FROM bills b
           WHERE b.change_type IN ('退押', '退款') AND b.create_time::date BETWEEN $1 AND $2
           GROUP BY b.create_time::date`,
    [startDate, endDate]
  );
  const map = new Map();
  for (const r of res.rows) {
    const key = formatDateOnly(r.date);
    map.set(key, Number(r.amount || 0));
  }
  return map;
}

/**
 * 获取每日收入统计
 */
async function getDailyRevenue(startDate, endDate, roomType) {
  try {
    // 拉取区间内的订单
    const ordSql = `
            SELECT order_id, check_in_date, total_price, deposit, payment_method, room_type
            FROM orders
            WHERE DATE(check_in_date) BETWEEN $1 AND $2
        `;
    const [ordRes, payMap, refundMap] = await Promise.all([
      query(ordSql, [startDate, endDate]),
      getPayWayMapByOrder(startDate, endDate),
      getRefundMapByDate(startDate, endDate)
    ]);

    // 按天聚合
    const dayAgg = new Map();
    const orders = roomType
      ? ordRes.rows.filter(o => o.room_type === roomType)
      : ordRes.rows;

    for (const o of orders) {
      const day = formatDateOnly(o.check_in_date);
      if (!day) continue;
      const roomFee = Number(o.total_price || 0); // total_price 现在是数值类型
      const deposit = Number(o.deposit || 0);
      const total = roomFee + deposit;
      const method = payMap.get(o.order_id) || normalizePaymentMethod(o.payment_method);

      if (!dayAgg.has(day)) {
        dayAgg.set(day, {
          date: day,
          order_count: 0,
          bill_count: 0,
          total_revenue: 0,
          total_deposit_refund: 0,
          total_room_fee: 0,
          cash_orders: 0, wechat_orders: 0, alipay_orders: 0, credit_card_orders: 0,
          cash_revenue: 0, wechat_revenue: 0, alipay_revenue: 0, credit_card_revenue: 0
        });
      }
      const agg = dayAgg.get(day);
      agg.order_count += 1;
      agg.total_revenue += total;
      agg.total_room_fee += roomFee;

      // 计入支付方式
      const inc = (field, val) => agg[field] = (agg[field] || 0) + val;
      switch (method) {
        case '现金': inc('cash_orders', 1); inc('cash_revenue', total); break;
        case '微信': inc('wechat_orders', 1); inc('wechat_revenue', total); break;
        case '微邮付': inc('alipay_orders', 1); inc('alipay_revenue', total); break;
        case '信用卡': inc('credit_card_orders', 1); inc('credit_card_revenue', total); break;
        default: break; // 其他不单独统计
      }
    }

    // 合并当日退押
    for (const [day, agg] of dayAgg.entries()) {
      agg.total_deposit_refund = Number(refundMap.get(day) || 0);
    }

    // bill_count：有账单记录的订单数量（近似）
    let billCntRes;
    if (roomType) {
      const billCntSql = `
                SELECT DATE(o.check_in_date) as date, COUNT(DISTINCT b.order_id) as cnt
                FROM orders o
                LEFT JOIN bills b ON b.order_id = o.order_id
                WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
                  AND o.room_type = $3
                GROUP BY DATE(o.check_in_date)
            `;
      billCntRes = await query(billCntSql, [startDate, endDate, roomType]);
    } else {
      const billCntSql = `
                SELECT DATE(o.check_in_date) as date, COUNT(DISTINCT b.order_id) as cnt
                FROM orders o LEFT JOIN bills b ON b.order_id=o.order_id
                WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
                GROUP BY DATE(o.check_in_date)
            `;
      billCntRes = await query(billCntSql, [startDate, endDate]);
    }
    for (const r of billCntRes.rows) {
      const day = formatDateOnly(r.date);
      if (dayAgg.has(day)) dayAgg.get(day).bill_count = Number(r.cnt || 0);
    }

    return Array.from(dayAgg.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('获取每日收入统计数据库错误:', error);
    throw error;
  }
}

/**
 * 获取每周收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 每周收入统计数据
 */
async function getWeeklyRevenue(startDate, endDate, roomType) {
  try {
    const ordSql = `SELECT order_id, check_in_date, total_price, deposit, payment_method, room_type FROM orders WHERE DATE(check_in_date) BETWEEN $1 AND $2`;
    const [ordRes, payMap] = await Promise.all([
      query(ordSql, [startDate, endDate]),
      getPayWayMapByOrder(startDate, endDate)
    ]);

    const weekAgg = new Map();
    const orders = roomType
      ? ordRes.rows.filter(o => o.room_type === roomType)
      : ordRes.rows;

    for (const o of orders) {
      const dayStart = toDateOnlyInTz(o.check_in_date); // anchor to Asia/Shanghai
      const weekStart = addDays(dayStart, -dayStart.getUTCDay());
      const weekEnd = addDays(weekStart, 6);
      const wkKey = formatDateOnly(weekStart);

      const roomFee = Number(o.total_price || 0); const deposit = Number(o.deposit || 0); const total = roomFee + deposit;
      const method = payMap.get(o.order_id) || normalizePaymentMethod(o.payment_method);

      if (!weekAgg.has(wkKey)) {
        weekAgg.set(wkKey, {
          week_start: wkKey,
          week_end: formatDateOnly(weekEnd),
          year: dayStart.getUTCFullYear(),
          week_number: null, // 留空，未使用
          order_count: 0,
          bill_count: 0,
          total_revenue: 0,
          total_deposit_refund: 0,
          total_room_fee: 0,
          avg_daily_revenue: 0,
          cash_orders: 0, wechat_orders: 0, alipay_orders: 0, credit_card_orders: 0,
          cash_revenue: 0, wechat_revenue: 0, alipay_revenue: 0, credit_card_revenue: 0
        });
      }
      const agg = weekAgg.get(wkKey);
      agg.order_count += 1;
      agg.total_revenue += total;
      agg.total_room_fee += roomFee;
      const inc = (f, v) => agg[f] = (agg[f] || 0) + v;
      switch (method) {
        case '现金': inc('cash_orders', 1); inc('cash_revenue', total); break;
        case '微信': inc('wechat_orders', 1); inc('wechat_revenue', total); break;
        case '微邮付': inc('alipay_orders', 1); inc('alipay_revenue', total); break;
        case '信用卡': inc('credit_card_orders', 1); inc('credit_card_revenue', total); break;
      }
    }
    // 简单平均：总收入/订单数
    for (const agg of weekAgg.values()) {
      agg.avg_daily_revenue = agg.order_count ? (agg.total_revenue / agg.order_count) : 0;
    }
    return Array.from(weekAgg.values()).sort((a, b) => b.week_start.localeCompare(a.week_start));
  } catch (error) {
    console.error('获取每周收入统计数据库错误:', error);
    throw error;
  }
}

/**
 * 获取每月收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 每月收入统计数据
 */
async function getMonthlyRevenue(startDate, endDate, roomType) {
  try {
    const ordSql = `SELECT order_id, check_in_date, total_price, deposit, payment_method, room_type FROM orders WHERE DATE(check_in_date) BETWEEN $1 AND $2`;
    const [ordRes, payMap] = await Promise.all([
      query(ordSql, [startDate, endDate]),
      getPayWayMapByOrder(startDate, endDate)
    ]);
    const monthAgg = new Map();
    const orders = roomType
      ? ordRes.rows.filter(o => o.room_type === roomType)
      : ordRes.rows;

    for (const o of orders) {
      const monthAnchor = toDateOnlyInTz(o.check_in_date);
      const key = `${monthAnchor.getUTCFullYear()}-${(monthAnchor.getUTCMonth() + 1).toString().padStart(2, '0')}-01`;
      const roomFee = Number(o.total_price || 0); const deposit = Number(o.deposit || 0); const total = roomFee + deposit;
      const method = payMap.get(o.order_id) || normalizePaymentMethod(o.payment_method);
      if (!monthAgg.has(key)) {
        monthAgg.set(key, {
          month_start: key,
          year: monthAnchor.getUTCFullYear(),
          month: monthAnchor.getUTCMonth() + 1,
          order_count: 0,
          bill_count: 0,
          total_revenue: 0,
          total_deposit_refund: 0,
          total_room_fee: 0,
          avg_daily_revenue: 0,
          cash_orders: 0, wechat_orders: 0, alipay_orders: 0, credit_card_orders: 0,
          cash_revenue: 0, wechat_revenue: 0, alipay_revenue: 0, credit_card_revenue: 0
        });
      }
      const agg = monthAgg.get(key);
      agg.order_count += 1;
      agg.total_revenue += total;
      agg.total_room_fee += roomFee;
      const inc = (f, v) => agg[f] = (agg[f] || 0) + v;
      switch (method) {
        case '现金': inc('cash_orders', 1); inc('cash_revenue', total); break;
        case '微信': inc('wechat_orders', 1); inc('wechat_revenue', total); break;
        case '微邮付': inc('alipay_orders', 1); inc('alipay_revenue', total); break;
        case '信用卡': inc('credit_card_orders', 1); inc('credit_card_revenue', total); break;
      }
    }
    for (const agg of monthAgg.values()) {
      agg.avg_daily_revenue = agg.order_count ? (agg.total_revenue / agg.order_count) : 0;
    }
    return Array.from(monthAgg.values()).sort((a, b) => b.month_start.localeCompare(a.month_start));
  } catch (error) {
    console.error('获取每月收入统计数据库错误:', error);
    throw error;
  }
}

/**
 * 获取收入概览统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Object>} 收入概览数据
 */
async function getRevenueOverview(startDate, endDate) {
  try {
    // 查询与日期区间有交集的订单（跨日住宿也会被统计进来）
    // 条件解释：
    // check_in_date <= 结束日
    // check_out_date > 开始日（退房日不计费，因此 > 而不是 >=）
    // 排除已取消订单
    const ordSql = `
      SELECT order_id, total_price, deposit, payment_method, check_in_date, check_out_date
      FROM orders
      WHERE check_in_date::date <= $2::date
        AND check_out_date::date > $1::date
        AND NOT status IN ('cancelled')
    `;

    // 同时查询：
    // ① 区间内的订单
    // ② 每个订单的支付方式映射（优先账单中的支付方式）
    // ③ 区间内所有退押退款金额
    const [ordRes, payMap, refundRes] = await Promise.all([
      query(ordSql, [startDate, endDate]),
      getPayWayMapByOrder(startDate, endDate),
      query(
        `SELECT SUM(COALESCE(change_price,0) * -1) AS refund
         FROM bills
         WHERE change_type IN ('退押', '退款')
           AND create_time::date BETWEEN $1 AND $2`,
        [startDate, endDate]
      )
    ]);

    // 初始化概览统计对象，所有字段为累加器
    const overview = {
      total_orders: 0,          // 订单数量（按贡献天数计算后仍然算一个订单）
      total_revenue: 0,         // 汇总收入（房费 + 押金贡献）
      avg_order_value: 0,       // 平均订单金额
      total_deposit_refund: Number(refundRes.rows?.[0]?.refund || 0), // 退押退款总额
      total_room_fee: 0,        // 房费部分（按区间天数拆分）
      max_order_value: 0,       // 区间内单订单最高贡献额
      min_order_value: 0,       // 区间内单订单最低贡献额
      // 支付方式统计
      cash_orders: 0, wechat_orders: 0, alipay_orders: 0, credit_card_orders: 0,
      cash_revenue: 0, wechat_revenue: 0, alipay_revenue: 0, credit_card_revenue: 0
    };

    // 将区间起止转换为时区内的“日期零点”
    const rangeStart = toDateOnlyInTz(startDate);
    const rangeEnd = toDateOnlyInTz(endDate);

    // 遍历所有符合条件的订单，计算其在区间内的真实收入贡献
    for (const o of ordRes.rows) {
      // 将订单信息转化为数值与日期，避免出现字符串或时区偏移问题
      const roomFee = Number(o.total_price || 0);   // 整单房费
      const deposit = Number(o.deposit || 0);       // 入住押金
      const checkIn = toDateOnlyInTz(o.check_in_date);
      const checkOut = toDateOnlyInTz(o.check_out_date);
      const stayLastChargeDate = addDays(checkOut, -1); // 退房日不计费，因此减一天

      // 计算订单住宿天数（nights）
      let nights = Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
      if (nights <= 0) nights = 1; // 最少算一天

      // **计算订单在查询区间内的重叠天数**
      const overlapStart = rangeStart > checkIn ? rangeStart : checkIn;
      const overlapEnd = rangeEnd < stayLastChargeDate ? rangeEnd : stayLastChargeDate;

      // 若重叠区间无效，则该订单对本区间没有收入贡献
      if (overlapStart > overlapEnd) continue;

      // 计算订单在该区间内的具体天数
      const overlapDays =
        Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS) + 1;

      // → 房费按天拆分为 nightly price
      const perNightRoomFee = nights
        ? Number((roomFee / nights).toFixed(2))
        : roomFee;

      // → 房费在本区间的贡献
      const roomContribution = perNightRoomFee * overlapDays;

      // → 押金贡献规则：只有在区间内的入住日，押金才算进收入
      const depositContribution =
        (checkIn >= rangeStart && checkIn <= rangeEnd) ? deposit : 0;

      // → 订单此区间总贡献
      const total = roomContribution + depositContribution;

      // → 支付方式优先取账单映射，否则 fallback 为订单上的 payment_method
      const method = payMap.get(o.order_id) || normalizePaymentMethod(o.payment_method);

      // 累计概览数据
      overview.total_orders += 1;
      overview.total_revenue += total;
      overview.total_room_fee += roomContribution;

      // 更新最高单、最低单金额
      overview.max_order_value = Math.max(overview.max_order_value, total);
      overview.min_order_value =
        overview.min_order_value === 0
          ? total
          : Math.min(overview.min_order_value, total);

      // 累加支付方式
      const inc = (f, v) => (overview[f] = (overview[f] || 0) + v);
      switch (method) {
        case "现金":
          inc("cash_orders", 1);
          inc("cash_revenue", total);
          break;
        case "微信":
          inc("wechat_orders", 1);
          inc("wechat_revenue", total);
          break;
        case "微邮付":
          inc("alipay_orders", 1);
          inc("alipay_revenue", total);
          break;
      }
    }

    // 计算平均订单金额
    overview.avg_order_value =
      overview.total_orders
        ? overview.total_revenue / overview.total_orders
        : 0;

    return overview;
  } catch (error) {
    console.error("获取收入概览数据库错误:", error);
    throw error;
  }
}

/**
 * 获取房型收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 房型收入统计数据
 */
async function getRoomTypeRevenue(startDate, endDate) {
  try {
    const ordSql = `
            SELECT o.order_id, o.room_type, o.total_price, o.deposit, rt.type_name
            FROM orders o
            LEFT JOIN room_types rt ON o.room_type = rt.type_code
            WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
        `;
    const [ordRes, refundRes] = await Promise.all([
      query(ordSql, [startDate, endDate]),
      query(`SELECT SUM(COALESCE(change_price,0) * -1) AS refund FROM bills WHERE change_type IN ('退押', '退款') AND create_time::date BETWEEN $1 AND $2`, [startDate, endDate])
    ]);

    const typeAgg = new Map();
    for (const o of ordRes.rows) {
      const roomFee = Number(o.total_price || 0); const deposit = Number(o.deposit || 0); const total = roomFee + deposit;
      const key = o.room_type;
      if (!typeAgg.has(key)) {
        typeAgg.set(key, { room_type: key, type_name: o.type_name, order_count: 0, total_revenue: 0, avg_revenue_per_order: 0, total_room_fee: 0, total_deposit_refund: 0 });
      }
      const agg = typeAgg.get(key);
      agg.order_count += 1;
      agg.total_revenue += total;
      agg.total_room_fee += roomFee;
    }
    for (const agg of typeAgg.values()) {
      agg.avg_revenue_per_order = agg.order_count ? (agg.total_revenue / agg.order_count) : 0;
      agg.total_deposit_refund = Number(refundRes.rows?.[0]?.refund || 0); // 粗粒度：全区间退押平均分配不精准，但满足接口字段
    }
    return Array.from(typeAgg.values()).sort((a, b) => b.total_revenue - a.total_revenue);
  } catch (error) {
    console.error('获取房型收入统计数据库错误:', error);
    throw error;
  }
}

/**
 * 获取账单明细数据
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

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

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
    console.error('获取收入账单明细失败:', error);
    throw error;
  }
}

module.exports = {
  getDailyRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getRevenueOverview,
  getRoomTypeRevenue,
  getRevenueBillDetails
};
