const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const otaModule = require('../modules/otaModule');
const { createOtaAuthMiddleware } = require('../modules/otaAuthModule');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const otaAuthMiddleware = createOtaAuthMiddleware();

// OTA 建单金额既支持总价，也支持按日价透传。
const amountSchema = {
  anyOf: [
    { type: 'number', exclusiveMinimum: 0 },
    { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
  ]
};

const createOrderSchema = {
  type: 'object',
  properties: {
    externalOrderId: { type: 'string', minLength: 1 },
    external_order_id: { type: 'string', minLength: 1 },
    guestName: { type: 'string', minLength: 1 },
    guest_name: { type: 'string', minLength: 1 },
    phone: { type: 'string' },
    roomType: { type: 'string', minLength: 1 },
    room_type: { type: 'string', minLength: 1 },
    checkInDate: { type: 'string', format: 'date' },
    check_in_date: { type: 'string', format: 'date' },
    checkOutDate: { type: 'string', format: 'date' },
    check_out_date: { type: 'string', format: 'date' },
    totalPrice: amountSchema,
    total_price: amountSchema,
    dailyPrices: {
      type: 'object',
      minProperties: 1,
      propertyNames: { type: 'string', format: 'date' },
      additionalProperties: amountSchema
    },
    daily_prices: {
      type: 'object',
      minProperties: 1,
      propertyNames: { type: 'string', format: 'date' },
      additionalProperties: amountSchema
    },
    paymentMethod: { type: 'string' },
    payment_method: { type: 'string' },
    remarks: { type: 'string' }
  },
  anyOf: [
    { required: ['externalOrderId', 'guestName', 'roomType', 'checkInDate', 'checkOutDate'] },
    { required: ['external_order_id', 'guest_name', 'room_type', 'check_in_date', 'check_out_date'] }
  ],
  allOf: [
    {
      anyOf: [
        { required: ['totalPrice'] },
        { required: ['total_price'] },
        { required: ['dailyPrices'] },
        { required: ['daily_prices'] }
      ]
    }
  ],
  additionalProperties: true
};

const updateInventorySchema = {
  type: 'object',
  properties: {
    updatedBy: { type: 'string' },
    updated_by: { type: 'string' },
    entries: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          roomType: { type: 'string', minLength: 1 },
          room_type: { type: 'string', minLength: 1 },
          stayDate: { type: 'string', format: 'date' },
          stay_date: { type: 'string', format: 'date' },
          quota: {
            anyOf: [
              { type: 'integer', minimum: 0 },
              { type: 'null' }
            ]
          }
        },
        anyOf: [
          { required: ['roomType', 'stayDate'] },
          { required: ['room_type', 'stay_date'] }
        ],
        required: ['quota'],
        additionalProperties: true
      }
    }
  },
  required: ['entries'],
  additionalProperties: true
};

function handleBusinessError(res, error, defaultMessage) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? defaultMessage : error.message,
    error: {
      code: error.code || 'OTA_UNKNOWN_ERROR',
      details: error.details || null
    }
  });
}

router.post('/orders', otaAuthMiddleware, async (req, res) => {
  const validate = ajv.compile(createOrderSchema);
  const valid = validate(req.body);
  if (!valid) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validate.errors
    });
  }

  try {
    const result = await otaModule.createOtaOrder(req.ota.channelCode, req.body);
    return res.status(result.existing ? 200 : 201).json({
      success: true,
      existing: result.existing,
      data: result.data
    });
  } catch (error) {
    return handleBusinessError(res, error, 'OTA 订单创建失败');
  }
});

router.get('/inventory', otaAuthMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, roomType, room_type } = req.query || {};
    const rows = await otaModule.getInventoryRows(
      req.ota.channelCode,
      startDate,
      endDate,
      roomType || room_type || null
    );
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return handleBusinessError(res, error, 'OTA 库存查询失败');
  }
});

router.put('/inventory', otaAuthMiddleware, async (req, res) => {
  const validate = ajv.compile(updateInventorySchema);
  const valid = validate(req.body);
  if (!valid) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validate.errors
    });
  }

  try {
    const rows = await otaModule.setInventoryQuota(
      req.ota.channelCode,
      req.body.entries,
      req.body.updatedBy || req.body.updated_by || `ota:${req.ota.channelCode}`
    );
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return handleBusinessError(res, error, 'OTA 库存写入失败');
  }
});

module.exports = router;
