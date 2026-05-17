"use strict";

const availabilityRepository = require('./availability.repository');

const ACTIVE_ORDER_STATUSES = ['pending', 'reserved', 'checked-in', 'occupied'];
const MAX_STAY_NIGHTS = 366;

function createBusinessError(message, errorCode = 13, row = null, dates = [], inventoryMap = new Map()) {
  const error = new Error(message);
  // 失败时仍要带回当前价量态，方便抖音侧同步修正库存或价格，不能只返回错误码。
  error.douyinErrorCode = errorCode;
  error.row = row;
  error.dates = dates;
  error.inventoryMap = inventoryMap;
  return error;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }
  return number;
}

function parseDatePart(value) {
  const text = normalizeString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcTime = Date.UTC(year, month - 1, day);
  const date = new Date(utcTime);

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    text,
    utcTime
  };
}

function formatDateFromUtcTime(utcTime) {
  const date = new Date(utcTime);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildStayDates(checkInDate, checkOutDate) {
  const start = parseDatePart(checkInDate);
  const end = parseDatePart(checkOutDate);

  if (!start || !end || end.utcTime <= start.utcTime) {
    throw createBusinessError('日期范围格式错误', 5);
  }

  const dates = [];
  const oneDay = 24 * 60 * 60 * 1000;
  // 可订检查按房晚扣库存，离店日不是住宿房晚，不能用闭区间生成日期。
  for (let current = start.utcTime; current < end.utcTime; current += oneDay) {
    dates.push({
      start: formatDateFromUtcTime(current),
      end: formatDateFromUtcTime(current + oneDay)
    });
    if (dates.length > MAX_STAY_NIGHTS) {
      throw createBusinessError('日期范围不能超过 366 晚', 13);
    }
  }

  return dates;
}

function amountYuanToCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
}

function normalizeRequest(payload = {}) {
  const ratePlanId = normalizeString(payload.rate_plan_id || payload.ratePlanId);
  const bizType = normalizeString(payload.biz_type || payload.bizType);
  const checkInDate = normalizeString(payload.check_in_date || payload.checkInDate);
  const checkOutDate = normalizeString(payload.check_out_date || payload.checkOutDate);
  const numberOfUnits = normalizePositiveInteger(payload.number_of_units || payload.numberOfUnits, 1);
  const totalAmount = Number(payload.total_amount ?? payload.totalAmount);

  if (!ratePlanId) {
    throw createBusinessError('缺少售卖计划ID', 13);
  }

  if (bizType && bizType !== '2011') {
    // 当前只验收预售券提单页可订检查，其他住宿交易类型先明确拒绝，避免误放行。
    throw createBusinessError('当前仅支持预售券可订检查 biz_type=2011', 13);
  }

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw createBusinessError('发单价格格式错误', 13);
  }

  return {
    ratePlanId,
    bizType: bizType || '2011',
    checkInDate,
    checkOutDate,
    numberOfUnits,
    totalAmount: Math.round(totalAmount),
    dates: buildStayDates(checkInDate, checkOutDate)
  };
}

async function findRatePlan(ratePlanId) {
  return availabilityRepository.findRatePlanByDouyinId(ratePlanId);
}

async function getInventoryMap(roomTypeCode, dates) {
  if (!roomTypeCode || !dates.length) {
    return new Map();
  }

  // 只有仍占用房量的订单参与扣减，取消和退房不影响预售券可订库存。
  const rows = await availabilityRepository.getInventoryRowsByRoomType(
    roomTypeCode,
    dates.map((date) => date.start),
    ACTIVE_ORDER_STATUSES
  );

  const inventoryMap = new Map();
  for (const row of rows) {
    const totalRooms = Number(row.total_rooms || 0);
    const occupiedRooms = Number(row.occupied_rooms || 0);
    inventoryMap.set(row.stay_date, Math.max(totalRooms - occupiedRooms, 0));
  }

  return inventoryMap;
}

function buildStockAndAmount(row, dates, inventoryMap) {
  if (!row) {
    return [];
  }

  const amount = amountYuanToCents(row.base_price);
  // 可订失败时返回的是抖音物理房型和售卖计划，不暴露本地 rooms.room_id。
  const isActive = Number(row.rate_plan_status) === 1
    && !row.room_type_closed
    && row.douyin_room_id
    && row.cached_douyin_room_id
    && Number(row.douyin_room_status) === 1;

  return dates.map((date) => {
    const inventory = inventoryMap.get(date.start) || 0;
    return {
      room_id: row.douyin_room_id,
      rate_plan_id: row.rate_plan_id,
      timerange: {
        start: date.start,
        end: date.end
      },
      original_amount: amount,
      currency: row.currency || 'CNY',
      available: isActive && inventory > 0,
      inventory
    };
  });
}

function buildFailureResponse(error) {
  const stockAndAmount = buildStockAndAmount(error.row, error.dates || [], error.inventoryMap || new Map());

  const response = {
    error_code: Number(error.douyinErrorCode || 13),
    description: error.message || '可订检查失败'
  };

  if (stockAndAmount.length) {
    response.ari = {
      stock_and_amount: stockAndAmount
    };
  }

  return response;
}

async function buildBookableCheckResponse(payload = {}) {
  try {
    const request = normalizeRequest(payload);
    const row = await findRatePlan(request.ratePlanId);
    // 只有“本地套餐 + 房型映射 + 抖音物理房型缓存”三者都存在且可售，才允许预售券继续下单。
    if (
      !row
      || !row.douyin_room_id
      || !row.cached_douyin_room_id
      || row.room_type_closed
      || Number(row.rate_plan_status) !== 1
      || Number(row.douyin_room_status) !== 1
    ) {
      throw createBusinessError('房型不存在或已失效', 1, row, request.dates);
    }

    const inventoryMap = await getInventoryMap(row.room_type_code, request.dates);
    const stockAndAmount = buildStockAndAmount(row, request.dates, inventoryMap);
    const hasEnoughInventory = stockAndAmount.every((item) => item.inventory >= request.numberOfUnits && item.available);

    if (!hasEnoughInventory) {
      throw createBusinessError('入住时期内已满', 4, row, request.dates, inventoryMap);
    }

    // 抖音传的是整单金额（分），这里按房晚数和间数校验，避免多晚/多间订单只比单价。
    const expectedTotalAmount = amountYuanToCents(row.base_price) * request.dates.length * request.numberOfUnits;
    if (expectedTotalAmount !== request.totalAmount) {
      throw createBusinessError('价格与酒店实际价格不一致', 8, row, request.dates, inventoryMap);
    }

    return {
      error_code: 0,
      description: 'success'
    };
  } catch (error) {
    return buildFailureResponse(error);
  }
}

module.exports = {
  ACTIVE_ORDER_STATUSES,
  buildStayDates,
  normalizeRequest,
  buildBookableCheckResponse
};
