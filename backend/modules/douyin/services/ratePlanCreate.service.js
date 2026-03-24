const { douyinConfig } = require('../../../appSettings/douyin.config')
const {
  DOUYIN_COMMON_ERROR,
  DOUYIN_RATE_PLAN_ERROR,
} = require('../constants/errorCodes')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const {
  findPhysicalRoomByRoomId,
  upsertPhysicalRoom,
} = require('../repositories/physicalRoom.repository')
const {
  createDouyinBusinessError,
} = require('../utils/douyinError')
const {
  findLocalRoomTypeInfo,
  resolveAccountId,
} = require('./physicalRoomCreate.service')

const RATE_PLAN_MODE = Object.freeze({
  MEAL: 'meal',
  CANCEL: 'cancel',
  STAY: 'stay',
  BOOKING: 'booking',
})

/**
 * 生成模式后缀，避免同一房型下重复创建相同外部售卖房型编码。
 *
 * @param {string} mode 商品模式。
 * @returns {string} 外部编码后缀。
 */
function resolveModeSuffix(mode) {
  const normalizedMode = String(mode || RATE_PLAN_MODE.MEAL).trim().toLowerCase()
  return Object.values(RATE_PLAN_MODE).includes(normalizedMode)
    ? normalizedMode
    : RATE_PLAN_MODE.MEAL
}

/**
 * 基于模式生成商品名称后缀。
 *
 * @param {string} mode 商品模式。
 * @returns {string} 名称后缀。
 */
function resolveModeLabel(mode) {
  const suffix = resolveModeSuffix(mode)
  const labels = {
    meal: '餐食信息模式',
    cancel: '取消政策模式',
    stay: '连住模式',
    booking: '预定限制模式',
  }

  return labels[suffix] || labels.meal
}

/**
 * 查询当前物理房型是否已存在相同外部售卖房型编码。
 *
 * @param {Object} physicalRoom 物理房型记录。
 * @param {string} outRatePlanId 外部售卖房型编码。
 * @returns {boolean} 存在时返回 true。
 */
function hasRatePlanMapping(physicalRoom, outRatePlanId) {
  const ratePlanList = Array.isArray(physicalRoom?.rate_plan_list)
    ? physicalRoom.rate_plan_list
    : []

  return ratePlanList.some((item) => {
    const currentOutRatePlanId = String(
      item?.out_rate_plan_id ||
      item?.outRatePlanId ||
      ''
    ).trim()

    return currentOutRatePlanId === outRatePlanId
  })
}

/**
 * 将商品模式配置中的整数值转成正整数。
 *
 * @param {unknown} value 原始值。
 * @returns {number|null} 转换后的整数或 null。
 */
function normalizeInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const normalizedValue = Number(value)
  if (!Number.isInteger(normalizedValue)) {
    return null
  }

  return normalizedValue
}

/**
 * 构建餐食信息模式配置。
 *
 * @param {Object} localRoomTypeInfo 本地房型信息。
 * @param {Object} extraConfig 模式附加配置。
 * @returns {Object} 模式配置。
 */
function buildMealModeConfig(localRoomTypeInfo, extraConfig = {}) {
  const normalizedMealCount = normalizeInteger(extraConfig.mealCount)
  const mealCount = normalizedMealCount === null ? 1 : normalizedMealCount

  if (mealCount < 1 || mealCount > 10) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.INVALID_MEAL_COUNT)
  }

  return {
    meals: [{
      type: 1,
      num: mealCount,
    }],
  }
}

/**
 * 构建取消政策模式配置。
 *
 * @param {Object} localRoomTypeInfo 本地房型信息。
 * @param {Object} extraConfig 模式附加配置。
 * @returns {Object} 模式配置。
 */
