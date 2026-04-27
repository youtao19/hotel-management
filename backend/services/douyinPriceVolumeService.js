"use strict";

const db = require('../database/postgreDB/pg');

const ACTIVE_ORDER_STATUSES = ['pending', 'reserved', 'checked-in', 'occupied'];
const MAX_DATE_RANGE_DAYS = 366;
const UNKNOWN_RATE_PLAN_ERROR_CODE = 60021;

function createBusinessError(message, errorCode = 13) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  return error;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean);
  }

  const normalized = normalizeString(value);
  return normalized ? [normalized] : [];
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

function buildDateList(startText, endText) {
  const start = parseDatePart(startText);
  const end = parseDatePart(endText);

  if (!start || !end || end.utcTime < start.utcTime) {
    throw createBusinessError('日期范围格式错误', 5);
  }

  const dates = [];
  // 这里只生成 YYYY-MM-DD 字符串列表，后续 SQL 按 date 处理，避免把房晚日期当成时刻展示。
  const oneDay = 24 * 60 * 60 * 1000;
  for (let current = start.utcTime; current <= end.utcTime; current += oneDay) {
    dates.push(formatDateFromUtcTime(current));
    if (dates.length > MAX_DATE_RANGE_DAYS) {
      throw createBusinessError('日期范围不能超过 366 天', 13);
    }
  }

  return dates;
}

function normalizeRequest(payload = {}) {
  const dateRange = payload.date_range || {};
  // 抖音回调字段在文档和实际请求中存在多种命名，入口统一兼容后再进入业务查询。
  const startDate = normalizeString(
    dateRange.start
      || payload.start_date
      || payload.startDate
      || payload.check_in_date
      || payload.checkInDate
  );
  const endDate = normalizeString(
    dateRange.end
      || payload.end_date
      || payload.endDate
      || payload.check_out_date
      || payload.checkOutDate
  );

  return {
    ratePlanIds: normalizeStringArray(payload.rate_plan_ids || payload.rate_plan_id || payload.ratePlanIds),
    hotelIds: normalizeStringArray(payload.hotel_ids || payload.hotel_id || payload.hotelIds),
    dates: buildDateList(startDate, endDate)
  };
}

function amountYuanToCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
}

function getHotelIdSql() {
  return `
    COALESCE(
      -- 历史缓存中的酒店字段来源不完全一致，按常见抖音字段优先级取第一个可用值。
      dpr.raw_payload ->> 'hotel_id',
      dpr.raw_payload ->> 'poi_id',
      dpr.raw_payload ->> 'hotelId',
      dpr.raw_payload ->> 'poiId',
      dpr.raw_payload -> 'hotel' ->> 'hotel_id',
      ocm.channel_config ->> 'hotel_id',
      ocm.channel_config ->> 'poi_id'
    )
  `;
}

async function findRatePlansByIds(ratePlanIds) {
  if (!ratePlanIds.length) {
    return [];
  }

  const result = await db.query(
    `
      SELECT
        ocm.channel_item_id AS rate_plan_id,
        rp.id AS local_rate_plan_id,
        rp.room_type_code,
        rp.base_price,
        rp.currency,
        rp.status AS rate_plan_status,
        rt.is_closed AS room_type_closed,
        drm.douyin_room_id,
        ${getHotelIdSql()} AS hotel_id
      FROM ota_channel_mappings ocm
      JOIN rate_plans rp
        ON rp.id = ocm.local_target_id
       AND ocm.local_target_type = 'RATE_PLAN'
      LEFT JOIN room_types rt
        ON rt.type_code = rp.room_type_code
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.local_room_type = rp.room_type_code
      LEFT JOIN douyin_physical_rooms dpr
        ON dpr.room_id = drm.douyin_room_id
      WHERE ocm.channel_code = 'DOUYIN'
        AND ocm.channel_item_id = ANY($1)
    `,
    [ratePlanIds]
  );

  return result.rows;
}

async function findRatePlansByHotels(hotelIds) {
  if (!hotelIds.length) {
    return [];
  }

  const result = await db.query(
    `
      SELECT
        ocm.channel_item_id AS rate_plan_id,
        rp.id AS local_rate_plan_id,
        rp.room_type_code,
        rp.base_price,
        rp.currency,
        rp.status AS rate_plan_status,
        rt.is_closed AS room_type_closed,
        drm.douyin_room_id,
        ${getHotelIdSql()} AS hotel_id
      FROM ota_channel_mappings ocm
      JOIN rate_plans rp
        ON rp.id = ocm.local_target_id
       AND ocm.local_target_type = 'RATE_PLAN'
      LEFT JOIN room_types rt
        ON rt.type_code = rp.room_type_code
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.local_room_type = rp.room_type_code
      LEFT JOIN douyin_physical_rooms dpr
        ON dpr.room_id = drm.douyin_room_id
      WHERE ocm.channel_code = 'DOUYIN'
        AND ${getHotelIdSql()} = ANY($1)
      ORDER BY ocm.channel_item_id
    `,
    [hotelIds]
  );

  return result.rows;
}

