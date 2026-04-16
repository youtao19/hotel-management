"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const {
  DOUYIN_COMMON_ERROR,
  DOUYIN_RATE_PLAN_ERROR,
} = require('../constants/errorCodes')
const { upsertPhysicalRoom } = require('../repositories/physicalRoom.repository')
const { findLocalRatePlanDetails } = require('../repositories/localRatePlan.repository')
const { upsertChannelMapping } = require('../../ota/repositories/channelMapping.repository')
const {
  buildRatePlanModeConfig,
  mergeRatePlanList,
  resolveModeSuffix,
  resolveRatePlanMapItem,
} = require('./ratePlanCreate.service')
const { resolveAccountId } = require('./physicalRoomCreate.service')
const { createDouyinBusinessError } = require('../utils/douyinError')

const DOUYIN_CHANNEL_CODE = 'DOUYIN'
const RATE_PLAN_TARGET_TYPE = 'RATE_PLAN'

/**
 * 将本地套餐 ID 转成正整数。
 *
 * @param {unknown} value 原始 ID。
 * @returns {number|null} 正整数 ID。
 */
function normalizeLocalRatePlanId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * 解析套餐对应的抖音酒店 ID。
 *
 * 物理房型同步时可能来自不同官方接口，raw_payload 中酒店字段命名不完全一致，
 * 所以这里兼容 snake_case 和 camelCase，避免老数据无法继续同步套餐。
 *
 * @param {Object} localProduct 本地套餐详情。
 * @param {string} [poiId] 请求传入的酒店 ID。
 * @returns {string} 抖音酒店 ID。
 */
function resolveDouyinPoiId(localProduct, poiId) {
  return String(
    poiId ||
    localProduct?.raw_hotel_id ||
    localProduct?.raw_hotel_id_camel ||
    localProduct?.raw_poi_id ||
    localProduct?.raw_poi_id_camel ||
    douyinConfig.poiId ||
    ''
  ).trim()
}

/**
 * 判断本地套餐是否应该在抖音侧上架。
 *
 * 套餐、物理房间、本地房型任一层被关闭时都不能对外售卖，
 * 避免只同步商品本身却绕过本地房态控制。
 *
 * @param {Object} localProduct 本地套餐详情。
 * @returns {boolean} 是否上架。
 */
function resolveRatePlanActive(localProduct) {
  const status = localProduct?.status === null || localProduct?.status === undefined
    ? 1
    : Number(localProduct.status)

  return status === 1 &&
    localProduct?.room_is_closed !== true &&
    localProduct?.room_type_is_closed !== true
}

/**
 * 构建抖音售卖房型项。
 *
 * @param {Object} params 参数对象。
 * @param {Object} params.localProduct 本地套餐详情。
 * @param {string} params.mode 商品模式。
 * @param {Object} params.modeConfig 模式配置。
 * @returns {Object} 抖音售卖房型。
 */
function buildDouyinRatePlanItem({
  localProduct,
  mode,
  modeConfig,
}) {
  const normalizedMode = resolveModeSuffix(mode)
  const outRatePlanId = String(localProduct.id)
  const localRoomTypeInfo = {
    type_code: localProduct.type_code,
    type_name: localProduct.type_name,
    is_closed: localProduct.room_type_is_closed,
  }
  const baseRatePlan = {
    rate_plan_name: String(localProduct.name || localProduct.type_name || outRatePlanId).trim(),
    out_rate_plan_id: outRatePlanId,
    currency: 'CNY',
    active: resolveRatePlanActive(localProduct),
    confirm_immediately: false,
    sales_type: 1,
    settle_type: 1,
  }
  const extraConfig = buildRatePlanModeConfig({
    mode: normalizedMode,
    localRoomTypeInfo,
    extraConfig: modeConfig,
  })

  return {
    ...baseRatePlan,
    ...extraConfig,
  }
}

/**
 * 校验抖音售卖房型保存结果。
 *
 * 抖音 OpenAPI 可能 HTTP 200 但业务失败；这里先透出业务错误，
 * 避免后续把失败响应误写入本地映射表。
 *
 * @param {Object} saveResult 抖音保存响应。
 * @returns {void}
 */
function assertRatePlanSaveResult(saveResult = {}) {
  const errorCode = Number(
    saveResult?.data?.error_code ??
    saveResult?.extra?.error_code ??
    0
  )

  if (!errorCode) {
    return
  }

  const description = String(
    saveResult?.extra?.description ||
    saveResult?.data?.description ||
    DOUYIN_COMMON_ERROR.OTHER_EXCEPTION.description
  ).trim()
  const subDescription = String(
    saveResult?.extra?.sub_description ||
    saveResult?.extra?.subDescription ||
    ''
  ).trim()
  const finalDescription = subDescription
    ? `${description}: ${subDescription}`
    : description

  throw createDouyinBusinessError(
    DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
    finalDescription,
    finalDescription
  )
}

