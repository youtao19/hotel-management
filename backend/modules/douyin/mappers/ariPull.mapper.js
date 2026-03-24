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
 * 清洗数字。
 *
 * @param {*} value 原始值。
 * @param {number|null} [defaultValue=null] 默认值。
 * @returns {number|null} 数字结果。
 */
function toNumber(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const normalized = Number(value)
  return Number.isNaN(normalized) ? defaultValue : normalized
}

/**
 * 标准化字符串数组。
 *
 * @param {*} value 原始值。
 * @returns {string[]} 清洗后的字符串数组。
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
}

/**
 * 映射抖音主动拉取价量态请求。
 *
 * @param {Object} payload 抖音原始请求体。
 * @returns {{ratePlanIds:string[], startDate:string|null, endDate:string|null, bizType:number|null, rawPayload:Object}} 统一字段。
 */
function mapDouyinAriPullPayload(payload = {}) {
  const ratePlanIds = normalizeStringArray(pick(payload, [
    'rate_plan_ids',
    'data.rate_plan_ids',
  ], []))
  const singleRatePlanId = normalizeString(pick(payload, [
    'rate_plan_id',
    'data.rate_plan_id',
  ]))

  if (singleRatePlanId) {
    ratePlanIds.unshift(singleRatePlanId)
  }

  return {
    ratePlanIds: Array.from(new Set(ratePlanIds)),
    startDate: normalizeString(pick(payload, [
      'start_date',
      'date_range.start',
      'data.start_date',
      'data.date_range.start',
      'check_in_date',
      'data.check_in_date',
    ])),
    endDate: normalizeString(pick(payload, [
      'end_date',
      'date_range.end',
      'data.end_date',
      'data.date_range.end',
      'check_out_date',
      'data.check_out_date',
    ])),
    bizType: toNumber(pick(payload, [
      'biz_type',
      'data.biz_type',
    ]), null),
    rawPayload: payload,
  }
}

module.exports = {
  mapDouyinAriPullPayload,
}