async function getInventoryMap(roomTypeCodes, dates) {
  const typeCodes = [...new Set(roomTypeCodes.filter(Boolean))];
  if (!typeCodes.length || !dates.length) {
    return new Map();
  }

  const result = await db.query(
    `
      WITH target_dates AS (
        SELECT unnest($1::date[]) AS stay_date
      ),
      target_types AS (
        SELECT unnest($2::varchar[]) AS room_type_code
      )
      SELECT
        to_char(td.stay_date, 'YYYY-MM-DD') AS stay_date,
        tt.room_type_code,
        COUNT(DISTINCT r.room_number) AS total_rooms,
        COUNT(DISTINCT o.room_number) AS occupied_rooms
      FROM target_dates td
      CROSS JOIN target_types tt
      LEFT JOIN rooms r
        ON r.type_code = tt.room_type_code
       AND r.is_closed = FALSE
       AND r.status != 'repair'
      LEFT JOIN orders o
        ON o.room_number = r.room_number
       AND o.stay_date = td.stay_date
       -- 只有会占用房量的订单状态参与扣减，取消、退房等状态不影响可售库存。
       AND o.status = ANY($3)
      GROUP BY td.stay_date, tt.room_type_code
    `,
    [dates, typeCodes, ACTIVE_ORDER_STATUSES]
  );

  const inventoryMap = new Map();
  for (const row of result.rows) {
    const totalRooms = Number(row.total_rooms || 0);
    const occupiedRooms = Number(row.occupied_rooms || 0);
    inventoryMap.set(`${row.room_type_code}:${row.stay_date}`, Math.max(totalRooms - occupiedRooms, 0));
  }

  return inventoryMap;
}

function buildUnknownRatePlan(ratePlanId) {
  // 抖音要求未知售卖计划逐条返回子错误，不能因为一个无效 ID 让整批价量查询失败。
  return {
    rate_plan_id: ratePlanId,
    rate_avail_infos: [],
    status: false,
    sub_error: '售卖计划ID错误',
    sub_error_code: UNKNOWN_RATE_PLAN_ERROR_CODE
  };
}

function buildRatePlanResponse(row, dates, inventoryMap) {
  const amount = amountYuanToCents(row.base_price);
  // 售卖套餐和房型任一侧关闭都不能继续对外售卖，但仍返回价格和库存便于抖音侧同步状态。
  const isRatePlanActive = Number(row.rate_plan_status) === 1 && !row.room_type_closed;

  return {
    rate_plan_id: row.rate_plan_id,
    rate_avail_infos: dates.map((date) => {
      const inventory = inventoryMap.get(`${row.room_type_code}:${date}`) || 0;
      return {
        timerange: {
          start: date,
          end: date
        },
        original_amount: amount,
        retail_amount: amount,
        currency: row.currency || 'CNY',
        available: isRatePlanActive && inventory > 0,
        inventory
      };
    }),
    status: true
  };
}

async function buildPriceVolumeResponse(payload = {}) {
  try {
    const request = normalizeRequest(payload);
    if (!request.ratePlanIds.length && !request.hotelIds.length) {
      throw createBusinessError('缺少售卖计划ID或酒店ID', 13);
    }

    const rows = request.ratePlanIds.length
      ? await findRatePlansByIds(request.ratePlanIds)
      : await findRatePlansByHotels(request.hotelIds);

    const rowMap = new Map(rows.map((row) => [String(row.rate_plan_id), row]));
    const orderedRows = request.ratePlanIds.length
      ? request.ratePlanIds.map((id) => rowMap.get(id)).filter(Boolean)
      : rows;
    // 先批量计算库存，避免按套餐和日期循环查库导致抖音拉取时响应变慢。
    const inventoryMap = await getInventoryMap(
      orderedRows.map((row) => row.room_type_code),
      request.dates
    );

    const roomRates = request.ratePlanIds.length
      ? request.ratePlanIds.map((ratePlanId) => {
        const row = rowMap.get(ratePlanId);
        return row
          ? buildRatePlanResponse(row, request.dates, inventoryMap)
          : buildUnknownRatePlan(ratePlanId);
      })
      : orderedRows.map((row) => buildRatePlanResponse(row, request.dates, inventoryMap));

    return {
      error_code: 0,
      status: true,
      description: 'success',
      room_rates: roomRates,
      timestamp: String(Math.floor(Date.now() / 1000))
    };
  } catch (error) {
    return {
      error_code: Number(error.douyinErrorCode || 13),
      status: false,
      description: error.message || '价量态拉取失败',
      room_rates: [],
      timestamp: String(Math.floor(Date.now() / 1000))
    };
  }
}

module.exports = {
  ACTIVE_ORDER_STATUSES,
  UNKNOWN_RATE_PLAN_ERROR_CODE,
  buildDateList,
  normalizeRequest,
  buildPriceVolumeResponse
};
