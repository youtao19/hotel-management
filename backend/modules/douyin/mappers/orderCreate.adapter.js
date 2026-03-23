const {
  generateOrderNumber,
  randomRoomNumber,
} = require('../../tools')

const {
  findLocalRoomTypeByDouyinRoomId,
} = require('../repositories/roomTypeMapping.repository')

/**
 * 将抖音订单转换为本地 createOrder 入参。
 *
 * @param {Object} douyinOrder 抖音订单落地记录。
 * @returns {Promise<Object>} 本地创建订单所需数据。
 * @throws {Error} 房型未映射或无可用房时抛出异常。
 */
async function buildCreateOrderDataFromDouyin(douyinOrder) {
  /** @type {string} 本地系统订单号。 */
  const orderId = generateOrderNumber()

  /** @type {string|null} 本地房型编码。 */
  const localRoomType =
    await findLocalRoomTypeByDouyinRoomId(douyinOrder.room_id)

  if (!localRoomType) {
    throw new Error(`Douyin room type is not mapped: room_id=${douyinOrder.room_id}`)
  }

  /** @type {string|null} 随机分配的房号。 */
  const roomNum = await randomRoomNumber(
    localRoomType,
    douyinOrder.check_in_date,
    douyinOrder.check_out_date
  )

  if (!roomNum) {
    throw new Error(
      `No available room for roomType=${localRoomType}, checkIn=${douyinOrder.check_in_date}, checkOut=${douyinOrder.check_out_date}`
    )
  }

  /** @type {Object} 本地每日房价。 */
  const roomPrice = buildDailyPriceFromDouyinOrder(douyinOrder)

  return {
    orderId,
    sourceNumber: douyinOrder.ota_order_id,
    orderSource: 'douyin',

    guestName: douyinOrder.guest_name,
    phone: normalizeLocalPhone(douyinOrder.guest_mobile),

    roomType: localRoomType,
    roomNumber: roomNum,

    checkInDate: douyinOrder.check_in_date,
    checkOutDate: douyinOrder.check_out_date,

    status: 'pending',

    paymentMethod: '平台',

    roomPrice,

    deposit: 0,

    createTime: new Date(),

    remarks: buildDouyinOrderRemarks(douyinOrder),

    isPrepaid: false,
    prepaidAmount: 0,

    stayType: '客房',
  }
}

/**
 * 生成抖音订单备注。
 *
 * @param {Object} douyinOrder 抖音订单落地记录。
 * @returns {string} 拼接后的订单备注。
 */
function buildDouyinOrderRemarks(douyinOrder) {
  /** @type {string[]} 备注片段列表。 */
  const remarkParts = [
    `来自抖音OTA，抖音订单号: ${douyinOrder.ota_order_id}`,
  ]

  if (douyinOrder.remark_from_douyin) {
    remarkParts.push(`抖音备注: ${douyinOrder.remark_from_douyin}`)
  }

  if (douyinOrder.remark_from_guest) {
    remarkParts.push(`客人备注: ${douyinOrder.remark_from_guest}`)
  }

  return remarkParts.join('；')
}

/**
 * 规范化本地可直接使用的手机号。
 *
 * @param {*} value 原始手机号字段。
 * @returns {string} 规范化后的手机号；无法识别时返回空字符串。
 */
function normalizeLocalPhone(value) {
  if (value === undefined || value === null) return ''

  /** @type {string} 去除空白后的手机号字符串。 */
  const compact = String(value).trim().replace(/[\s-]/g, '')
  return /^\+?\d{6,20}$/.test(compact) ? compact : ''
}

/**
 * 按 yyyy-MM-dd 字符串生成日期范围。
 * 说明：
 * 1. 不对 DATE 字段使用 new Date(date) 或 toISOString()；
 * 2. 仅使用字符串解析和日历算法生成入住区间。
 *
 * @param {string} startDate 起始日期（包含）。
 * @param {string} endDateExclusive 结束日期（不包含）。
 * @returns {string[]} 日期字符串数组。
 */
function buildDateRange(startDate, endDateExclusive) {
  if (!isValidDateString(startDate) || !isValidDateString(endDateExclusive)) {
    return []
  }

  /** @type {string[]} 日期结果列表。 */
  const dates = []
  /** @type {string} 当前迭代日期。 */
  let currentDate = startDate

  while (currentDate < endDateExclusive) {
    dates.push(currentDate)
    currentDate = addOneDay(currentDate)
  }

  if (!dates.length) {
    dates.push(startDate)
  }

  return dates
}