function buildCancelModeConfig(localRoomTypeInfo, extraConfig = {}) {
  const freeCancelHours = normalizeInteger(extraConfig.freeCancelHoursBeforeCheckIn)

  if (freeCancelHours === null) {
    return {
      cancel_rules: [{
        cancel_type: 1,
      }],
    }
  }

  if (freeCancelHours < 0 || freeCancelHours > 365 * 24) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.INVALID_CANCEL_HOURS)
  }

  return {
    cancel_rules: [{
      cancel_type: 2,
      cancel_time_type: 2,
      cancel_offset_time: {
        day: Math.floor(freeCancelHours / 24),
        hour: freeCancelHours % 24,
      },
      cut_type: 1,
      cut_value: 0,
    }],
  }
}

/**
 * 构建连住模式配置。
 *
 * @param {Object} localRoomTypeInfo 本地房型信息。
 * @param {Object} extraConfig 模式附加配置。
 * @returns {Object} 模式配置。
 */
function buildStayModeConfig(localRoomTypeInfo, extraConfig = {}) {
  const normalizedMinStayNights = normalizeInteger(extraConfig.minStayNights)
  const normalizedMaxStayNights = normalizeInteger(extraConfig.maxStayNights)
  const minStayNights = normalizedMinStayNights === null ? 2 : normalizedMinStayNights
  const maxStayNights = normalizedMaxStayNights === null ? minStayNights : normalizedMaxStayNights

  if (minStayNights < 1 || maxStayNights < minStayNights || maxStayNights > 30) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.INVALID_STAY_RANGE)
  }

  return {
    stay_rules: {
      min_los: minStayNights,
      max_los: maxStayNights,
    },
  }
}

/**
 * 构建预定限制模式配置。
 *
 * @param {Object} localRoomTypeInfo 本地房型信息。
 * @param {Object} extraConfig 模式附加配置。
 * @returns {Object} 模式配置。
 */
function buildBookingModeConfig(localRoomTypeInfo, extraConfig = {}) {
  const normalizedMinAdvanceDays = normalizeInteger(extraConfig.advanceBookingDaysMin)
  const normalizedMaxAdvanceDays = normalizeInteger(extraConfig.advanceBookingDaysMax)
  const minAdvanceDays = normalizedMinAdvanceDays === null ? 1 : normalizedMinAdvanceDays
  const maxAdvanceDays = normalizedMaxAdvanceDays === null ? 30 : normalizedMaxAdvanceDays

  if (
    minAdvanceDays < 0 ||
    maxAdvanceDays < minAdvanceDays ||
    maxAdvanceDays > 365
  ) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.INVALID_BOOKING_RANGE)
  }

  return {
    book_rules: {
      min_advance_time: {
        day: minAdvanceDays,
      },
      max_advance_time: {
        day: maxAdvanceDays,
      },
    },
  }
}

/**
 * 根据商品模式构建附加配置。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.mode 商品模式。
 * @param {Object} params.localRoomTypeInfo 本地房型信息。
 * @param {Object} params.extraConfig 模式附加配置。
 * @returns {Object} 模式配置。
 */
function buildRatePlanModeConfig({
  mode,
  localRoomTypeInfo,
  extraConfig,
}) {
  if (extraConfig !== undefined && (typeof extraConfig !== 'object' || Array.isArray(extraConfig))) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.INVALID_MODE_CONFIG)
  }

  const normalizedConfig = extraConfig || {}

  switch (resolveModeSuffix(mode)) {
    case RATE_PLAN_MODE.CANCEL:
      return buildCancelModeConfig(localRoomTypeInfo, normalizedConfig)
    case RATE_PLAN_MODE.STAY:
      return buildStayModeConfig(localRoomTypeInfo, normalizedConfig)
    case RATE_PLAN_MODE.BOOKING:
      return buildBookingModeConfig(localRoomTypeInfo, normalizedConfig)
    case RATE_PLAN_MODE.MEAL:
    default:
      return buildMealModeConfig(localRoomTypeInfo, normalizedConfig)
  }
}

/**
 * 合并商品基础字段与模式字段。
 *
 * @param {Object} ratePlan 商品基础字段。
 * @param {Object} modeConfig 模式字段。
 * @returns {Object} 合并后的商品数据。
 */
