"use strict";

const { isValidDate } = require('./calendarRoom.validator');

const MAX_DATE_RANGE_DAYS = 30;
const MAX_BATCH_DAYS = 7;
const MAX_ARIS_PER_REQUEST = 50;

/** 将日期转换为连续天数。 */
function toDayNumber(value) {
  const [year, month, day] = value.split('-').map(Number);
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  return era * 146097 + yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear - 719468;
}

/** 将连续天数还原为日期字符串。 */
function fromDayNumber(days) {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const yearDay = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * yearDay + 2) / 153);
  const day = yearDay - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  const year = era * 400 + yearOfEra + (month <= 2 ? 1 : 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 生成日期范围中的每个自然日。 */
function buildDateList(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return null;
  const start = toDayNumber(startDate);
  const end = toDayNumber(endDate);
  if (end < start || end - start + 1 > MAX_DATE_RANGE_DAYS) return null;
  return Array.from({ length: end - start + 1 }, (_, index) => fromDayNumber(start + index));
}

/** 校验按日价格保存请求。 */
function validatePrices(payload = {}) {
  if (!Array.isArray(payload.prices) || !payload.prices.length) return 'prices 必须是非空数组';
  const dates = new Set();
  for (const price of payload.prices) {
    if (!isValidDate(price?.stayDate)) return '房晚日期必须为真实的 YYYY-MM-DD 日期';
    if (dates.has(price.stayDate)) return '同一日期不能重复保存价格';
    dates.add(price.stayDate);
    const originalAmount = Number(price.originalAmount);
    const retailAmount = price.retailAmount;
    if (!Number.isFinite(originalAmount) || originalAmount < 0) return '实际售价必须大于等于 0';
    if (retailAmount !== undefined && retailAmount !== null && retailAmount !== '') {
      if (!Number.isFinite(Number(retailAmount)) || Number(retailAmount) < originalAmount) return '划线价必须大于等于实际售价';
    }
  }
  return null;
}

/** 整理按日价格保存请求。 */
function normalizePrices(payload = {}) {
  return payload.prices.map((price) => ({
    stayDate: String(price.stayDate || '').trim(),
    originalAmount: Number(price.originalAmount),
    retailAmount: price.retailAmount === undefined || price.retailAmount === null || price.retailAmount === '' ? null : Number(price.retailAmount)
  })).sort((left, right) => left.stayDate.localeCompare(right.stayDate));
}

module.exports = { MAX_ARIS_PER_REQUEST, MAX_BATCH_DAYS, buildDateList, validatePrices, normalizePrices };