/**
 * 组装本地套餐同步抖音所需请求体。
 *
 * @param {Object} params 参数对象。
 * @param {number} params.localRatePlanId 本地套餐 ID。
 * @param {string} [params.accountId] 抖音商家账号 ID。
 * @param {string} [params.poiId] 抖音酒店 ID。
 * @param {string} [params.mode] 商品模式。
 * @param {Object} [params.modeConfig] 商品模式配置。
 * @returns {Promise<Object>} 请求体与上下文。
 */
async function buildDouyinProductPayload({
  localRatePlanId,
  accountId,
  poiId,
  mode = 'meal',
  modeConfig = {},
}) {
  const normalizedLocalRatePlanId = normalizeLocalRatePlanId(localRatePlanId)
  if (!normalizedLocalRatePlanId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_LOCAL_RATE_PLAN_ID)
  }

  const localProduct = await findLocalRatePlanDetails(normalizedLocalRatePlanId)
  if (!localProduct) {
    throw createDouyinBusinessError(
      DOUYIN_RATE_PLAN_ERROR.LOCAL_RATE_PLAN_NOT_FOUND,
      `Local rate plan not found: ${normalizedLocalRatePlanId}`
    )
  }

  if (!localProduct.douyin_room_id || !localProduct.physical_room_id) {
    throw createDouyinBusinessError(
      DOUYIN_RATE_PLAN_ERROR.RATE_PLAN_ROOM_NOT_MAPPED,
      `Local rate plan room type is not mapped: ${normalizedLocalRatePlanId}`
    )
  }

  const normalizedAccountId = resolveAccountId(accountId || localProduct.account_id)
  if (!normalizedAccountId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_ACCOUNT_ID)
  }

  const normalizedPoiId = resolveDouyinPoiId(localProduct, poiId)
  if (!normalizedPoiId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_POI_ID)
  }

  const normalizedMode = resolveModeSuffix(mode)
  const ratePlanItem = buildDouyinRatePlanItem({
    localProduct,
    mode: normalizedMode,
    modeConfig,
  })

  return {
    payload: {
      account_id: normalizedAccountId,
      rate_plan: {
        hotel_id: normalizedPoiId,
        rooms: [{
          room_id: localProduct.douyin_room_id,
          rate_plans: [ratePlanItem],
        }],
      },
    },
    localProduct,
    ratePlanItem,
    mode: normalizedMode,
    accountId: normalizedAccountId,
    poiId: normalizedPoiId,
  }
}

/**
 * 同步本地套餐到抖音，并写入统一渠道映射表。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 同步结果。
 */
async function syncProductToDouyin(params) {
  const {
    payload,
    localProduct,
    ratePlanItem,
    mode,
    accountId,
    poiId,
  } = await buildDouyinProductPayload(params)

  const saveResult = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/rateplan/save/',
    withAccountId: false,
    data: payload,
  })

  assertRatePlanSaveResult(saveResult)

  const mappedRatePlan = resolveRatePlanMapItem(saveResult, ratePlanItem.out_rate_plan_id)
  const mergedRatePlanList = mergeRatePlanList(localProduct, {
    ...mappedRatePlan,
    local_rate_plan_id: localProduct.id,
    rate_plan_name: ratePlanItem.rate_plan_name,
    active: ratePlanItem.active,
    mode,
  })
  const rawPayload = {
    ...(localProduct.raw_payload || {}),
    rate_plan_list: mergedRatePlanList,
  }

  const savedRoom = await upsertPhysicalRoom({
    accountId,
    roomId: localProduct.douyin_room_id,
    roomName: localProduct.physical_room_name || localProduct.douyin_room_name,
    status: localProduct.physical_status,
    auditMessage: localProduct.audit_message,
    ratePlanList: mergedRatePlanList,
    rawPayload,
  })

  const savedMapping = await upsertChannelMapping({
    localTargetType: RATE_PLAN_TARGET_TYPE,
    localTargetId: localProduct.id,
    channelCode: DOUYIN_CHANNEL_CODE,
    channelItemId: mappedRatePlan.rate_plan_id,
    syncStatus: 1,
    channelConfig: {
      accountId,
      poiId,
      roomId: localProduct.douyin_room_id,
      outRatePlanId: mappedRatePlan.out_rate_plan_id,
      ratePlanName: ratePlanItem.rate_plan_name,
      mode,
    },
  })

  return {
    action: 'synced',
    mode,
    payload,
    saveResult,
    ratePlan: mappedRatePlan,
    savedRoom,
    savedMapping,
  }
}

module.exports = {
  DOUYIN_CHANNEL_CODE,
  RATE_PLAN_TARGET_TYPE,
  assertRatePlanSaveResult,
  buildDouyinProductPayload,
  buildDouyinRatePlanItem,
  normalizeLocalRatePlanId,
  resolveDouyinPoiId,
  resolveRatePlanActive,
  syncProductToDouyin,
}
