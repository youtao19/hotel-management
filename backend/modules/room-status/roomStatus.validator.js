const Ajv = require('ajv');

const ajv = new Ajv();

const ROOM_STATUS_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

const updateRoomStatusSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: VALID_ROOM_STATES }
  },
  required: ['status'],
  additionalProperties: true
};

const validateUpdateRoomStatus = ajv.compile(updateRoomStatusSchema);

function normalizeRoomStatusQuery(query = {}) {
  const normalizedDate = query.date ? String(query.date).trim() : '';
  const normalizedTypeCode = query.typeCode ? String(query.typeCode).trim() : '';
  const normalizedStatus = query.status ? String(query.status).trim() : '';
  const normalizedKeyword = query.keyword ? String(query.keyword).trim() : '';

  if (normalizedDate && !ROOM_STATUS_DATE_REGEX.test(normalizedDate)) {
    return { error: { message: '日期格式必须为 YYYY-MM-DD', code: 'INVALID_DATE' } };
  }

  if (normalizedStatus && !VALID_ROOM_STATES.includes(normalizedStatus)) {
    return { error: { message: '无效的房态筛选值', code: 'INVALID_STATUS_FILTER' } };
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

function normalizeStatusRangeQuery(query = {}) {
  const roomNumber = query.roomNumber ? String(query.roomNumber) : '';
  const startDate = query.startDate ? String(query.startDate).trim() : '';
  const endDate = query.endDate ? String(query.endDate).trim() : '';

  if (!roomNumber || !startDate || !endDate) {
    return { error: { message: '必须提供 roomNumber, startDate, endDate', code: 'MISSING_RANGE_PARAMS' } };
  }

  if (!ROOM_STATUS_DATE_REGEX.test(startDate) || !ROOM_STATUS_DATE_REGEX.test(endDate)) {
    return { error: { message: '日期格式必须为 YYYY-MM-DD', code: 'INVALID_DATE' } };
  }

  if (startDate > endDate) {
    return { error: { message: 'endDate 不能早于 startDate', code: 'INVALID_DATE_RANGE' } };
  }

  return {
    filters: {
      roomNumber,
      startDate,
      endDate
    }
  };
}

function normalizeCalendarBoardQuery(query = {}) {
  const normalizedStartDate = query.startDate ? String(query.startDate).trim() : '';
  const normalizedTypeCode = query.typeCode ? String(query.typeCode).trim() : '';
  const normalizedStatus = query.status ? String(query.status).trim() : '';
  const normalizedKeyword = query.keyword ? String(query.keyword).trim() : '';
  const normalizedDays = Number(query.days || 14);

  if (!normalizedStartDate) {
    return { error: { message: '必须提供 startDate', code: 'MISSING_START_DATE' } };
  }

  if (!ROOM_STATUS_DATE_REGEX.test(normalizedStartDate)) {
    return { error: { message: 'startDate 格式必须为 YYYY-MM-DD', code: 'INVALID_START_DATE' } };
  }

  if (normalizedDays !== 14) {
    return { error: { message: 'days 当前仅支持 14', code: 'UNSUPPORTED_DAYS' } };
  }

  if (normalizedStatus && !VALID_ROOM_STATES.includes(normalizedStatus)) {
    return { error: { message: '无效的房态筛选值', code: 'INVALID_STATUS_FILTER' } };
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

module.exports = {
  ROOM_STATUS_DATE_REGEX,
  VALID_ROOM_STATES,
  normalizeCalendarBoardQuery,
  normalizeRoomStatusQuery,
  normalizeStatusRangeQuery,
  updateRoomStatusSchema,
  validateUpdateRoomStatus
};
