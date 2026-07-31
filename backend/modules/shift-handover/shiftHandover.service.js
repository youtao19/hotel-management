"use strict";

const calculator = require("./shiftHandover.calculator");
const businessRules = require("./shiftHandover.businessRules");
const repository = require("./shiftHandover.repository");

const {
  PAYMENT_METHODS,
  amountToCents,
  centsToAmount,
  convertBucketsToAmounts,
  convertBucketsToCents,
  createPaymentBuckets,
  recalculatePaymentData
} = calculator;

const BILL_PAY_WAY_MAPPING = {
  "现金": "现金",
  "微信": "微信",
  "微邮付": "微邮付",
  "平台": "其他"
};

const PAYMENT_TYPE_MAPPING = { 1: "现金", 2: "微信", 3: "微邮付", 4: "其他" };
const SOURCE_ITEMS = [
  "hotelIncome",
  "restIncome",
  "carRentIncome",
  "hotelRefundDeposit",
  "restRefundDeposit"
];
const INCOME_CHANGE_TYPES = new Set(["房费", "收押", "订单账单", "补收", "退款"]);

function resolveOperatorName({ handoverPerson, account }) {
  return handoverPerson
    || account?.username
    || account?.name
    || account?.email
    || "系统";
}

function mapBillPaymentMethod(payWay) {
  return BILL_PAY_WAY_MAPPING[payWay] || "其他";
}

/**
 * 将单笔账单归属到交接表项目；收入调整按原始正负金额累计，退押改用绝对值以匹配退押列口径。
 */
function classifyBill(row) {
  const paymentMethod = mapBillPaymentMethod(row.pay_way);
  const amountCents = amountToCents(row.change_price);

  if (row.stay_type === "租车收入" || row.change_type === "租车收入") {
    return { item: "carRentIncome", paymentMethod, amountCents };
  }
  if (row.change_type === "退押") {
    if (row.stay_type === "客房") return { item: "hotelRefundDeposit", paymentMethod, amountCents: Math.abs(amountCents) };
    if (row.stay_type === "休息房") return { item: "restRefundDeposit", paymentMethod, amountCents: Math.abs(amountCents) };
    return null;
  }
  if (!INCOME_CHANGE_TYPES.has(row.change_type)) return null;
  if (row.stay_type === "客房") return { item: "hotelIncome", paymentMethod, amountCents };
  if (row.stay_type === "休息房") return { item: "restIncome", paymentMethod, amountCents };
  return null;
}

/**
 * 用同一分类结果同时生成金额桶和可展示的来源明细，防止两套口径逐渐偏离。
 */
function collectBillSources(rows) {
  const buckets = SOURCE_ITEMS.reduce((result, item) => {
    result[item] = createPaymentBuckets();
    return result;
  }, {});
  const sourceDetails = [];

  for (const row of rows) {
    const classified = classifyBill(row);
    if (!classified) continue;

    buckets[classified.item][classified.paymentMethod] += classified.amountCents;
    sourceDetails.push({
      item: classified.item,
      paymentMethod: classified.paymentMethod,
      billId: row.bill_id || null,
      orderId: row.order_id || null,
      roomNumber: row.room_number || null,
      guestName: row.guest_name || null,
      changeType: row.change_type || "",
      amount: centsToAmount(classified.amountCents),
      createTime: row.create_time || null,
      remarks: row.remarks || ""
    });
  }

  return { buckets, sourceDetails };
}

/**
 * 汇总账单到交接表金额；来源分类必须由 collectBillSources 统一提供。
 */
