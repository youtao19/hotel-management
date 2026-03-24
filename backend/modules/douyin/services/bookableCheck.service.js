const postgreDB = require('../../../database/postgreDB/pg')
const { getAvailableRooms } = require('../../roomModule')
const { mapDouyinBookableCheckPayload } = require('../mappers/bookableCheck.mapper')
const { findLocalRoomTypeByDouyinRoomId } = require('../repositories/roomTypeMapping.repository')
const { findPhysicalRoomByRatePlanId } = require('../repositories/physicalRoom.repository')
const {
  DOUYIN_COMMON_ERROR,
  DOUYIN_BOOKING_ERROR,
  DOUYIN_BOOKABLE_ERROR,
} = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')

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
 * 判断闰年。
 *
 * @param {number} year 年份。
 * @returns {boolean} 是否闰年。
 */
function isLeapYear(year) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

/**
 * 生成入住晚数。
 * 说明：
 * 1. 使用纯字符串算法，避免 DATE 字段时区问题；
 * 2. 同日进出按 1 晚处理，兼容本地库存逻辑。
 *
 * @param {string} startDate 入住日期。
 * @param {string} endDate 退房日期。
 * @returns {string[]} 每晚日期列表。
 */
function buildStayDates(startDate, endDate) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return []
  }

  const dates = []
  let currentDate = startDate
  const endExclusive = endDate > startDate ? endDate : addOneDay(startDate)

  while (currentDate < endExclusive) {
    dates.push(currentDate)
    currentDate = addOneDay(currentDate)
  }

  return dates.length ? dates : [startDate]
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
 * 校验可订检查请求参数。
 *
 * @param {Object} mapped 映射后的请求。
 * @returns {void}
 */
function validateDouyinBookableCheckPayload(mapped) {
  if (!mapped.ratePlanId) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, 'Missing rate_plan_id in Douyin bookable payload')
  }

  if (![2011, 2012, 2021].includes(mapped.bizType)) {
    throw createDouyinBusinessError(DOUYIN_BOOKABLE_ERROR.INVALID_BIZ_TYPE, `Invalid biz_type in Douyin bookable payload: ${mapped.bizType}`)
  }

  if (!isValidDateString(mapped.checkInDate) || !isValidDateString(mapped.checkOutDate) || mapped.checkOutDate < mapped.checkInDate) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_DATE, 'Invalid check_in_date/check_out_date in Douyin bookable payload')
  }

  if (!mapped.roomCount || mapped.roomCount <= 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_ROOM_COUNT, 'Invalid number_of_units in Douyin bookable payload')
  }

  if (!mapped.numberOfGuests || mapped.numberOfGuests <= 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_GUEST_COUNT, 'Invalid number_of_guests in Douyin bookable payload')
  }

  if (!mapped.totalAmount || mapped.totalAmount < 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_AMOUNT, 'Invalid total_amount in Douyin bookable payload')
  }
}

/**
 * 查询本地房型基础信息。
 *
 * @param {string} localRoomType 本地房型编码。
 * @returns {Promise<Object|null>} 房型基础信息。
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
 * 构建可订失败时回传的 ARI。
 *
 * @param {Object} params ARI 参数。
 * @param {string} params.ratePlanId 抖音售卖房型 ID。
 * @param {string} params.roomId 抖音物理房型 ID。
 * @param {string} params.checkInDate 入住日期。
 * @param {string} params.checkOutDate 离店日期。
 * @param {number} params.inventory 可售房量。
 * @param {boolean} params.available 房态。
 * @param {number} params.unitPrice 单晚价格（元）。
 * @param {string} params.currency 币种。
 * @returns {{stock_and_amount:Array}} 可订失败 ARI。
 */
function buildBookableAri({
  ratePlanId,
  roomId,
  checkInDate,
  checkOutDate,
  inventory,
  available,
  unitPrice,
  currency,
}) {
  const stayDates = buildStayDates(checkInDate, checkOutDate)

  return {
    stock_and_amount: stayDates.map((stayDate) => ({
      rate_plan_id: ratePlanId,
      room_id: roomId,
      timerange: {
        start: stayDate,
        end: addOneDay(stayDate),
      },
      original_amount: amountToCent(unitPrice),
      currency,
      available,
      inventory,
    })),
  }
}

/**
 * 判断价格是否与本地价格一致。
 *
 * @param {Object} params 校验参数。
 * @param {number} params.unitPrice 本地单晚价格（元）。
 * @param {Object} params.mapped 映射后的请求。
 * @returns {boolean} 一致时返回 true。
 */
