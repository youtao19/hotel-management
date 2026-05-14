const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv();
addFormats(ajv);

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

const validateRoom = ajv.compile(roomSchema);

function normalizeOptionalText(value) {
  return value ? String(value).trim() : '';
}

function isDateString(value) {
  return DATE_REGEX.test(value);
}

function normalizeRoomListQuery(query = {}) {
  const normalizedDate = normalizeOptionalText(query.date);
  const normalizedTypeCode = normalizeOptionalText(query.typeCode);
  const normalizedStatus = normalizeOptionalText(query.status);
  const normalizedKeyword = normalizeOptionalText(query.keyword);

  if (normalizedDate && !isDateString(normalizedDate)) {
    return { error: { message: '日期格式必须为 YYYY-MM-DD' } };
  }

  if (normalizedStatus && !VALID_ROOM_STATES.includes(normalizedStatus)) {
    return { error: { message: '无效的房态筛选值' } };
  }

  return {
    filters: {
      date: normalizedDate || null,
      typeCode: normalizedTypeCode || null,
      status: normalizedStatus || null,
      keyword: normalizedKeyword || null
    }
  };
}

function normalizeCalendarBoardQuery(query = {}) {
  const normalizedStartDate = normalizeOptionalText(query.startDate);
  const normalizedTypeCode = normalizeOptionalText(query.typeCode);
  const normalizedStatus = normalizeOptionalText(query.status);
  const normalizedKeyword = normalizeOptionalText(query.keyword);
  const normalizedDays = Number(query.days || 14);

  if (!normalizedStartDate) {
    return { error: { message: '必须提供 startDate' } };
  }
  if (!isDateString(normalizedStartDate)) {
    return { error: { message: 'startDate 格式必须为 YYYY-MM-DD' } };
  }
  if (normalizedDays !== 14) {
    return { error: { message: 'days 当前仅支持 14' } };
  }
  if (normalizedStatus && !VALID_ROOM_STATES.includes(normalizedStatus)) {
    return { error: { message: '无效的房态筛选值' } };
  }

  return {
    filters: {
      startDate: normalizedStartDate,
      days: normalizedDays,
      typeCode: normalizedTypeCode || null,
      status: normalizedStatus || null,
      keyword: normalizedKeyword || null
    }
  };
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

function validateRoomStatusBody(body = {}) {
  if (!body || Object.keys(body).length === 0) {
    return { message: '请求体为空' };
  }
  if (body.status === undefined) {
    return { message: '状态值未提供' };
  }
  if (!VALID_ROOM_STATES.includes(body.status)) {
    return {
      message: '无效的房间状态',
      requestedStatus: body.status,
      validStatuses: VALID_ROOM_STATES
    };
  }
  return null;
}

module.exports = {
  VALID_ROOM_STATES,
  isDateString,
  normalizeCalendarBoardQuery,
  normalizeRoomListQuery,
  roomSchema,
  validateDateRange,
  validateRoom,
  validateRoomStatusBody
};
