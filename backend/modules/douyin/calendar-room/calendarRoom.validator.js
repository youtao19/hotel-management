"use strict";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 判断日期是否为真实自然日。 */
function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = month === 2
    ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day <= daysInMonth;
}

/** 校验日历房规则。 */
function validateRule(payload = {}) {
  const required = ['validityStart', 'validityEnd', 'cancelRule', 'breakfastNumber', 'refundType', 'status'];
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      return `${field} 不能为空`;
    }
  }
  if (!isValidDate(payload.validityStart) || !isValidDate(payload.validityEnd)) return '有效期必须为真实的 YYYY-MM-DD 日期';
  if (payload.validityStart > payload.validityEnd) return '有效期结束日期不能早于开始日期';
  if (![1, 2, 3].includes(Number(payload.cancelRule))) return '取消规则必须为 1、2 或 3';
  if (!Number.isInteger(Number(payload.breakfastNumber)) || Number(payload.breakfastNumber) < 0 || Number(payload.breakfastNumber) > 99) return '早餐数量必须为 0 到 99 的整数';
  if (![1, 2].includes(Number(payload.refundType))) return '退款规则必须为 1 或 2';
  if (![0, 1].includes(Number(payload.status))) return '日历房状态必须为 0 或 1';
  return null;
}

/** 整理日历房规则字段。 */
function normalizeRule(payload = {}) {
  return {
    validityStart: typeof payload.validityStart === 'string' ? payload.validityStart.trim() : payload.validityStart,
    validityEnd: typeof payload.validityEnd === 'string' ? payload.validityEnd.trim() : payload.validityEnd,
    cancelRule: Number(payload.cancelRule),
    breakfastNumber: Number(payload.breakfastNumber),
    refundType: Number(payload.refundType),
    status: Number(payload.status)
  };
}

module.exports = { isValidDate, validateRule, normalizeRule };