function isPriceMatched({ unitPrice, mapped }) {
  const stayDates = buildStayDates(mapped.checkInDate, mapped.checkOutDate)
  const expectedTotal = Number((unitPrice * stayDates.length * mapped.roomCount).toFixed(2))

  if (Math.abs(expectedTotal - mapped.totalAmount) > 0.009) {
    return false
  }

  for (const dailyRate of mapped.dailyRates) {
    if (dailyRate.originalAmount === null || dailyRate.originalAmount === undefined) {
      continue
    }

    if (Math.abs(Number(dailyRate.originalAmount) - unitPrice) > 0.009) {
      return false
    }
  }

  return true
}

/**
 * 归一化可订检查异常。
 *
 * @param {Error} error 原始异常。
 * @returns {Error} 抖音业务异常。
 */
function normalizeDouyinBookableCheckError(error) {
  if (error?.douyinErrorCode !== undefined) {
    return error
  }

  const message = String(error?.message || '')

  if (error?.code === '40001' || error?.code === '40P01') {
    return createDouyinBusinessError(DOUYIN_COMMON_ERROR.RETRY_LATER, message || 'Database transaction should retry')
  }

  return createDouyinBusinessError(DOUYIN_COMMON_ERROR.OTHER_EXCEPTION, message || 'Unknown douyin bookable check error')
}

/**
 * 处理抖音可订检查 SPI。
 *
 * @param {Object} payload 抖音原始请求体。
 * @returns {Promise<{errorCode:number, description:string, ari:Object|null}>} 处理结果。
 */
async function handleDouyinBookableCheck(payload = {}) {
  try {
    const mapped = mapDouyinBookableCheckPayload(payload)
    validateDouyinBookableCheckPayload(mapped)

    // 中文注释：可订检查只给 rate_plan_id，所以需要先反查对应的物理房型，再找本地房型映射。
    const physicalRoom = await findPhysicalRoomByRatePlanId(mapped.ratePlanId)
    if (!physicalRoom?.room_id) {
      throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, `Rate plan is not mapped to physical room: ${mapped.ratePlanId}`)
    }

    const localRoomType = await findLocalRoomTypeByDouyinRoomId(physicalRoom.room_id)
    if (!localRoomType) {
      throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, `Douyin room type is not mapped locally: ${physicalRoom.room_id}`)
    }

    const localRoomTypeInfo = await findLocalRoomTypeInfo(localRoomType)
    if (!localRoomTypeInfo) {
      throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, `Local room type not found: ${localRoomType}`)
    }

    const unitPrice = Number(localRoomTypeInfo.base_price || 0)
    const availableRooms = await getAvailableRooms(mapped.checkInDate, mapped.checkOutDate, localRoomType)
    const inventory = availableRooms.length
    const ari = buildBookableAri({
      ratePlanId: mapped.ratePlanId,
      roomId: physicalRoom.room_id,
      checkInDate: mapped.checkInDate,
      checkOutDate: mapped.checkOutDate,
      inventory,
      available: inventory > 0,
      unitPrice,
      currency: mapped.currency,
    })

    if (localRoomTypeInfo.is_closed === true) {
      return {
        errorCode: DOUYIN_BOOKABLE_ERROR.ROOM_STATUS_CLOSED.code,
        description: DOUYIN_BOOKABLE_ERROR.ROOM_STATUS_CLOSED.description,
        ari: {
          ...ari,
          stock_and_amount: ari.stock_and_amount.map((item) => ({
            ...item,
            available: false,
            inventory: 0,
          })),
        },
      }
    }

    if (inventory < mapped.roomCount) {
      return {
        errorCode: DOUYIN_BOOKING_ERROR.ROOM_FULL.code,
        description: DOUYIN_BOOKING_ERROR.ROOM_FULL.description,
        ari,
      }
    }

    if (!isPriceMatched({ unitPrice, mapped })) {
      return {
        errorCode: DOUYIN_BOOKABLE_ERROR.PRICE_MISMATCH.code,
        description: DOUYIN_BOOKABLE_ERROR.PRICE_MISMATCH.description,
        ari,
      }
    }

    return {
      errorCode: 0,
      description: 'success',
      ari: null,
    }
  } catch (error) {
    throw normalizeDouyinBookableCheckError(error)
  }
}

module.exports = {
  handleDouyinBookableCheck,
}
