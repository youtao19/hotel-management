const { buildDouyinAriByRatePlanIds } = require('./ari.service')
const {
  DOUYIN_ARI_PULL_ERROR,
  DOUYIN_SUCCESS_RESULT,
} = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')
const { mapDouyinAriPullPayload } = require('../mappers/ariPull.mapper')

const SUPPORTED_ARI_PULL_BIZ_TYPES = [2011, 2012, 2021]

/**
 * 标准化并校验主动拉取价量态请求。
 *
 * @param {Object} payload 抖音原始请求体。
 * @returns {{ratePlanIds:string[], startDate:string, endDate:string, bizType:number|null, rawPayload:Object}} 归一化结果。
 */
function normalizeAriPullPayload(payload = {}) {
  const mapped = mapDouyinAriPullPayload(payload)

  if (!mapped.ratePlanIds.length) {
    throw createDouyinBusinessError(DOUYIN_ARI_PULL_ERROR.MISSING_RATE_PLAN_ID)
  }

  if (!mapped.startDate || !mapped.endDate) {
    throw createDouyinBusinessError(DOUYIN_ARI_PULL_ERROR.MISSING_DATE_RANGE)
  }

  if (
    mapped.bizType !== null &&
    !SUPPORTED_ARI_PULL_BIZ_TYPES.includes(mapped.bizType)
  ) {
    throw createDouyinBusinessError(DOUYIN_ARI_PULL_ERROR.INVALID_BIZ_TYPE)
  }

  return mapped
}

/**
 * 构建主动拉取接口需要的价量态列表。
 *
 * @param {Object} params 参数对象。
 * @param {string[]} params.ratePlanIds 售卖房型 ID 列表。
 * @param {string} params.startDate 开始日期。
 * @param {string} params.endDate 结束日期。
 * @returns {Promise<Object[]>} 价量态列表。
 */
async function buildDouyinPullAriItems({
  ratePlanIds,
  startDate,
  endDate,
}) {
  const result = await buildDouyinAriByRatePlanIds({
    ratePlanIds,
    startDate,
    endDate,
  })

  return result.aris.map((item) => ({
    rate_plan_id: item.rate_plan_id,
    room_id: item.room_id,
    timerange: item.timerange,
    original_amount: item.original_amount,
    amount_before_tax: item.amount_before_tax,
    currency: item.currency,
    inventory: item.inventory,
    available: item.available,
  }))
}

/**
 * 处理抖音主动拉取价量态 SPI。
 *
 * @param {Object} payload 抖音原始请求体。
 * @param {Object} [options={}] 附加选项。
 * @returns {Promise<{errorCode:number, description:string, stockAndAmount:Object[]}>} 处理结果。
 */
async function handleDouyinAriPull(payload = {}, options = {}) {
  const normalized = normalizeAriPullPayload(payload)
  const stockAndAmount = await buildDouyinPullAriItems({
    ratePlanIds: normalized.ratePlanIds,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
  })

  return {
    errorCode: DOUYIN_SUCCESS_RESULT.code,
    description: DOUYIN_SUCCESS_RESULT.description,
    stockAndAmount,
    summary: {
      ratePlanIds: normalized.ratePlanIds,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      total: stockAndAmount.length,
      douyinLogId: String(options.douyinLogId || '').trim(),
    },
  }
}

module.exports = {
  SUPPORTED_ARI_PULL_BIZ_TYPES,
  buildDouyinPullAriItems,
  handleDouyinAriPull,
  normalizeAriPullPayload,
}
