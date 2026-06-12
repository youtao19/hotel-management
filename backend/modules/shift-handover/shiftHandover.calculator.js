"use strict";

const PAYMENT_METHODS = ["现金", "微信", "微邮付", "其他"];

function createPaymentBuckets() {
  return PAYMENT_METHODS.reduce((result, method) => {
    result[method] = 0;
    return result;
  }, {});
}

function amountToCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToAmount(cents) {
  return Number((cents / 100).toFixed(2));
}

function convertBucketsToAmounts(bucket) {
  const result = {};
  for (const key of PAYMENT_METHODS) {
    result[key] = centsToAmount(bucket[key] || 0);
  }
  return result;
}

function convertBucketsToCents(bucket) {
  const result = createPaymentBuckets();
  if (!bucket) {
    return result;
  }
  for (const key of PAYMENT_METHODS) {
    result[key] = amountToCents(bucket[key] || 0);
  }
  return result;
}

function normalizeAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function normalizePaymentBucket(bucket = {}) {
  return PAYMENT_METHODS.reduce((acc, key) => {
    acc[key] = normalizeAmount(bucket[key]);
    return acc;
  }, {});
}

function recalculatePaymentData(paymentData = {}, overrides = {}) {
  const reserve = normalizePaymentBucket(overrides.reserve || paymentData.reserve);
  const hotelIncome = normalizePaymentBucket(paymentData.hotelIncome);
  const restIncome = normalizePaymentBucket(paymentData.restIncome);
  const carRentIncome = normalizePaymentBucket(paymentData.carRentIncome);
  const hotelRefundDeposit = normalizePaymentBucket(paymentData.hotelRefundDeposit || paymentData.hotelDeposit);
  const restRefundDeposit = normalizePaymentBucket(paymentData.restRefundDeposit || paymentData.restDeposit);
  const retainedAmount = normalizePaymentBucket(overrides.retainedAmount || paymentData.retainedAmount);

  const totalIncome = createPaymentBuckets();
  const totalRefundDeposit = createPaymentBuckets();
  const handoverAmount = createPaymentBuckets();

  PAYMENT_METHODS.forEach((key) => {
    totalIncome[key] = normalizeAmount(
      reserve[key] + hotelIncome[key] + restIncome[key] + carRentIncome[key]
    );
    totalRefundDeposit[key] = normalizeAmount(hotelRefundDeposit[key] + restRefundDeposit[key]);
    handoverAmount[key] = normalizeAmount(totalIncome[key] - totalRefundDeposit[key] - retainedAmount[key]);
  });

  return {
    reserve,
    hotelIncome,
    restIncome,
    carRentIncome,
    totalIncome,
    hotelDeposit: hotelRefundDeposit,
    restDeposit: restRefundDeposit,
    hotelRefundDeposit,
    restRefundDeposit,
    totalRefundDeposit,
    retainedAmount,
    handoverAmount
  };
}

module.exports = {
  PAYMENT_METHODS,
  amountToCents,
  centsToAmount,
  convertBucketsToAmounts,
  convertBucketsToCents,
  createPaymentBuckets,
  normalizeAmount,
  normalizePaymentBucket,
  recalculatePaymentData
};
