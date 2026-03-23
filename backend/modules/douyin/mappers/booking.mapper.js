/**
 * 按候选路径顺序从对象中提取第一个可用值。
 * 说明：
 * 1. 支持点号路径（如 "data.order_id"）进行多级取值；
 * 2. 按 paths 顺序依次尝试，命中即返回，不再继续；
 * 3. 当路径不存在或最终值为 undefined 时视为未命中；
 * 4. 全部路径未命中时返回 defaultValue。
 *
 * @param {Object} obj 需要读取的源对象。
 * @param {string[]} paths 候选字段路径列表，按优先级从高到低排列。
 * @param {*} [defaultValue=null] 未命中时的默认返回值。
 * @returns {*} 命中的字段值；若都未命中则返回 defaultValue。
 */
function pick(obj, paths, defaultValue = null) {
  for (const path of paths) {
    const keys = path.split('.')
    let current = obj

    let found = true
    for (const key of keys) {
      if (current == null || !(key in current)) {
        found = false
        break
      }
      current = current[key]
    }

    if (found && current !== undefined) {
      return current
    }
  }

  return defaultValue
}

/**
 * 将值转换为数字。
 *
 * @param {*} value 原始值。
 * @param {*} [defaultValue=null] 转换失败时的默认值。
 * @returns {number|null|*} 转换后的数字；失败时返回 defaultValue。
 */
