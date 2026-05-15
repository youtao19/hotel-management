const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv();
addFormats(ajv);

const PAY_WAY = ['现金', '微信', '微邮付', '平台'];
const CHANGE_TYPE = ['房费', '收押', '退押', '补收', '退款'];

const addBillSchema = {
  type: 'object',
  properties: {
    order_id: { type: 'string' },
    change_price: { type: 'number' },
    change_type: { type: 'string', enum: CHANGE_TYPE },
    method: { type: 'string', enum: PAY_WAY },
    notes: { type: 'string' },
    refundTime: { type: 'string', format: 'date-time' }
  },
  required: ['order_id', 'change_price', 'change_type', 'method'],
  additionalProperties: false
};

const otherIncomeSchema = {
  type: 'object',
  properties: {
    income_type: { type: 'string', minLength: 1 },
    amount: { type: 'number' },
    pay_way: { type: 'string', enum: PAY_WAY },
    income_date: { type: 'string', format: 'date-time' },
    remarks: { type: 'string' },
    guest_name: { type: 'string' }
  },
  required: ['income_type', 'amount', 'pay_way', 'income_date'],
  additionalProperties: false
};

const validateAddBill = ajv.compile(addBillSchema);
const validateOtherIncome = ajv.compile(otherIncomeSchema);

function validateRequest(validate, body) {
  const valid = validate(body);
  if (valid) return null;
  return validate.errors;
}

module.exports = {
  validateAddBill,
  validateOtherIncome,
  validateRequest
};
