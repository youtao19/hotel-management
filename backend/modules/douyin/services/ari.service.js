const postgreDB = require('../../../database/postgreDB/pg')
const { getAvailableRooms } = require('../../roomModule')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { findLocalRoomTypeByDouyinRoomId } = require('../repositories/roomTypeMapping.repository')
const { findPhysicalRoomsByRatePlanIds } = require('../repositories/physicalRoom.repository')
const {
  DOUYIN_BOOKING_ERROR,
} = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')
const { douyinConfig } = require('../../../appSettings/douyin.config')

const DOUYIN_ARI_NOTIFY_SCENE = {
  PRICE: 1,
  STOCK: 2,
}

/**
 * 判断是否为 yyyy-MM-dd 日期字符串。
 *
 * @param {*} value 原始值。
 * @returns {boolean} 是否合法。
 */
function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 判断闰年。
 *
 * @param {number} year 年份。
 * @returns {boolean} 是否闰年。
 */
function isLeapYear(year) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

/**
 * 将日期字符串加一天。
 *
 * @param {string} dateString 日期字符串。
 * @returns {string} 加一天后的日期字符串。
 */
function addOneDay(dateString) {
  let year = Number(dateString.slice(0, 4))
  let month = Number(dateString.slice(5, 7))
  let day = Number(dateString.slice(8, 10))

  day += 1

  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (day > monthDays[month - 1]) {
    day = 1
    month += 1
  }

  if (month > 12) {
    month = 1
    year += 1
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 生成闭区间日期列表。
 *
 * @param {string} startDate 开始日期。
 * @param {string} endDate 结束日期。
 * @returns {string[]} 日期列表。
 */
function buildDateRange(startDate, endDate) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate) || endDate < startDate) {
    return []
  }

  const result = []
  let currentDate = startDate

  while (currentDate <= endDate) {
    result.push(currentDate)
    currentDate = addOneDay(currentDate)
  }

  return result
}

/**
 * 元转分。
 *
 * @param {number} amount 金额（元）。
 * @returns {number} 金额（分）。
 */
function amountToCent(amount) {
  return Math.round(Number(amount || 0) * 100)
}

/**
 * 归一化售卖房型 ID 列表。
 *
 * @param {string[]} ratePlanIds 抖音售卖房型 ID 列表。
 * @returns {string[]} 归一化结果。
 */
function normalizeRatePlanIds(ratePlanIds = []) {
  return Array.from(
    new Set(
      ratePlanIds
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )
}

/**
 * 校验价量态请求参数。
 *
 * @param {Object} params 参数对象。
 * @param {string[]} params.ratePlanIds 抖音售卖房型 ID 列表。
 * @param {string} params.startDate 开始日期。
 * @param {string} params.endDate 结束日期。
 * @returns {{ratePlanIds:string[], startDate:string, endDate:string}} 归一化结果。
 */
function validateAriParams({
  ratePlanIds,
  startDate,
  endDate,
}) {
  const normalizedRatePlanIds = normalizeRatePlanIds(ratePlanIds)
  const normalizedStartDate = String(startDate || '').trim()
  const normalizedEndDate = String(endDate || '').trim()

  if (!normalizedRatePlanIds.length) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, 'ratePlanIds is required')
  }

  if (!isValidDateString(normalizedStartDate) || !isValidDateString(normalizedEndDate) || normalizedEndDate < normalizedStartDate) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_DATE, 'Invalid startDate/endDate')
  }

  return {
    ratePlanIds: normalizedRatePlanIds,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  }
}

/**
 * 查询本地房型基础信息。
 *
 * @param {string} localRoomType 本地房型编码。
 * @returns {Promise<Object|null>} 房型信息。
 */
async function findLocalRoomTypeInfo(localRoomType) {
  const result = await postgreDB.query(
    `SELECT type_code, type_name, base_price, is_closed
     FROM room_types
     WHERE type_code = $1
     LIMIT 1`,
    [localRoomType]
  )

  return result.rows[0] || null
}

