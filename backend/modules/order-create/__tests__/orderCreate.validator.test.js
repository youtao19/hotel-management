const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const {
  createOrderSchema,
  normalizeOptionalSplitField,
  pricingBreakdownSchema
} = require('../orderCreate.validator');

function createAjv() {
  const ajv = new Ajv();
  addFormats(ajv);
  return ajv;
}

function createValidOrderPayload(overrides = {}) {
  return {
    orderId: 'TEST_ORDER_001',
    sourceNumber: 'MT-001',
    orderSource: '美团',
    guestName: '张三',
    roomType: 'xing_yun_ge',
    roomNumber: '403',
    checkInDate: '2025-11-30',
    checkOutDate: '2025-12-02',
    status: 'pending',
    paymentMethod: '微信',
    phone: '13812345678',
    roomPrice: {
      '2025-11-30': 268,
      '2025-12-01': '288'
    },
    deposit: 200,
    isPrepaid: false,
    prepaidAmount: 0,
    stayType: '客房',
    createTime: '2025-11-29T10:30:00+08:00',
    remarks: '需要安静房间',
    ...overrides
  };
}

describe('创建订单参数校验', () => {
  test('创建订单信息填写完整时，应当通过参数校验', () => {
    const validate = createAjv().compile(createOrderSchema);

    expect(validate(createValidOrderPayload())).toBe(true);
  });

  test('入住日期格式不是 YYYY-MM-DD 时，应当拒绝创建订单', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      checkInDate: '2025/11/30'
    }));

    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe('/checkInDate');
  });

  test('订单状态不是系统支持的状态时，应当拒绝创建订单', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      status: 'invalid-status'
    }));

    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe('/status');
  });

  test('用户填写手机号时，手机号格式不正确应当拒绝创建订单', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      phone: '12345'
    }));

    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe('/phone');
  });

  test('用户填写每日房价时，日期键不是 YYYY-MM-DD 应当拒绝创建订单', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      roomPrice: {
        '2025/11/30': 268
      }
    }));

    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe('/roomPrice');
  });
});

describe('创建订单支付拆分校验', () => {
  test('用户没填支付拆分时，不要把空值继续传下去', () => {
    expect(normalizeOptionalSplitField(undefined)).toBeUndefined();
    expect(normalizeOptionalSplitField(null)).toBeUndefined();
    expect(normalizeOptionalSplitField([])).toBeUndefined();
  });

  test('用户填了支付拆分时，不要改动用户填写的支付方式和金额', () => {
    const arrayPayload = [{ method: '微信', amount: 100 }];

    expect(normalizeOptionalSplitField(arrayPayload)).toBe(arrayPayload);
  });

  test('用户传了旧对象格式支付拆分时，应当交给 schema 拒绝', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      roomFeePaymentSplits: {
        '2025-11-30': [{ method: '现金', amount: '80.50' }]
      }
    }));

    expect(normalizeOptionalSplitField({
      '2025-11-30': [{ method: '现金', amount: '80.50' }]
    })).toEqual({
      '2025-11-30': [{ method: '现金', amount: '80.50' }]
    });
    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe('/roomFeePaymentSplits');
  });

  test('用户填写支付拆分时，支付方式和金额合法应当通过参数校验', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      roomFeePaymentSplits: [
        { method: '微信', amount: 100 },
        { method: '现金', amount: '80.50' }
      ],
      depositPaymentSplits: [
        { method: '微邮付', amount: 200 }
      ],
      depositPaymentMethod: '微邮付'
    }));

    expect(valid).toBe(true);
  });

  test('用户填写支付拆分时，金额为 0 应当拒绝创建订单', () => {
    const validate = createAjv().compile(createOrderSchema);

    const valid = validate(createValidOrderPayload({
      roomFeePaymentSplits: [
        { method: '微信', amount: 0 }
      ]
    }));

    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe('/roomFeePaymentSplits/0/amount');
  });
});

describe('创建订单定价拆分参数校验', () => {
  test('按每日房价生成定价拆分时，填写基础房价应当通过参数校验', () => {
    const validate = createAjv().compile(pricingBreakdownSchema);

    expect(validate({
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      mode: 'from-room-price',
      basePrice: 100
    })).toBe(true);
  });

  test('按每日房价生成定价拆分时，没填基础房价应当拒绝请求', () => {
    const validate = createAjv().compile(pricingBreakdownSchema);

    expect(validate({
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      mode: 'from-room-price'
    })).toBe(false);
  });

  test('按总价分摊生成定价拆分时，填写总价应当通过参数校验', () => {
    const validate = createAjv().compile(pricingBreakdownSchema);

    expect(validate({
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      mode: 'distribute-total',
      totalPrice: '300'
    })).toBe(true);
  });

  test('按总价分摊生成定价拆分时，没填总价应当拒绝请求', () => {
    const validate = createAjv().compile(pricingBreakdownSchema);

    expect(validate({
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      mode: 'distribute-total'
    })).toBe(false);
  });
});