function aggregateBills(rows, reserve) {
  const { buckets, sourceDetails } = collectBillSources(rows);
  const hotelIncome = buckets.hotelIncome;
  const restIncome = buckets.restIncome;
  const carRentIncome = buckets.carRentIncome;
  const hotelDeposit = buckets.hotelRefundDeposit;
  const restDeposit = buckets.restRefundDeposit;

  const totalIncome = createPaymentBuckets();
  const retainedAmount = createPaymentBuckets();
  const handoverAmount = createPaymentBuckets();

  for (const method of PAYMENT_METHODS) {
    totalIncome[method] =
      hotelIncome[method] +
      restIncome[method] +
      carRentIncome[method] +
      reserve[method];
    handoverAmount[method] =
      totalIncome[method] -
      hotelDeposit[method] -
      restDeposit[method] -
      retainedAmount[method];
  }

  const response = {
    reserve: convertBucketsToAmounts(reserve),
    hotelIncome: convertBucketsToAmounts(hotelIncome),
    restIncome: convertBucketsToAmounts(restIncome),
    carRentIncome: convertBucketsToAmounts(carRentIncome),
    totalIncome: convertBucketsToAmounts(totalIncome),
    hotelDeposit: convertBucketsToAmounts(hotelDeposit),
    restDeposit: convertBucketsToAmounts(restDeposit),
    retainedAmount: convertBucketsToAmounts(retainedAmount),
    handoverAmount: convertBucketsToAmounts(handoverAmount)
  };

  response.hotelRefund = response.hotelDeposit;
  response.restRefund = response.restDeposit;
  response.hotelRefundDeposit = response.hotelDeposit;
  response.restRefundDeposit = response.restDeposit;

  return { paymentData: response, sourceDetails };
}

async function buildCalculatedPaymentData(date) {
  const predate = businessRules.getPreviousBusinessDate(date);

  let reserve = createPaymentBuckets();
  const reserveFromPrev = await repository.findReserveByDate(predate);
  if (reserveFromPrev) {
    reserve = convertBucketsToCents(reserveFromPrev);
    reserve["现金"] = 0;
  }

  const rows = await repository.findBillsByBusinessDate(date);
  return aggregateBills(rows, reserve).paymentData;
}

/**
 * 查询实时来源明细；当前交接和没有快照的旧历史记录都使用这一参考数据。
 */
async function buildLiveSourceDetails(date, item, paymentMethod) {
  const rows = await repository.findBillsByBusinessDate(date);
  const { sourceDetails } = collectBillSources(rows);
  return sourceDetails.filter((detail) => (
    (!item || detail.item === item)
    && (!paymentMethod || detail.paymentMethod === paymentMethod)
  ));
}

/**
 * 返回指定金额单元格的来源，优先读取完成交接时固定的快照。
 */
async function getSourceDetails({ date, item, paymentMethod }) {
  const isCompleted = await repository.isHandoverComplete(date);
  if (!isCompleted) {
    return { sourceMode: "live", details: await buildLiveSourceDetails(date, item, paymentMethod) };
  }
  if (await repository.hasSourceSnapshot(date)) {
    const rows = await repository.findSourceSnapshots({ date, item, paymentMethod });
    return {
      sourceMode: "snapshot",
      details: rows.map((row) => ({
        billId: row.bill_id,
        orderId: row.order_id,
        roomNumber: row.room_number,
        guestName: row.guest_name,
        changeType: row.change_type,
        amount: Number(row.source_amount || 0),
        createTime: row.bill_create_time,
        remarks: row.remarks || ""
      }))
    };
  }
  return { sourceMode: "reference", details: await buildLiveSourceDetails(date, item, paymentMethod) };
}