function mergeRatePlanConfig(ratePlan, modeConfig) {
  return {
    ...ratePlan,
    ...modeConfig,
  }
}

/**
 * 构建售卖房型基础项。
 *
 * @param {Object} params 参数对象。
 * @param {Object} params.localRoomTypeInfo 本地房型信息。
 * @param {string} params.localRoomType 本地房型编码。
 * @param {string} params.mode 商品模式。
 * @returns {Object} 售卖房型对象。
 */
function buildBaseRatePlanItem({
  localRoomTypeInfo,
  localRoomType,
  mode,
  modeConfig,
}) {
  const modeSuffix = resolveModeSuffix(mode)
  const modeLabel = resolveModeLabel(mode)
  const ratePlanName = `${String(localRoomTypeInfo.type_name || localRoomType).trim()}-${modeLabel}`
  const outRatePlanId = `${localRoomType}_${modeSuffix}`
  const ratePlan = {
    rate_plan_name: ratePlanName,
    out_rate_plan_id: outRatePlanId,
    currency: 'CNY',
    active: localRoomTypeInfo.is_closed !== true,
    confirm_immediately: false,
    sales_type: 1,
    settle_type: 1,
  }
  const resolvedModeConfig = buildRatePlanModeConfig({
    mode: modeSuffix,
    localRoomTypeInfo,
    extraConfig: modeConfig,
  })

  return mergeRatePlanConfig(ratePlan, resolvedModeConfig)
}

/**
 * 组装抖音售卖房型创建请求体。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.localRoomType 本地房型编码。
 * @param {string} params.poiId 抖音酒店 ID。
 * @param {string} params.roomId 抖音物理房型 ID。
 * @param {string} [params.accountId] 抖音商家账号 ID。
 * @param {string} [params.mode] 商品模式。
 * @returns {Promise<Object>} 请求体和附加元信息。
 */
async function buildDouyinRatePlanPayload({
  localRoomType,
  poiId,
  roomId,
  accountId,
  mode,
  modeConfig,
}) {
  const normalizedLocalRoomType = String(localRoomType || '').trim()
  const normalizedPoiId = String(poiId || '').trim()
  const normalizedRoomId = String(roomId || '').trim()
  const normalizedAccountId = resolveAccountId(accountId || douyinConfig.accountId)
  const normalizedMode = resolveModeSuffix(mode)

  if (!normalizedAccountId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_ACCOUNT_ID, 'Missing Douyin account_id')
  }

  if (!normalizedPoiId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_POI_ID, 'Missing Douyin hotel_id')
  }

  if (!normalizedRoomId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_ROOM_ID, 'Missing Douyin room_id')
  }

  const localRoomTypeInfo = await findLocalRoomTypeInfo(normalizedLocalRoomType)
  if (!localRoomTypeInfo) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.LOCAL_ROOM_TYPE_NOT_FOUND, `Local room type not found: ${normalizedLocalRoomType}`)
  }

  const physicalRoom = await findPhysicalRoomByRoomId(normalizedRoomId)
  if (!physicalRoom) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.PHYSICAL_ROOM_NOT_FOUND, `Physical room not found: ${normalizedRoomId}`)
  }

  const ratePlanItem = buildBaseRatePlanItem({
    localRoomTypeInfo,
    localRoomType: normalizedLocalRoomType,
    mode: normalizedMode,
    modeConfig,
  })

  if (hasRatePlanMapping(physicalRoom, ratePlanItem.out_rate_plan_id)) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.DUPLICATE_RATE_PLAN, `Rate plan already exists for out_rate_plan_id: ${ratePlanItem.out_rate_plan_id}`)
  }

  return {
    payload: {
      account_id: normalizedAccountId,
      rate_plan: {
        hotel_id: normalizedPoiId,
        rooms: [{
          room_id: normalizedRoomId,
          rate_plans: [ratePlanItem],
        }],
      },
    },
    physicalRoom,
    ratePlanItem,
    localRoomTypeInfo,
    mode: normalizedMode,
  }
}

