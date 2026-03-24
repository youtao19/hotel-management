/**
 * 按候选路径顺序读取字段。
 *
 * @param {Object} obj 源对象。
 * @param {string[]} paths 候选路径。
 * @param {*} [defaultValue=null] 默认值。
 * @returns {*} 命中结果。
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
 * 清洗字符串。
 *
 * @param {*} value 原始值。
 * @param {string|null} [defaultValue=null] 默认值。
 * @returns {string|null} 清洗后的字符串。
 */
function normalizeString(value, defaultValue = null) {
  if (value === undefined || value === null) {
    return defaultValue
  }

  const normalized = String(value).trim()
  return normalized === '' ? defaultValue : normalized
}

/**
 * 转换数字。
 *
 * @param {*} value 原始值。
 * @param {*} [defaultValue=null] 默认值。
 * @returns {number|null|*} 转换结果。
 */
function toNumber(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}

/**
 * 将分转元。
 *
 * @param {*} value 原始金额（分）。
 * @returns {number|null} 转换后的金额（元）。
 */
function toAmountNumber(value) {
  const num = toNumber(value, null)
  if (num === null) {
    return null
  }

  return Number((num / 100).toFixed(2))
}

/**
 * 标准化数组字段。
 *
 * @param {*} value 原始值。
 * @returns {Array} 数组结果。
 */
function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

/**
 * 映射抖音可订检查请求。
 *
 * @param {Object} payload 抖音原始请求体。
 * @returns {Object} 映射后的统一字段。
 */
function mapDouyinBookableCheckPayload(payload = {}) {
  /** @type {Array} 单日价格列表。 */
  const dailyRates = normalizeArray(pick(payload, ['daily_rates'], []))

  return {
    ratePlanId: normalizeString(pick(payload, ['rate_plan_id'])),
    bizType: toNumber(pick(payload, ['biz_type'])),
    checkInDate: normalizeString(pick(payload, ['check_in_date'])),
    checkOutDate: normalizeString(pick(payload, ['check_out_date'])),
    roomCount: toNumber(pick(payload, ['number_of_units']), null),
    numberOfGuests: toNumber(pick(payload, ['number_of_guests']), null),
    totalAmount: toAmountNumber(pick(payload, ['total_amount'])),
    currency: normalizeString(pick(payload, ['currency']), 'CNY'),
    dailyRates: dailyRates.map((item) => ({
      originalAmount: toAmountNumber(item?.original_amount),
      periodStartDate: normalizeString(item?.period_start_date),
      periodEndDate: normalizeString(item?.period_end_date),
      currency: normalizeString(item?.currency, 'CNY'),
    })),
    rawPayload: payload,
  }
}

module.exports = {
  mapDouyinBookableCheckPayload,
}