function mapSavedHandoverRows(rows) {
  const reserve = createPaymentBuckets();
  const hotelIncome = createPaymentBuckets();
  const restIncome = createPaymentBuckets();
  const carRentIncome = createPaymentBuckets();
  const totalIncome = createPaymentBuckets();
  const hotelDeposit = createPaymentBuckets();
  const restDeposit = createPaymentBuckets();
  const retainedAmount = createPaymentBuckets();
  const handoverAmount = createPaymentBuckets();

  let vipCards = 0;
  let handoverPerson = "";
  let takeoverPerson = "";
  let remarks = "";

  const cashRecord = rows.find((row) => row.payment_type === 1);
  if (cashRecord) {
    vipCards = Number(cashRecord.vip_card) || 0;
    handoverPerson = cashRecord.handover_person || "";
    takeoverPerson = cashRecord.takeover_person || "";
    remarks = cashRecord.remarks || "";
  }

  for (const row of rows) {
    const paymentMethod = PAYMENT_TYPE_MAPPING[row.payment_type];
    if (paymentMethod) {
      reserve[paymentMethod] = Number(row.reserve_cash || 0);
      hotelIncome[paymentMethod] = Number(row.room_income || 0);
      restIncome[paymentMethod] = Number(row.rest_income || 0);
      carRentIncome[paymentMethod] = Number(row.rent_income || 0);
      totalIncome[paymentMethod] = Number(row.total_income || 0);
      hotelDeposit[paymentMethod] = Number(row.room_refund || 0);
      restDeposit[paymentMethod] = Number(row.rest_refund || 0);
      retainedAmount[paymentMethod] = Number(row.retained || 0);
      handoverAmount[paymentMethod] = Number(row.handover || 0);
    }
  }

  return {
    reserve,
    hotelIncome,
    restIncome,
    carRentIncome,
    totalIncome,
    hotelDeposit,
    restDeposit,
    hotelRefund: hotelDeposit,
    restRefund: restDeposit,
    hotelRefundDeposit: hotelDeposit,
    restRefundDeposit: restDeposit,
    retainedAmount,
    handoverAmount,
    vipCards,
    handoverPerson,
    takeoverPerson,
    remarks
  };
}

async function getTableData(date) {
  const rows = await repository.findHandoverRowsByDate(date);
  if (rows.length === 0) {
    const [paymentData, cashReserveSetting] = await Promise.all([
      buildCalculatedPaymentData(date),
      repository.findDailyCashReserve(date)
    ]);
    const recalculated = recalculatePaymentData(paymentData, {
      reserve: {
        ...paymentData.reserve,
        "现金": cashReserveSetting?.cashReserve || 0
      },
      retainedAmount: {
        ...paymentData.retainedAmount,
        "现金": cashReserveSetting?.cashRetained || 0
      }
    });
    // 旧页面仍读取这两个别名，来源功能不能破坏已有交接表响应契约。
    recalculated.hotelRefund = recalculated.hotelDeposit;
    recalculated.restRefund = recalculated.restDeposit;
    return recalculated;
  }
  return mapSavedHandoverRows(rows);
}

async function getYesterdayRecord(date) {
  const yesterdayDate = businessRules.getPreviousBusinessDate(date);
  const summary = await repository.findPreviousHandoverSummary(yesterdayDate);
  const reserveDefaults = businessRules.buildReserveDefaults({
    isComplete: summary.isComplete,
    handoverAmounts: summary.handoverAmounts
  });

  return {
    date: yesterdayDate,
    hasRecord: summary.hasRecord,
    isComplete: summary.isComplete,
    paymentCount: summary.paymentCount,
    paymentTypes: summary.paymentTypes,
    handoverPerson: summary.handoverPerson,
    takeoverPerson: summary.takeoverPerson,
    handoverAmounts: summary.handoverAmounts,
    reserveDefaults,
    statusText: summary.isComplete
      ? "已完成"
      : summary.hasRecord
        ? "记录不完整"
        : "缺失"
  };
}

/**
 * 默认日期和写入资格由后端按北京时间统一判定，不能信任前端传入日期。
 */
async function resolveHandoverView(date) {
  const hasBeijingClock = typeof businessRules.getBeijingBusinessDate === "function";
  const today = hasBeijingClock ? businessRules.getBeijingBusinessDate() : date;
  const editableDate = hasBeijingClock ? businessRules.getPreviousBusinessDate(today) : date;
  const editableCompleted = await repository.isHandoverComplete(editableDate);
  const displayDate = date || (editableCompleted ? today : editableDate);
  return { today, displayDate, canEdit: displayDate === editableDate && !editableCompleted };
}