function toNumber(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') return defaultValue
  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * 将抖音金额分转换为本地系统使用的元。
 * 兼容历史 mock 直接传元金额的场景。
 *
 * @param {*} value 原始金额。
 * @param {Object} [options={}] 转换选项。
 * @param {boolean} [options.fromCent=true] 是否按“分”转“元”。
 * @param {*} [options.defaultValue=null] 转换失败时的默认值。
 * @returns {number|null|*} 转换后的金额。
 */
function toAmountNumber(value, options = {}) {
  const {
    fromCent = true,
    defaultValue = null,
  } = options

  const numericValue = toNumber(value, defaultValue)
  if (numericValue === defaultValue) {
    return defaultValue
  }

  const normalized = fromCent ? numericValue / 100 : numericValue
  return Number(normalized.toFixed(2))
}

/**
 * 清洗字符串值，统一去除前后空白。
 *
 * @param {*} value 原始值。
 * @param {string|null} [defaultValue=null] 为空时的默认值。
 * @returns {string|null} 清洗后的字符串。
 */
function normalizeString(value, defaultValue = null) {
  if (value === undefined || value === null) return defaultValue
  const normalized = String(value).trim()
  return normalized === '' ? defaultValue : normalized
}

/**
 * 规范化本地订单可使用的手机号。
 * 说明：
 * 1. 抖音部分字段可能是加密串，当前系统无法直接解密；
 * 2. 仅当值形态接近手机号时才回写到本地订单 phone 字段；
 * 3. 原始值仍保留在 mappedPayload/rawPayload 中，便于后续补解密。
 *
 * @param {*} value 原始手机号字段。
 * @returns {string} 可用于本地订单的手机号；无法识别时返回空字符串。
 */
function normalizeLocalPhone(value) {
  const normalized = normalizeString(value, '')
  if (!normalized) return ''

  const compact = normalized.replace(/[\s-]/g, '')
  if (/^\+?\d{6,20}$/.test(compact)) {
    return compact
  }

  return ''
}

/**
 * 规范化数组字段，确保始终返回数组。
 *
 * @param {*} value 原始值。
 * @returns {Array} 规范化后的数组。
 */
function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

/**
 * 将官方 daily_rates 转换为本地按天房价结构。
 *
 * @param {Array} dailyRates 抖音单日价格数组。
 * @returns {Object} 以 YYYY-MM-DD 为 key 的每日房价（元）。
 */
function mapDailyRatesToRoomPrice(dailyRates) {
  /** @type {Object} 本地房价映射对象。 */
  const roomPrice = {}

  for (const rate of normalizeArray(dailyRates)) {
    const stayDate = normalizeString(rate?.period_start_date)
    const originalAmount = toAmountNumber(rate?.original_amount, {
      fromCent: true,
      defaultValue: null,
    })

    if (!stayDate || originalAmount === null) {
      continue
    }

    roomPrice[stayDate] = originalAmount
  }

  return roomPrice
}

/**
 * 汇总 daily_rates 的总金额（元）。
 *
 * @param {Array} dailyRates 抖音单日价格数组。
 * @returns {number|null} 汇总金额；无有效值时返回 null。
 */
function sumDailyRatesAmount(dailyRates) {
  const roomPrice = mapDailyRatesToRoomPrice(dailyRates)
  const values = Object.values(roomPrice)

  if (!values.length) {
    return null
  }

  const total = values.reduce((sum, amount) => sum + amount, 0)
  return Number(total.toFixed(2))
}

/**
 * 提取主要入住人信息，便于兼容当前本地系统订单模型。
 *
 * @param {Array} occupancies 入住人列表。
 * @returns {{guestName: string|null, guestMobileRaw: string|null, guestMobile: string}} 主要入住人信息。
 */
function extractPrimaryOccupancy(occupancies) {
  const [firstOccupancy = {}] = normalizeArray(occupancies)
  const guestName = normalizeString(firstOccupancy.name)
  const guestMobileRaw = normalizeString(firstOccupancy.phone)

  return {
    guestName,
    guestMobileRaw,
    guestMobile: normalizeLocalPhone(guestMobileRaw),
  }
}

/**
 * 将抖音“酒店创建订单”回调请求映射为本地统一字段。
 *
 * @param {Object} payload 抖音原始回调请求体。
 * @returns {Object} 映射后的本地统一字段。
 */
function mapDouyinBookingPayload(payload = {}) {
  /** @type {string|null} 抖音订单号。 */
  const otaOrderId = normalizeString(pick(payload, [
    'order_id',
    'data.order_id',
    'order.order_id',
  ]))

  /** @type {string|null} 预售来源订单号。 */
  const sourceOrderId = normalizeString(pick(payload, [
    'source_order_id',
    'data.source_order_id',
  ]))

  /** @type {string|null} 抖音酒店ID。 */
  const hotelId = normalizeString(pick(payload, [
    'hotel_id',
    'data.hotel_id',
  ]))

  /** @type {string|null} 抖音商家账户ID。 */
  const accountId = normalizeString(pick(payload, [
    'account_id',
    'data.account_id',
    'poi_account_id',
  ]))

  /** @type {string} 落地订单状态。 */
  const orderStatus = normalizeString(pick(payload, [
    'order_status',
    'data.order_status',
    'status',
  ]), 'created')

  /** @type {string|null} 抖音物理房型ID。 */
  const roomId = normalizeString(pick(payload, [
    'room_id',
    'data.room_id',
    'room.room_id',
    'physical_room_id',
    'data.physical_room_id',
  ]))

  /** @type {string|null} 抖音售卖房型ID。 */
  const ratePlanId = normalizeString(pick(payload, [
    'rate_plan_id',
    'data.rate_plan_id',
  ]))

  /** @type {number|null} 业务类型。 */
  const bizType = toNumber(pick(payload, [
    'biz_type',
    'data.biz_type',
  ]))

  /** @type {string|null} 入住日期。 */
  const checkInDate = normalizeString(pick(payload, [
    'check_in_date',
    'arrival_date',
    'data.check_in_date',
  ]))

  /** @type {string|null} 离店日期。 */
  const checkOutDate = normalizeString(pick(payload, [
    'check_out_date',
    'departure_date',
    'data.check_out_date',
  ]))

  /** @type {string|null} 预计最早到店时间。 */
  const earlyArrivalTime = normalizeString(pick(payload, [
    'early_arrival_time',
    'data.early_arrival_time',
  ]))

  /** @type {string|null} 预计最晚到店时间。 */
  const lastArrivalTime = normalizeString(pick(payload, [
    'last_arrival_time',
    'data.last_arrival_time',
  ]))

  /** @type {number|null} 预定间数。 */
  const roomCount = toNumber(pick(payload, [
    'number_of_units',
    'data.number_of_units',
    'room_count',
    'data.room_count',
    'room_num',
  ]))

  /** @type {number|null} 入住人数。 */
  const numberOfGuests = toNumber(pick(payload, [
    'number_of_guests',
    'data.number_of_guests',
  ]))

  /** @type {Array} 单日价格数组。 */
  const dailyRates = normalizeArray(pick(payload, [
    'daily_rates',
    'data.daily_rates',
  ], []))

  /** @type {number|null} 订单总价（元）。 */
  const totalAmount = toAmountNumber(pick(payload, [
    'total_amount',
    'data.total_amount',
  ]), {
    fromCent: true,
    defaultValue: null,
  })

  /** @type {number|null} 税前总价（元）。 */
  const amountBeforeTax = toAmountNumber(pick(payload, [
    'amount_before_tax',
    'data.amount_before_tax',
  ]), {
    fromCent: true,
    defaultValue: null,
  })

  /** @type {number|null} 兼容旧 mock 的直传金额。 */
  const legacyAmount = toAmountNumber(pick(payload, [
    'amount',
    'data.amount',
    'pay_amount',
  ]), {
    fromCent: false,
    defaultValue: null,
  })

  /** @type {Object} 按天房价（元）。 */
  const roomPrice = mapDailyRatesToRoomPrice(dailyRates)
  /** @type {number|null} 汇总后的总金额（元）。 */
  const dailyRatesAmount = sumDailyRatesAmount(dailyRates)

  /** @type {string} 币种。 */
  const currency = normalizeString(
    pick(payload, [
      'currency',
      'data.currency',
      'daily_rates.0.currency',
      'data.daily_rates.0.currency',
    ]),
    'CNY'
  )

  /** @type {string|null} 抖音房型名称。 */
  const roomName = normalizeString(pick(payload, [
    'room_name',
    'data.room_name',
    'room.cn_name',
    'physical_room_name',
    'data.physical_room_name',
  ]))

  /** @type {Array} 入住人列表。 */
  const occupancies = normalizeArray(pick(payload, [
    'occupancies',
    'data.occupancies',
  ], []))

  /** @type {{guestName: string|null, guestMobileRaw: string|null, guestMobile: string}} 主要入住人信息。 */
  const primaryOccupancy = extractPrimaryOccupancy(occupancies)

  /** @type {Object} 联系人信息。 */
  const contactInfo = pick(payload, [
    'contact_info',
    'data.contact_info',
  ], {}) || {}

  /** @type {string|null} 联系人姓名。 */
  const contactName = normalizeString(
    contactInfo.name || pick(payload, [
      'contact.name',
      'guest.name',
      'data.contact.name',
    ])
  )

  /** @type {string|null} 联系人原始手机号字段。 */
  const contactMobileRaw = normalizeString(
    contactInfo.phone || pick(payload, [
      'guest_mobile',
      'contact.mobile',
      'guest.mobile',
      'data.contact.mobile',
    ])
  )

  /** @type {string} 本地系统可直接使用的联系人手机号。 */
  const contactMobile = normalizeLocalPhone(contactMobileRaw)

  /** @type {string|null} 客人姓名。 */
  const guestName = normalizeString(
    pick(payload, [
      'guest_name',
      'data.guest_name',
    ]) || contactName || primaryOccupancy.guestName
  )

  /** @type {string|null} 原始手机号字段。 */
  const guestMobileRaw = normalizeString(
    pick(payload, [
      'guest_mobile',
      'data.guest_mobile',
    ]) || contactMobileRaw || primaryOccupancy.guestMobileRaw
  )

  /** @type {string} 本地系统可直接使用的手机号。 */
  const guestMobile = normalizeLocalPhone(
    pick(payload, [
      'guest_mobile',
      'data.guest_mobile',
    ]) || contactMobile || primaryOccupancy.guestMobile
  )

  /** @type {string|null} 抖音备注。 */
  const remarkFromDouyin = normalizeString(pick(payload, [
    'remark_from_douyin',
    'data.remark_from_douyin',
  ]))

  /** @type {string|null} 客户备注。 */
  const remarkFromGuest = normalizeString(pick(payload, [
    'remark_from_guest',
    'data.remark_from_guest',
  ]))

  /** @type {Object|null} 会员信息。 */
  const memberInfo = pick(payload, [
    'member_info',
    'data.member_info',
  ], null)

  /** @type {Array} 人群配置。 */
  const crowdConfig = normalizeArray(pick(payload, [
    'crowd_config',
    'data.crowd_config',
  ], []))

  /** @type {Array} 餐食信息。 */
  const meals = normalizeArray(pick(payload, [
    'meals',
    'data.meals',
  ], []))

  /** @type {Array} 取消规则。 */
  const cancelRule = normalizeArray(pick(payload, [
    'cancel_rule',
    'data.cancel_rule',
  ], []))

  /** @type {number|null} 下单时间戳。 */
  const createOrderTimeUnix = toNumber(pick(payload, [
    'create_order_time_unix',
    'data.create_order_time_unix',
  ]))

  return {
    otaOrderId,
    sourceOrderId,
    hotelId,
    accountId,
    orderStatus,
    roomId,
    roomName,
    ratePlanId,
    bizType,
    guestName,
    guestMobile,
    guestMobileRaw,
    contactName,
    contactMobile,
    contactMobileRaw,
    checkInDate,
    checkOutDate,
    earlyArrivalTime,
    lastArrivalTime,
    roomCount,
    numberOfGuests,
    dailyRates,
    roomPrice,
    amount: totalAmount ?? dailyRatesAmount ?? legacyAmount,
    amountBeforeTax,
    currency,
    occupancies,
    contactInfo,
    meals,
    cancelRule,
    remarkFromDouyin,
    remarkFromGuest,
    memberInfo,
    crowdConfig,
    createOrderTimeUnix,
    rawPayload: payload,
  }
}

module.exports = {
  mapDouyinBookingPayload,
}