/**
 * 从本地订单表回退查询 hotel_id。
 *
 * @param {string} ratePlanId 售卖房型 ID。
 * @returns {Promise<string>} hotel_id。
 */
async function findHotelIdByRatePlanId(ratePlanId) {
  const result = await postgreDB.query(
    `SELECT hotel_id
     FROM douyin_orders
     WHERE rate_plan_id = $1
       AND hotel_id IS NOT NULL
       AND hotel_id <> ''
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [ratePlanId]
  )

  return String(result.rows[0]?.hotel_id || '').trim()
}

/**
 * 从物理房型记录中解析 hotel_id。
 *
 * @param {Object} physicalRoom 物理房型记录。
 * @param {string} ratePlanId 售卖房型 ID。
 * @returns {Promise<string>} hotel_id。
 */
async function resolveHotelIdForPhysicalRoom(physicalRoom, ratePlanId) {
  const rawPayload = physicalRoom?.raw_payload || {}
  const hotelId = String(
    rawPayload?.hotel_id ||
    rawPayload?.hotelId ||
    ''
  ).trim()

  if (hotelId) {
    return hotelId
  }

  return findHotelIdByRatePlanId(ratePlanId)
}

/**
 * 组装单条基础 ARI。
 *
 * @param {Object} params 参数对象。
 * @returns {Object} 基础 ARI。
 */
function buildBaseAriItem({
  accountId,
  hotelId,
  roomId,
  ratePlanId,
  date,
  inventory,
  available,
  unitPrice,
}) {
  return {
    account_id: accountId,
    hotel_id: hotelId,
    room_id: roomId,
    rate_plan_id: ratePlanId,
    timerange: {
      start: date,
      end: date,
    },
    currency: 'CNY',
    inventory,
    available,
    original_amount: amountToCent(unitPrice),
    amount_before_tax: amountToCent(unitPrice),
  }
}

/**
 * 按售卖房型组装本地基础价量态。
 *
 * @param {Object} params 参数对象。
 * @param {string[]} params.ratePlanIds 售卖房型 ID 列表。
 * @param {string} params.startDate 开始日期。
 * @param {string} params.endDate 结束日期。
 * @returns {Promise<{aris:Object[], summary:Object}>} 组装结果。
 */
async function buildDouyinAriByRatePlanIds({
  ratePlanIds,
  startDate,
  endDate,
}) {
  const normalized = validateAriParams({
    ratePlanIds,
    startDate,
    endDate,
  })

  const dates = buildDateRange(normalized.startDate, normalized.endDate)
  const physicalRooms = await findPhysicalRoomsByRatePlanIds(normalized.ratePlanIds)

  if (!physicalRooms.length) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, 'No physical room mapping found for ratePlanIds')
  }

  const aris = []

  for (const physicalRoom of physicalRooms) {
    const ratePlanId = String(
      physicalRoom.matched_rate_plan_id ||
      physicalRoom.matched_rate_plan_id_fallback ||
      ''
    ).trim()

    if (!ratePlanId) {
      continue
    }

    const localRoomType = await findLocalRoomTypeByDouyinRoomId(physicalRoom.room_id)
    if (!localRoomType) {
      throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, `Local room type mapping not found for room_id: ${physicalRoom.room_id}`)
    }

    const localRoomTypeInfo = await findLocalRoomTypeInfo(localRoomType)
    if (!localRoomTypeInfo) {
      throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, `Local room type not found: ${localRoomType}`)
    }

    const hotelId = await resolveHotelIdForPhysicalRoom(physicalRoom, ratePlanId)
    if (!hotelId) {
      throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.MISSING_HOTEL_ID, `hotel_id not found for rate_plan_id: ${ratePlanId}`)
    }

    for (const date of dates) {
      const availableRooms = await getAvailableRooms(date, date, localRoomType)
      const inventory = availableRooms.length
      const available = localRoomTypeInfo.is_closed === true ? false : inventory > 0
      const finalInventory = localRoomTypeInfo.is_closed === true ? 0 : inventory

      aris.push(buildBaseAriItem({
        accountId: douyinConfig.accountId,
        hotelId,
        roomId: physicalRoom.room_id,
        ratePlanId,
        date,
        inventory: finalInventory,
        available,
        unitPrice: Number(localRoomTypeInfo.base_price || 0),
      }))
    }
  }

  return {
    aris,
    summary: {
      ratePlanIds: normalized.ratePlanIds,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      total: aris.length,
    },
  }
}

/**
 * 组装房量房态推送请求。
 *
 * @param {Object[]} aris 基础 ARI 列表。
 * @returns {Object} 房量房态推送请求体。
 */
function buildDouyinStockPayload(aris = []) {
  return {
    account_id: douyinConfig.accountId,
    aris: aris.map((item) => ({
      hotel_id: item.hotel_id,
      room_id: item.room_id,
      rate_plan_id: item.rate_plan_id,
      timerange: item.timerange,
      inventory: item.inventory,
      available: item.available,
    })),
  }
}

/**
 * 组装房价推送请求。
 *
 * @param {Object[]} aris 基础 ARI 列表。
 * @returns {Object} 房价推送请求体。
 */
function buildDouyinPricePayload(aris = []) {
  return {
    account_id: douyinConfig.accountId,
    aris: aris.map((item) => ({
      hotel_id: item.hotel_id,
      room_id: item.room_id,
      rate_plan_id: item.rate_plan_id,
      timerange: item.timerange,
      currency: item.currency,
      original_amount: item.original_amount,
      amount_before_tax: item.amount_before_tax,
      available: item.available,
      inventory: item.inventory,
    })),
  }
}

/**
 * 组装价量态拉取通知请求。
 *
 * @param {Object} params 参数对象。
 * @returns {Object} 通知请求体。
 */
function buildDouyinNotifyPayload({
  ratePlanIds,
  startDate,
  endDate,
}) {
  return {
    account_id: douyinConfig.accountId,
    date_range: {
      start: startDate,
      end: endDate,
    },
    notify_scene: [
      DOUYIN_ARI_NOTIFY_SCENE.PRICE,
      DOUYIN_ARI_NOTIFY_SCENE.STOCK,
    ],
    rate_plan_ids: ratePlanIds,
  }
}

/**
 * 推送房量房态。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinHotelStock({
  ratePlanIds,
  startDate,
  endDate,
}) {
  const preview = await buildDouyinAriByRatePlanIds({
    ratePlanIds,
    startDate,
    endDate,
  })

  const payload = buildDouyinStockPayload(preview.aris)
  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/stock/save/',
    withAccountId: true,
    data: payload,
  })

  return {
    payload,
    result,
    summary: preview.summary,
  }
}

/**
 * 推送房价。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinHotelPrice({
  ratePlanIds,
  startDate,
  endDate,
}) {
  const preview = await buildDouyinAriByRatePlanIds({
    ratePlanIds,
    startDate,
    endDate,
  })

  const payload = buildDouyinPricePayload(preview.aris)
  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/price/save/',
    withAccountId: true,
    data: payload,
  })

  return {
    payload,
    result,
    summary: preview.summary,
  }
}

/**
 * 通知抖音主动拉取价量态。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 通知结果。
 */
async function notifyDouyinAriRefresh({
  ratePlanIds,
  startDate,
  endDate,
}) {
  const normalized = validateAriParams({
    ratePlanIds,
    startDate,
    endDate,
  })

  const payload = buildDouyinNotifyPayload(normalized)
  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/ari/notify/',
    withAccountId: false,
    data: payload,
  })

  return {
    payload,
    result,
    summary: {
      ratePlanIds: normalized.ratePlanIds,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      total: normalized.ratePlanIds.length,
    },
  }
}

module.exports = {
  buildDouyinAriByRatePlanIds,
  buildDouyinNotifyPayload,
  buildDouyinPricePayload,
  buildDouyinStockPayload,
  notifyDouyinAriRefresh,
  pushDouyinHotelPrice,
  pushDouyinHotelStock,
}