async function getOverview({ date, account }) {
  const view = await resolveHandoverView(date);
  const yesterdayRecord = await getYesterdayRecord(view.displayDate);
  const [specialStats, cashReserveSetting, isCompleted] = await Promise.all([
    repository.getOverviewSpecialStats(view.displayDate),
    repository.findDailyCashReserve(view.displayDate),
    repository.isHandoverComplete(view.displayDate)
  ]);
  const rawPaymentData = isCompleted
    ? await getTableData(view.displayDate)
    : view.displayDate < view.today
      ? aggregateBills([], createPaymentBuckets()).paymentData
      : await buildCalculatedPaymentData(view.displayDate);
  const reserve = {
    ...yesterdayRecord.reserveDefaults,
    "现金": cashReserveSetting?.cashReserve || 0
  };
  const paymentData = recalculatePaymentData(rawPaymentData, {
    reserve,
    retainedAmount: {
      ...rawPaymentData.retainedAmount,
      "现金": cashReserveSetting?.cashRetained || 0
    }
  });
  const configured = Boolean(cashReserveSetting);

  return {
    businessDate: view.displayDate,
    displayDate: view.displayDate,
    readOnly: !view.canEdit,
    currentShift: businessRules.resolveCurrentShift(),
    currentUser: businessRules.resolveCurrentUser(account),
    yesterdayRecord,
    isCompleted,
    cashReserveSetting: configured
      ? { configured: true, amount: cashReserveSetting.cashReserve, cashRetained: cashReserveSetting.cashRetained, setBy: cashReserveSetting.setBy, updatedAt: cashReserveSetting.updatedAt }
      : { configured: false, amount: null, cashRetained: null, setBy: null, updatedAt: null },
    paymentData,
    specialStats,
    canComplete: view.canEdit && configured && !isCompleted,
    completeBlockReasons: !configured
      ? ["请先设置今日备用金与留存款"]
      : !view.canEdit ? ["当前日期仅可查看"] : isCompleted ? ["当日交接已完成"] : []
  };
}

async function getSpecialStats(date) {
  return repository.getSpecialStats(date);
}

async function getAdminMemos(date) {
  const tasks = await repository.findAdminMemoTasks(date);
  return tasks.filter((task) => task.type === "admin");
}

async function completeHandover({ body, account }) {
  const {
    date,
    handoverPerson,
    receivePerson,
    retainedAmount,
    vipCard = 0,
    notes = ""
  } = body;
  const operatorName = resolveOperatorName({ handoverPerson, account });
  const overview = await getOverview({ date, account });
  if (overview.readOnly) {
    const error = new Error("当前日期仅可查看，不能完成交接");
    error.status = 409;
    throw error;
  }
  if (!overview.cashReserveSetting.configured) {
    const error = new Error("请先设置今日备用金与留存款");
    error.status = 409;
    throw error;
  }
  const paymentData = recalculatePaymentData(overview.paymentData, {
    retainedAmount: {
      ...retainedAmount,
      "现金": overview.cashReserveSetting.cashRetained
    }
  });

  const sourceDetails = await buildLiveSourceDetails(date, null, null);
  const savedRecords = await repository.saveCompletedHandover({
    date,
    operatorName,
    receivePerson,
    vipCard,
    notes,
    paymentData,
    sourceDetails
  });

  return {
    date,
    handoverPerson: operatorName,
    receivePerson: receivePerson.trim(),
    recordCount: savedRecords.length,
    records: savedRecords
  };
}

/**
 * 保存每日现金备用金与留存款；交接完成后拒绝修改，避免最终交接款失去可追溯性。
 * @param {{date: string, cashReserve: number, cashRetained: number, account: object}} input 设置请求
 * @returns {Promise<object>} 已保存设置
 */
async function setDailyCashReserve({ date, cashReserve, cashRetained, account }) {
  if (await repository.isHandoverComplete(date)) {
    const error = new Error("当日交接已完成，备用金与留存款不可修改");
    error.status = 409;
    throw error;
  }
  const view = await resolveHandoverView(date);
  if (!view.canEdit) {
    const error = new Error("当前日期仅可查看，不能设置备用金与留存款");
    error.status = 409;
    throw error;
  }

  const setBy = resolveOperatorName({ account });
  return repository.saveDailyCashReserve({ date, cashReserve, cashRetained, setBy });
}

module.exports = {
  completeHandover,
  getAdminMemos,
  getOverview,
  getSourceDetails,
  getSpecialStats,
  getTableData,
  resolveOperatorName,
  classifyBill,
  collectBillSources,
  setDailyCashReserve
};
