/**
 * 按候选路径顺序从对象中提取第一个可用值。
 *
 * @param {Object} obj 源对象。
 * @param {string[]} paths 候选字段路径。
 * @param {*} [defaultValue=null] 默认值。
 * @returns {*} 命中的值。
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
 * @param {*} [defaultValue=null] 默认值。
 * @returns {number|null|*} 转换结果。
 */
function toNumber(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') return defaultValue
  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * 将分转换为元。
 *
 * @param {*} value 原始金额。
 * @returns {number|null} 转换后的金额。
 */
function toAmountNumber(value) {
  const num = toNumber(value, null)
  if (num === null) return null
  return Number((num / 100).toFixed(2))
}

/**
 * 清洗字符串值。
 *
 * @param {*} value 原始值。
 * @param {string|null} [defaultValue=null] 默认值。
 * @returns {string|null} 清洗后的字符串。
 */
function normalizeString(value, defaultValue = null) {
  if (value === undefined || value === null) return defaultValue
  const normalized = String(value).trim()
  return normalized === '' ? defaultValue : normalized
}

/**
 * 标准化手机号字段。
 *
 * @param {*} value 原始值。
 * @returns {string} 可用于本地展示的手机号；无法识别时返回空字符串。
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
 * 映射抖音酒店预售券创单请求。
 *
 * @param {Object} payload 抖音原始请求体。
 * @returns {Object} 映射后的预售订单数据。
 */
function mapDouyinPresaleBookingPayload(payload = {}) {
  /** @type {string|null} 抖音预售订单号。 */
  const otaOrderId = normalizeString(pick(payload, ['order_id']))
  /** @type {string|null} 来源订单号。 */
  const sourceOrderId = normalizeString(pick(payload, ['source_order_id']))
  /** @type {string|null} 抖音商家账户ID。 */
  const accountId = normalizeString(pick(payload, ['account_id']))
  /** @type {string|null} 抖音酒店ID。 */
  const hotelId = normalizeString(pick(payload, ['hotel_id']))
  /** @type {number|null} 业务类型。 */
  const bizType = toNumber(pick(payload, ['biz_type']))
  /** @type {string} 当前预售订单阶段。 */
  const orderStage = DOUYIN_PRESALE_ORDER_STAGE.PRESALE_CREATED
  /** @type {string} 抖音落地订单状态。 */
  const orderStatus = DOUYIN_PRESALE_ORDER_STAGE.PRESALE_CREATED
  /** @type {string|null} 预售券ID。 */
  const preSaleCouponId = normalizeString(pick(payload, ['pre_sale_coupon_id']))
  /** @type {string|null} 商品ID。 */
  const goodsId = normalizeString(pick(payload, ['goods_id']))
  /** @type {string|null} 商品SKU ID。 */
  const skuId = normalizeString(pick(payload, ['sku_id']))
  /** @type {string|null} 售卖房型ID。 */
  const ratePlanId = normalizeString(pick(payload, ['rate_plan_id']))
  /** @type {number|null} 预售券数量。 */
  const voucherCount = toNumber(pick(payload, ['coupon_count', 'voucher_count']), null)
  /** @type {number|null} 单张预售券金额。 */
  const eachCouponAmount = toAmountNumber(pick(payload, ['coupon_amount', 'each_coupon_amount']))
  /** @type {number|null} 订单总金额。 */
  const totalAmount = toAmountNumber(pick(payload, ['total_amount']))
  /** @type {string} 币种。 */
  const currency = normalizeString(pick(payload, ['currency']), 'CNY')
  /** @type {string|null} 入住日期。 */
  const checkInDate = normalizeString(pick(payload, ['check_in_date']))
  /** @type {string|null} 离店日期。 */
  const checkOutDate = normalizeString(pick(payload, ['check_out_date']))
  /** @type {string|null} 最早到店时间。 */
  const earlyArrivalTime = normalizeString(pick(payload, ['early_arrival_time']))
  /** @type {string|null} 最晚到店时间。 */
  const lastArrivalTime = normalizeString(pick(payload, ['last_arrival_time']))
  /** @type {string|null} 联系人姓名。 */
  const contactName = normalizeString(pick(payload, ['contact_info.name', 'contact_name']))
  /** @type {string|null} 联系人手机号原始值。 */
  const contactMobileRaw = normalizeString(pick(payload, ['contact_info.phone', 'contact_mobile']))
  /** @type {string} 联系人手机号标准化结果。 */
  const contactMobile = normalizeLocalPhone(contactMobileRaw)
  /** @type {string|null} 主要客人姓名。 */
  const guestName = normalizeString(pick(payload, ['guest_name']), contactName)
  /** @type {string|null} 主要客人手机号原始值。 */
  const guestMobileRaw = normalizeString(pick(payload, ['guest_mobile']), contactMobileRaw)
  /** @type {string} 主要客人手机号标准化结果。 */
  const guestMobile = normalizeLocalPhone(guestMobileRaw)
  /** @type {string|null} 抖音备注。 */
  const remarkFromDouyin = normalizeString(pick(payload, ['remark_from_douyin']))
  /** @type {string|null} 客人备注。 */
  const remarkFromGuest = normalizeString(pick(payload, ['remark_from_guest']))

  return {
    otaOrderId,
    sourceOrderId,
    accountId,
    hotelId,
    bizType,
    orderStage,
    orderStatus,
    preSaleCouponId,
    goodsId,
    skuId,
    ratePlanId,
    voucherCount,
    eachCouponAmount,
    totalAmount,
    amount: totalAmount,
    amountBeforeTax: totalAmount,
    currency,
    checkInDate,
    checkOutDate,
    earlyArrivalTime,
    lastArrivalTime,
    contactName,
    contactMobileRaw,
    contactMobile,
    guestName,
    guestMobileRaw,
    guestMobile,
    roomCount: voucherCount,
    numberOfGuests: voucherCount,
    remarkFromDouyin,
    remarkFromGuest,
    dailyRates: [],
    occupancies: [],
    memberInfo: null,
    roomId: null,
    roomName: null,
    rawPayload: payload,
  }
}

module.exports = {
  mapDouyinPresaleBookingPayload,
}
const { DOUYIN_PRESALE_ORDER_STAGE } = require('../constants/enums')
