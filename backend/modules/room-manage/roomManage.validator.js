const Ajv = require('ajv');

const ajv = new Ajv();

const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const roomSchema = {
  type: 'object',
  properties: {
    room_number: { type: 'string' },
    type_code: { type: 'string' },
    status: { type: 'string', enum: VALID_ROOM_STATES },
    price: { type: 'number' }
  },
  required: ['room_number', 'type_code', 'status', 'price'],
  additionalProperties: false
};

const roomTypeSchema = {
  type: 'object',
  properties: {
    type_code: { type: 'string' },
    type_name: { type: 'string' },
    base_price: { type: 'number' },
    description: { type: 'string' }
  },
  required: ['type_code', 'type_name', 'base_price'],
  additionalProperties: false
};

const validateRoom = ajv.compile(roomSchema);
const validateRoomType = ajv.compile(roomTypeSchema);

function isDateString(value) {
  return DATE_REGEX.test(value);
}

function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return { message: '必须提供入住日期和退房日期' };
  }
  if (!isDateString(startDate) || !isDateString(endDate)) {
    return { message: '日期格式必须为 YYYY-MM-DD' };
  }
  if (startDate > endDate) {
    return { message: '退房日期不能早于入住日期' };
  }
  return null;
}

module.exports = {
  VALID_ROOM_STATES,
  isDateString,
  roomTypeSchema,
  roomSchema,
  validateDateRange,
  validateRoom,
  validateRoomType
};
