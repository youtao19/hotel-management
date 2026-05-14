const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv();
addFormats(ajv);

const ORDER_DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ORDER_STATES = ['pending', 'reserved', 'checked-in', 'checked-out', 'occupied', 'cancelled'];

const updateOrderStatusSchema = {
  type: 'object',
  properties: {
    newStatus: { type: 'string', enum: VALID_ORDER_STATES },
    checkInTime: { type: 'string', format: 'date-time' },
    checkOutTime: { type: 'string', format: 'date-time' }
  },
  required: ['newStatus'],
  additionalProperties: false
};

const earlyCheckoutSchema = {
  type: 'object',
  properties: {
    actualCheckoutTime: { type: 'string', minLength: 10, maxLength: 32 },
    refundAmount: {
      anyOf: [
        { type: 'number', minimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$' }
      ]
    },
    refundMethod: { type: 'string' },
    operator: { type: 'string' },
    hasStayed: { type: 'boolean' },
    remarks: { type: 'string' }
  },
  required: ['actualCheckoutTime', 'refundAmount'],
  additionalProperties: false
};

const validateUpdateOrderStatus = ajv.compile(updateOrderStatusSchema);
const validateEarlyCheckout = ajv.compile(earlyCheckoutSchema);

/**
 * 统一订单列表筛选口径。
 * 空字符串不下传，避免 SQL 层把“未筛选”和“筛选空值”当成两种条件。
 */
function normalizeOrderListFilters(query = {}) {
  const { search, status, date } = query;
  const normalizedSearch = search ? String(search).trim() : '';
  const normalizedStatus = status ? String(status).trim() : '';
  const normalizedDate = date ? String(date).trim() : '';

  if (normalizedStatus && !VALID_ORDER_STATES.includes(normalizedStatus)) {
    return {
      error: {
        message: '订单状态筛选参数不合法',
        code: 'INVALID_STATUS_FILTER'
      }
    };
  }

  if (normalizedDate && !ORDER_DATE_FILTER_REGEX.test(normalizedDate)) {
    return {
      error: {
        message: '日期筛选格式错误，请使用 YYYY-MM-DD',
        code: 'INVALID_DATE_FILTER'
      }
    };
  }

  return {
    filters: {
      search: normalizedSearch || undefined,
      status: normalizedStatus || undefined,
      date: normalizedDate || undefined
    }
  };
}

module.exports = {
  earlyCheckoutSchema,
  normalizeOrderListFilters,
  updateOrderStatusSchema,
  validateEarlyCheckout,
  validateUpdateOrderStatus
};
