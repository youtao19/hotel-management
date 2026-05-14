const VALID_ORDER_STATES = ['pending', 'reserved', 'checked-in', 'checked-out', 'occupied', 'cancelled'];
const SPLIT_PAY_WAYS = ['现金', '微信', '微邮付', '平台'];

const splitItemSchema = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: SPLIT_PAY_WAYS },
    amount: {
      anyOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
      ]
    }
  },
  required: ['method', 'amount'],
  additionalProperties: false
};

function normalizeOptionalSplitField(rawValue) {
  if (rawValue === undefined || rawValue === null) return undefined;
  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? rawValue : undefined;
  }
  return rawValue;
}

const createOrderSchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    sourceNumber: { type: 'string' },
    orderSource: { type: 'string' },
    guestName: { type: 'string' },
    roomType: { type: 'string' },
    roomNumber: { type: 'string' },
    checkInDate: { type: 'string', format: 'date' },
    checkOutDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: VALID_ORDER_STATES },
    paymentMethod: { type: 'string' },
    phone: {
      type: 'string',
      pattern: '^$|^1[3-9]\\d{9}$'
    },
    roomPrice: {
      type: 'object',
      minProperties: 1,
      propertyNames: { type: 'string', format: 'date' },
      additionalProperties: {
        anyOf: [
          { type: 'number', exclusiveMinimum: 0 },
          { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d+)?$', not: { const: '0' } }
        ]
      }
    },
    deposit: { type: 'number' },
    isPrepaid: { type: 'boolean' },
    prepaidAmount: { type: 'number', minimum: 0 },
    roomFeePaymentSplits: {
      type: 'array',
      minItems: 1,
      items: splitItemSchema
    },
    depositPaymentSplits: {
      type: 'array',
      minItems: 1,
      items: splitItemSchema
    },
    depositPaymentMethod: { type: 'string', enum: SPLIT_PAY_WAYS },
    stayType: { type: 'string', enum: ['客房', '休息房'] },
    createTime: { type: 'string', format: 'date-time' },
    remarks: { type: 'string' }
  },
  required: ['orderId', 'orderSource', 'guestName', 'roomType', 'roomNumber', 'checkInDate', 'checkOutDate', 'status', 'paymentMethod', 'roomPrice', 'stayType'],
  additionalProperties: true
};

const pricingBreakdownSchema = {
  type: 'object',
  properties: {
    checkInDate: { type: 'string', format: 'date' },
    checkOutDate: { type: 'string', format: 'date' },
    mode: { type: 'string', enum: ['from-room-price', 'distribute-total'] },
    basePrice: {
      anyOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
      ]
    },
    totalPrice: {
      anyOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
      ]
    }
  },
  required: ['checkInDate', 'checkOutDate', 'mode'],
  allOf: [
    {
      if: { properties: { mode: { const: 'from-room-price' } } },
      then: { required: ['basePrice'] }
    },
    {
      if: { properties: { mode: { const: 'distribute-total' } } },
      then: { required: ['totalPrice'] }
    }
  ],
  additionalProperties: false
};

module.exports = {
  createOrderSchema,
  normalizeOptionalSplitField,
  pricingBreakdownSchema
};