/**
 * 判断是否为合法 yyyy-MM-dd 日期字符串。
 *
 * @param {*} value 原始日期值。
 * @returns {boolean} 合法时返回 true。
 */
function isValidDateString(value) {
  if (typeof value !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 将日期字符串加一天。
 *
 * @param {string} dateString 日期字符串 yyyy-MM-dd。
 * @returns {string} 加一天后的日期字符串。
 */
function addOneDay(dateString) {
  /** @type {number} 年份。 */
  let year = Number(dateString.slice(0, 4))
  /** @type {number} 月份。 */
  let month = Number(dateString.slice(5, 7))
  /** @type {number} 日期。 */
  let day = Number(dateString.slice(8, 10))

  day += 1

  /** @type {number} 当前月份天数。 */
  const monthDays = getMonthDays(year, month)
  if (day > monthDays) {
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
 * 获取指定年月的天数。
 *
 * @param {number} year 年份。
 * @param {number} month 月份。
 * @returns {number} 当月天数。
 */
function getMonthDays(year, month) {
  /** @type {number[]} 各月天数。 */
  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return monthDays[month - 1] || 30
}

/**
 * 判断是否为闰年。
 *
 * @param {number} year 年份。
 * @returns {boolean} 闰年返回 true。
 */
function isLeapYear(year) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

/**
 * 将抖音订单金额转换为本地每日房价。
 * 优先使用官方 daily_rates；若缺失则按总金额均分到每个入住日。
 *
 * @param {Object} douyinOrder 抖音订单落地记录。
 * @returns {Object} 本地每日房价。
 */
function buildDailyPriceFromDouyinOrder(douyinOrder) {
  /** @type {Object|null} 优先采用官方分日价格。 */
  const roomPriceFromDailyRates = parseDailyRatesRoomPrice(douyinOrder.daily_rates)
  if (roomPriceFromDailyRates && Object.keys(roomPriceFromDailyRates).length) {
    return roomPriceFromDailyRates
  }

  return buildAverageDailyPrice(
    douyinOrder.check_in_date,
    douyinOrder.check_out_date,
    douyinOrder.amount
  )
}

/**
 * 解析 douyin_orders.daily_rates 字段。
 *
 * @param {*} dailyRatesValue 数据库中的 daily_rates 字段。
 * @returns {Object|null} 解析后的每日房价；无有效值时返回 null。
 */
function parseDailyRatesRoomPrice(dailyRatesValue) {
  /** @type {Array} 解析后的 daily_rates 数组。 */
  let dailyRates = []

  if (Array.isArray(dailyRatesValue)) {
    dailyRates = dailyRatesValue
  } else if (typeof dailyRatesValue === 'string' && dailyRatesValue.trim()) {
    try {
      dailyRates = JSON.parse(dailyRatesValue)
    } catch (error) {
      dailyRates = []
    }
  }

  /** @type {Object} 每日房价结果。 */
  const roomPrice = {}

  for (const rate of dailyRates) {
    /** @type {string|null} 房价生效日期。 */
    const stayDate = typeof rate?.period_start_date === 'string' ? rate.period_start_date : null
    /** @type {number|null} 单晚房价。 */
    const originalAmount = rate?.original_amount === undefined || rate?.original_amount === null
      ? null
      : Number(rate.original_amount)

    if (!stayDate || Number.isNaN(originalAmount)) {
      continue
    }

    roomPrice[stayDate] = Number((originalAmount / 100).toFixed(2))
  }

  return Object.keys(roomPrice).length ? roomPrice : null
}

/**
 * 将总金额按入住天数平均拆分为每日房价。
 *
 * @param {string} checkIn 入住日期。
 * @param {string} checkOut 离店日期。
 * @param {*} totalAmount 总金额（元）。
 * @returns {Object} 每日房价对象。
 */
function buildAverageDailyPrice(checkIn, checkOut, totalAmount) {
  if (!checkIn || !checkOut) return {}

  /** @type {string[]} 入住区间日期列表。 */
  const stayDates = buildDateRange(checkIn, checkOut)
  /** @type {number} 入住天数。 */
  const days = Math.max(stayDates.length, 1)
  /** @type {number} 总金额。 */
  const amount = Number(totalAmount || 0)
  /** @type {number} 平均每日房价。 */
  const avg = amount / days
  /** @type {Object} 每日房价结果。 */
  const result = {}

  for (const stayDate of stayDates) {
    result[stayDate] = Number(avg.toFixed(2))
  }

  return result
}

module.exports = {
  buildCreateOrderDataFromDouyin,
}
