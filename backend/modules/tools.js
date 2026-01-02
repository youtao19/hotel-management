"use strict";
const Decimal = require('decimal.js');

function formatDate(dateInput) {
  if (dateInput == null || dateInput === '') return null;

  if (typeof dateInput === 'string') {
    const ymd = dateInput.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    throw new Error(`无效的日期格式: ${dateInput}`);
  }

  // 兼容 pg 可能返回的 Date 对象（仅用于格式化展示，不做时区换算）
  if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  throw new Error(`无效的日期格式: ${String(dateInput)}`);
}

function isRestRoom(check_in_date, check_out_date) {
  const checkIn = formatDate(check_in_date);
  const checkOut = formatDate(check_out_date);
  if (!checkIn || !checkOut) return false;
  return checkIn === checkOut;
}

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
})

function toDecimal(value) {
  if (Decimal.isDecimal(value)) {
    return value
  }
  if (value === undefined || value === null || value === '') {
    return new Decimal(0)
  }
  try {
    return new Decimal(value)
  } catch (error) {
    return new Decimal(0)
  }
}

function toAmountNumber(value) {
  const decimalValue = Decimal.isDecimal(value) ? value : toDecimal(value)
  return Number(decimalValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
}

module.exports = {
  isRestRoom,
  formatDate,
  toDecimal,
  toAmountNumber
};
