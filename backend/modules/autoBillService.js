"use strict";

const setup = require("../appSettings/setup");
const { query } = require("../database/postgreDB/pg");
const emailJob = require("./emailSetup");
const { formatDate } = require("./tools");

const SUPPORTED_PAY_WAYS = new Set(['现金', '微信', '微邮付', '平台']);
const ENGLISH_PAYWAY_MAP = {
  cash: '现金',
  wechat: '微信',
  weiyoufu: '微邮付',
  other: '其他'
};

const CHANGE_TYPE_ROOM_FEE = setup.changeType?.roomFee || '房费';

const DATE_FORMATTER_CACHE = new Map();

function getFormatter(timezone = 'Asia/Shanghai') {
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

function formatDateWithTimezone(dateInput, timezone = 'Asia/Shanghai') {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now());
  const formatter = getFormatter(timezone);
  return formatter.format(date);
}

function normalizePayWay(value) {
  if (!value) {
    return '现金';
  }
  const trimmed = String(value).trim();
  if (SUPPORTED_PAY_WAYS.has(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (ENGLISH_PAYWAY_MAP[lower]) {
    return ENGLISH_PAYWAY_MAP[lower];
  }
  return '其他';
}

function determineStayType(order = {}) {
  if (order.stay_type) {
    return order.stay_type;
  }
  try {
    const checkIn = formatDate(order.check_in_date);
    const checkOut = formatDate(order.check_out_date);
    if (checkIn && checkOut) {
      return checkIn === checkOut ? '休息房' : '客房';
    }
  } catch {
    // ignore
  }
  return '客房';
}

function calculateStayNights(order = {}) {
  let checkInYmd = null;
  let checkOutYmd = null;
  try {
    checkInYmd = formatDate(order.check_in_date);
    checkOutYmd = formatDate(order.check_out_date);
  } catch {
    return 1;
  }
  if (!checkInYmd || !checkOutYmd) return 1;

  const ymdToUtcMs = (ymd) => {
    const [y, m, d] = String(ymd).split('-').map(Number);
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  };

  const startMs = ymdToUtcMs(checkInYmd);
  const endMs = ymdToUtcMs(checkOutYmd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 1;

  const diff = endMs - startMs;
  if (diff <= 0) return 1;
  return Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)));
}

function calculateDailyAmount(order = {}) {
  const totalPrice = Number(order.total_price);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return 0;
  }

  // 如果订单已经按日拆分（存在 stay_date），直接使用当日价格
  if (order.stay_date) {
    return Number(totalPrice.toFixed(2));
  }

  const nights = calculateStayNights(order);
  const amount = totalPrice / nights;
  return Number(amount.toFixed(2));
}

async function fetchCandidateOrders(targetDate, statuses) {
  const sql = `
    SELECT
      order_id,
      room_number,
      guest_name,
      check_in_date,
      check_out_date,
      stay_date,
      status,
      payment_method,
      total_price,
      stay_type
    FROM orders
    WHERE check_in_date <= $1::date
      AND check_out_date > $1::date
      AND status = ANY($2::text[])
  `;
  const { rows } = await query(sql, [targetDate, statuses]);
  return rows;
}

async function hasBillForDate(orderId, stayDate) {
  const checkSql = `
    SELECT bill_id
    FROM bills
    WHERE order_id = $1
      AND stay_date = $2::date
      AND change_type = $3
    LIMIT 1
  `;
  const { rowCount } = await query(checkSql, [orderId, stayDate, CHANGE_TYPE_ROOM_FEE]);
  return rowCount > 0;
}

async function insertDailyBill(order, stayDate, amount) {
  const insertSql = `
    INSERT INTO bills (
      order_id,
      room_number,
      guest_name,
      change_price,
      change_type,
      pay_way,
      create_time,
      remarks,
      stay_type,
      stay_date
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, NOW(), $7, $8, $9
    )
    RETURNING bill_id
  `;

  const payWay = normalizePayWay(order.payment_method);
  const stayType = determineStayType(order);
  const remarks = `自动创建当日账单（${stayDate}）`;

  const roomNumber = order.room_number ? String(order.room_number).slice(0, 10) : null;

  const values = [
    order.order_id,
    roomNumber,
    order.guest_name,
    amount,
    CHANGE_TYPE_ROOM_FEE,
    payWay,
    remarks,
    stayType,
    stayDate
  ];

  const { rows } = await query(insertSql, values);
  return rows[0];
}