/**
 * 从抖音返回中提取当前创建出来的售卖房型。
 *
 * @param {Object} saveResult 抖音接口响应。
 * @param {string} outRatePlanId 外部售卖房型编码。
 * @returns {Object} 售卖房型映射结果。
 */
function resolveRatePlanMapItem(saveResult = {}, outRatePlanId) {
  const ratePlanMap = Array.isArray(saveResult?.data?.rate_plan_map)
    ? saveResult.data.rate_plan_map
    : []

  const matchedItem = ratePlanMap.find((item) => {
    const currentOutRatePlanId = String(item?.out_rate_plan_id || '').trim()
    return currentOutRatePlanId === outRatePlanId
  }) || ratePlanMap[0]

  const ratePlanId = String(matchedItem?.rate_plan_id || '').trim()

  if (!ratePlanId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.RATE_PLAN_ID_MISSING)
  }

  return {
    rate_plan_id: ratePlanId,
    out_rate_plan_id: String(matchedItem?.out_rate_plan_id || outRatePlanId).trim(),
    code: matchedItem?.code ?? null,
    message: matchedItem?.message ?? null,
  }
}

/**
 * 合并物理房型中的售卖房型列表。
 *
 * @param {Object} physicalRoom 物理房型记录。
 * @param {Object} mappedRatePlan 售卖房型映射。
 * @returns {Object[]} 合并后的列表。
 */
function mergeRatePlanList(physicalRoom, mappedRatePlan) {
  const currentRatePlanList = Array.isArray(physicalRoom?.rate_plan_list)
    ? [...physicalRoom.rate_plan_list]
    : []
  const nextRatePlanList = currentRatePlanList.filter((item) => {
    return String(item?.out_rate_plan_id || '').trim() !== mappedRatePlan.out_rate_plan_id
  })

  nextRatePlanList.push(mappedRatePlan)
  return nextRatePlanList
}

/**
 * 创建抖音售卖房型并回写到物理房型记录。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 创建结果。
 */
async function createDouyinRatePlan(params) {
  const {
    payload,
    physicalRoom,
    ratePlanItem,
    localRoomTypeInfo,
    mode,
  } = await buildDouyinRatePlanPayload(params)

  const saveResult = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/rateplan/save/',
    withAccountId: false,
    data: payload,
  })

  const mappedRatePlan = resolveRatePlanMapItem(saveResult, ratePlanItem.out_rate_plan_id)
  const mergedRatePlanList = mergeRatePlanList(physicalRoom, {
    ...mappedRatePlan,
    rate_plan_name: ratePlanItem.rate_plan_name,
    mode,
  })
  const rawPayload = {
    ...(physicalRoom.raw_payload || {}),
    rate_plan_list: mergedRatePlanList,
  }

  const savedRoom = await upsertPhysicalRoom({
    accountId: physicalRoom.account_id,
    roomId: physicalRoom.room_id,
    roomName: physicalRoom.room_name,
    status: physicalRoom.status,
    auditMessage: physicalRoom.audit_message,
    ratePlanList: mergedRatePlanList,
    rawPayload,
  })

  return {
    action: 'created',
    mode,
    payload,
    saveResult,
    ratePlan: mappedRatePlan,
    savedRoom,
    localRoomTypeInfo,
  }
}

module.exports = {
  RATE_PLAN_MODE,
  buildBookingModeConfig,
  buildBaseRatePlanItem,
  buildCancelModeConfig,
  buildDouyinRatePlanPayload,
  buildMealModeConfig,
  buildRatePlanModeConfig,
  buildStayModeConfig,
  createDouyinRatePlan,
  hasRatePlanMapping,
  mergeRatePlanConfig,
  mergeRatePlanList,
  normalizeInteger,
  resolveModeLabel,
  resolveModeSuffix,
  resolveRatePlanMapItem,
}
