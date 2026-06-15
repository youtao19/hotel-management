"use strict";

const calculator = require("./shiftHandover.calculator");
const businessRules = require("./shiftHandover.businessRules");
const repository = require("./shiftHandover.repository");

const {
  PAYMENT_METHODS,
  amountToCents,
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

function aggregateBills(rows, reserve) {
  const hotelIncome = createPaymentBuckets();
  const restIncome = createPaymentBuckets();
  const carRentIncome = createPaymentBuckets();
  const hotelDeposit = createPaymentBuckets();
  const restDeposit = createPaymentBuckets();

  for (const row of rows) {
    const { pay_way: rawPayWay, change_price, change_type, stay_type } = row;
    const amountCents = amountToCents(change_price);
    const payWay = mapBillPaymentMethod(rawPayWay);

    if (change_type === "房费") {
      if (stay_type === "客房") {
        hotelIncome[payWay] += amountCents;
      } else if (stay_type === "休息房") {
        restIncome[payWay] += amountCents;
      }
    } else if (change_type === "收押") {
      if (stay_type === "客房") {
        hotelIncome[payWay] += amountCents;
      } else if (stay_type === "休息房") {
        restIncome[payWay] += amountCents;
      }
    } else if (change_type === "退押") {
      const refundAmount = Math.abs(amountCents);
      if (stay_type === "客房") {
        hotelDeposit[payWay] += refundAmount;
      } else if (stay_type === "休息房") {
        restDeposit[payWay] += refundAmount;
      }
    } else if (change_type === "订单账单") {
      if (stay_type === "客房") {
        hotelIncome[payWay] += amountCents;
      } else if (stay_type === "休息房") {
        restIncome[payWay] += amountCents;
      }
    }
  }

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

  // 现金留存款 320
  retainedAmount["现金"] = amountToCents(320);
  handoverAmount["现金"] -= retainedAmount["现金"];

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

  return response;
}

async function buildCalculatedPaymentData(date) {
  const predate = businessRules.getPreviousBusinessDate(date);

  let reserve = createPaymentBuckets();
  const reserveFromPrev = await repository.findReserveByDate(predate);
  if (reserveFromPrev) {
    reserve = convertBucketsToCents(reserveFromPrev);
  }

  const rows = await repository.findBillsByBusinessDate(date);
  return aggregateBills(rows, reserve);
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
    return buildCalculatedPaymentData(date);
  }
  return mapSavedHandoverRows(rows);
}

async function getYesterdayRecord(date) {
  const yesterdayDate = businessRules.getPreviousBusinessDate(date);
  const summary = await repository.findPreviousHandoverSummary(yesterdayDate);

  return {
    date: yesterdayDate,
    hasRecord: summary.hasRecord,
    isComplete: summary.isComplete,
    paymentCount: summary.paymentCount,
    paymentTypes: summary.paymentTypes,
    handoverPerson: summary.handoverPerson,
    takeoverPerson: summary.takeoverPerson,
    handoverAmounts: summary.handoverAmounts,
    reserveDefaults: businessRules.buildReserveDefaults({
      isComplete: summary.isComplete,
      handoverAmounts: summary.handoverAmounts
    }),
    statusText: summary.isComplete
      ? "已完成"
      : summary.hasRecord
        ? "记录不完整"
        : "缺失"
  };
}

async function getOverview({ date, account }) {
  const yesterdayRecord = await getYesterdayRecord(date);
  const [rawPaymentData, specialStats] = await Promise.all([
    buildCalculatedPaymentData(date),
    repository.getOverviewSpecialStats(date)
  ]);
  const paymentData = recalculatePaymentData(rawPaymentData, {
    reserve: yesterdayRecord.reserveDefaults
  });

  return {
    businessDate: date,
    currentShift: businessRules.resolveCurrentShift(),
    currentUser: businessRules.resolveCurrentUser(account),
    yesterdayRecord,
    paymentData,
    specialStats,
    canComplete: true,
    completeBlockReasons: []
  };
}

async function getSpecialStats(date) {
  return repository.getSpecialStats(date);
}

async function getAdminMemos(date) {
  const tasks = await repository.findAdminMemoTasks(date);
  return tasks.filter((task) => task.type === "admin");
}

async function listRecords() {
  return repository.listCompletedHandoverRecords();
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
  const paymentData = recalculatePaymentData(overview.paymentData, { retainedAmount });

  const savedRecords = await repository.saveCompletedHandover({
    date,
    operatorName,
    receivePerson,
    vipCard,
    notes,
    paymentData
  });

  return {
    date,
    handoverPerson: operatorName,
    receivePerson: receivePerson.trim(),
    recordCount: savedRecords.length,
    records: savedRecords
  };
}

module.exports = {
  completeHandover,
  getAdminMemos,
  getOverview,
  getSpecialStats,
  getTableData,
  listRecords,
  resolveOperatorName
};