function buildEmailSummary(summary) {
  const {
    manualTrigger,
    targetDate,
    timezone,
    statusWhitelist,
    totalCandidates,
    createdBills,
    skippedExisting,
    skippedNoAmount,
    failures,
    startedAt,
    finishedAt,
    runError
  } = summary;

  const lines = [];
  lines.push(`自动账单任务：${manualTrigger ? '手动触发' : '计划任务'}`);
  lines.push(`执行时间：${new Date(startedAt).toLocaleString('zh-CN', { hour12: false })} - ${new Date(finishedAt).toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`目标营业日：${targetDate}（时区：${timezone}）`);
  lines.push(`状态白名单：${statusWhitelist.join(', ') || '（空）'}`);
  lines.push(`候选订单：${totalCandidates}`);
  lines.push(`已创建账单：${createdBills.length}`);
  lines.push(`已存在跳过：${skippedExisting.length}`);
  lines.push(`金额无效跳过：${skippedNoAmount.length}`);
  lines.push(`失败：${failures.length}`);

  if (createdBills.length) {
    lines.push('');
    lines.push('✅ 新增账单：');
    createdBills.slice(0, 20).forEach(item => {
      lines.push(`- 订单 ${item.orderId} -> 账单 ${item.billId} 金额 ¥${item.amount.toFixed(2)}`);
    });
    if (createdBills.length > 20) {
      lines.push(`… 其余 ${createdBills.length - 20} 条已省略`);
    }
  }

  if (failures.length) {
    lines.push('');
    lines.push('❌ 失败详情：');
    failures.slice(0, 20).forEach(item => {
      lines.push(`- 订单 ${item.orderId}: ${item.message}`);
    });
    if (failures.length > 20) {
      lines.push(`… 其余 ${failures.length - 20} 条已省略`);
    }
  }

  if (skippedNoAmount.length) {
    lines.push('');
    lines.push('ℹ️ 因金额为0跳过：');
    skippedNoAmount.slice(0, 20).forEach(orderId => lines.push(`- ${orderId}`));
    if (skippedNoAmount.length > 20) {
      lines.push(`… 其余 ${skippedNoAmount.length - 20} 条已省略`);
    }
  }

  if (runError) {
    lines.push('');
    lines.push(`运行错误：${runError.message}`);
  }

  return lines.join('\n');
}

async function sendSummaryEmail(summary) {
  if (!setup.autoBillJob.monitorWithEmailOnly) {
    return;
  }
  const to = setup.autoBillJob.alertEmails;
  if (!to || !to.length) {
    console.warn('[autoBillService] 未配置告警邮箱，略过发送汇总邮件');
    return;
  }
  const subject = `${setup.appName} 自动账单任务汇总（${summary.targetDate}）`;
  const text = buildEmailSummary(summary);
  await emailJob.sendSystemEmail({ to, subject, text });
}

async function runAutoBillJob(options = {}) {
  const {
    forceRun = false,
    targetDate: targetDateOption,
    manualTrigger = false,
    disableReport = false
  } = options;
  const shouldSendReport = !disableReport;

  if (!setup.autoBillJob.enabled && !forceRun) {
    const summary = {
      manualTrigger,
      targetDate: targetDateOption || formatDateWithTimezone(new Date(), setup.autoBillJob.timezone),
      timezone: setup.autoBillJob.timezone,
      statusWhitelist: [...setup.autoBillJob.statusWhitelist],
      totalCandidates: 0,
      createdBills: [],
      skippedExisting: [],
      skippedNoAmount: [],
      failures: [],
      startedAt: new Date(),
      finishedAt: new Date(),
      runError: new Error('自动账单任务已禁用')
    };
    if (shouldSendReport) {
      await sendSummaryEmail(summary);
    }
    throw summary.runError;
  }

  const timezone = setup.autoBillJob.timezone || 'Asia/Shanghai';
  const targetDate = targetDateOption || formatDateWithTimezone(new Date(), timezone);
  const statusWhitelist = [...setup.autoBillJob.statusWhitelist].filter(Boolean);

  const summary = {
    manualTrigger,
    targetDate,
    timezone,
    statusWhitelist,
    totalCandidates: 0,
    createdBills: [],
    skippedExisting: [],
    skippedNoAmount: [],
    failures: [],
    startedAt: new Date(),
    finishedAt: null,
    runError: null
  };

  try {
    if (!statusWhitelist.length) {
      throw new Error('未配置订单状态白名单');
    }

    const candidates = await fetchCandidateOrders(targetDate, statusWhitelist);
    summary.totalCandidates = candidates.length;
    console.log(`[autoBillJob] ${targetDate} 候选订单 ${candidates.length} 条（状态: ${statusWhitelist.join(', ')})`);

    for (const order of candidates) {
      try {
        const amount = calculateDailyAmount(order);
        if (amount <= 0) {
          summary.skippedNoAmount.push(order.order_id);
          continue;
        }

        const exists = await hasBillForDate(order.order_id, targetDate);
        if (exists) {
          summary.skippedExisting.push(order.order_id);
          continue;
        }

        const inserted = await insertDailyBill(order, targetDate, amount);
        summary.createdBills.push({
          orderId: order.order_id,
          billId: inserted.bill_id,
          amount
        });
      } catch (orderErr) {
        console.error(`[autoBillJob] 订单 ${order.order_id} 处理失败:`, orderErr);
        summary.failures.push({
          orderId: order.order_id,
          message: orderErr.message || '未知错误'
        });
      }
    }
  } catch (err) {
    summary.runError = err;
    console.error('[autoBillJob] 执行过程中出现错误:', err);
  } finally {
    summary.finishedAt = new Date();
    if (shouldSendReport) {
      try {
        await sendSummaryEmail(summary);
      } catch (emailErr) {
        console.error('[autoBillJob] 发送监控邮件失败:', emailErr);
      }
    }
  }

  if (summary.runError) {
    throw summary.runError;
  }

  return summary;
}

module.exports = {
  runAutoBillJob,
  calculateDailyAmount,
  formatDateWithTimezone
};
