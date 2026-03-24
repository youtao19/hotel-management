const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { DOUYIN_RATE_PLAN_ERROR } = require('../constants/errorCodes')
const {
  findPhysicalRoomByRoomId,
  updatePhysicalRoomRatePlanList,
} = require('../repositories/physicalRoom.repository')
const { createDouyinBusinessError } = require('../utils/douyinError')
const { findLocalRoomTypeInfo, resolveAccountId } = require('./physicalRoomCreate.service')
const { buildBaseRatePlanItem, resolveModeSuffix } = require('./ratePlanCreate.service')

/**
 * 在物理房型中查找目标售卖房型映射。
 *
 * @param {Object} physicalRoom 物理房型记录。
 * @param {string} ratePlanId 抖音售卖房型 ID。
 * @returns {Object|null} 售卖房型映射。
 */
function findRatePlanMapping(physicalRoom, ratePlanId) {
  const ratePlanList = Array.isArray(physicalRoom?.rate_plan_list)
    ? physicalRoom.rate_plan_list
    : []

  return ratePlanList.find((item) => {
    const currentRatePlanId = String(
      item?.rate_plan_id ||
      item?.id ||
      ''
    ).trim()

    return currentRatePlanId === ratePlanId
  }) || null
}

/**
 * 从售卖房型映射中推断商品模式。
 *
 * @param {Object} ratePlanMapping 售卖房型映射。
 * @returns {string} 商品模式。
 */
function resolveModeFromRatePlanMapping(ratePlanMapping = {}) {
  const mode = String(ratePlanMapping.mode || '').trim().toLowerCase()
  if (mode) {
    return resolveModeSuffix(mode)
  }

  const outRatePlanId = String(ratePlanMapping.out_rate_plan_id || '').trim()
  const suffix = outRatePlanId.split('_').pop()
  return resolveModeSuffix(suffix)
}

/**
 * 构建抖音商品上下架更新请求体。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.roomId 抖音物理房型 ID。
 * @param {string} params.ratePlanId 抖音售卖房型 ID。
 * @param {boolean} params.active 上下架状态。
 * @param {string} [params.accountId] 抖音商家账号 ID。
 * @returns {Promise<Object>} 请求体和上下文。
 */
async function buildDouyinRatePlanStatusPayload({
  roomId,
  ratePlanId,
  active,
  accountId,
}) {
  const normalizedRoomId = String(roomId || '').trim()
  const normalizedRatePlanId = String(ratePlanId || '').trim()
  const normalizedAccountId = resolveAccountId(accountId)

  if (!normalizedAccountId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_ACCOUNT_ID, 'Missing Douyin account_id')
  }

  if (!normalizedRoomId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.MISSING_ROOM_ID, 'Missing Douyin room_id')
  }

  if (!normalizedRatePlanId) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.RATE_PLAN_ID_MISSING, 'Missing Douyin rate_plan_id')
  }

  if (typeof active !== 'boolean') {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.INVALID_ACTIVE, 'Invalid active flag')
  }

  const physicalRoom = await findPhysicalRoomByRoomId(normalizedRoomId)
  if (!physicalRoom) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.PHYSICAL_ROOM_NOT_FOUND, `Physical room not found: ${normalizedRoomId}`)
  }

  const ratePlanMapping = findRatePlanMapping(physicalRoom, normalizedRatePlanId)
  if (!ratePlanMapping) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.RATE_PLAN_NOT_FOUND, `Rate plan not found: ${normalizedRatePlanId}`)
  }

  const localRoomType = String(
    physicalRoom?.raw_payload?.out_room_id ||
    ''
  ).trim()
  const localRoomTypeInfo = await findLocalRoomTypeInfo(localRoomType)
  if (!localRoomTypeInfo) {
    throw createDouyinBusinessError(DOUYIN_RATE_PLAN_ERROR.LOCAL_ROOM_TYPE_NOT_FOUND, `Local room type not found: ${localRoomType}`)
  }

  const mode = resolveModeFromRatePlanMapping(ratePlanMapping)
  const ratePlanItem = buildBaseRatePlanItem({
    localRoomTypeInfo,
    localRoomType,
    mode,
  })

  ratePlanItem.rate_plan_id = normalizedRatePlanId
  ratePlanItem.out_rate_plan_id = String(
    ratePlanMapping.out_rate_plan_id ||
    ratePlanItem.out_rate_plan_id
  ).trim()
  ratePlanItem.rate_plan_name = String(
    ratePlanMapping.rate_plan_name ||
    ratePlanItem.rate_plan_name
  ).trim()
  ratePlanItem.active = active

  return {
    payload: {
      account_id: normalizedAccountId,
      rate_plan: {
        hotel_id: String(
          physicalRoom?.raw_payload?.hotel_id ||
          physicalRoom?.raw_payload?.hotelId ||
          ''
        ).trim(),
        rooms: [{
          room_id: normalizedRoomId,
          rate_plans: [ratePlanItem],
        }],
      },
    },
    physicalRoom,
    ratePlanMapping,
    ratePlanItem,
  }
}

/**
 * 更新本地售卖房型状态。
 *
 * @param {Object} params 参数对象。
 * @param {Object} params.physicalRoom 物理房型记录。
 * @param {Object} params.ratePlanItem 最新售卖房型。
 * @returns {Promise<Object|null>} 更新后的物理房型记录。
 */
async function saveRatePlanStatusToLocal({
  physicalRoom,
  ratePlanItem,
}) {
  const currentRatePlanList = Array.isArray(physicalRoom?.rate_plan_list)
    ? physicalRoom.rate_plan_list
    : []
  const nextRatePlanList = currentRatePlanList.map((item) => {
    const currentRatePlanId = String(item?.rate_plan_id || item?.id || '').trim()
    if (currentRatePlanId !== ratePlanItem.rate_plan_id) {
      return item
    }

    return {
      ...item,
      active: ratePlanItem.active,
    }
  })
  const rawPayload = {
    ...(physicalRoom.raw_payload || {}),
    rate_plan_list: nextRatePlanList,
  }

  return updatePhysicalRoomRatePlanList({
    roomId: physicalRoom.room_id,
    ratePlanList: nextRatePlanList,
    rawPayload,
  })
}

/**
 * 更新抖音商品上下架状态。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 更新结果。
 */
async function toggleDouyinRatePlanActive({
  roomId,
  ratePlanId,
  active,
  accountId,
}) {
  const {
    payload,
    physicalRoom,
    ratePlanItem,
  } = await buildDouyinRatePlanStatusPayload({
    roomId,
    ratePlanId,
    active,
    accountId,
  })

  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/rateplan/save/',
    withAccountId: false,
    data: payload,
  })

  const errorCode = result?.data?.error_code ?? result?.extra?.error_code ?? null
  const status = errorCode === 0 || errorCode === null ? 'updated' : 'failed'
  let savedRoom = null

  if (status === 'updated') {
    savedRoom = await saveRatePlanStatusToLocal({
      physicalRoom,
      ratePlanItem,
    })
  }

  return {
    action: active ? 'online' : 'offline',
    status,
    payload,
    result,
    savedRoom,
  }
}

module.exports = {
  buildDouyinRatePlanStatusPayload,
  findRatePlanMapping,
  resolveModeFromRatePlanMapping,
  saveRatePlanStatusToLocal,
  toggleDouyinRatePlanActive,
}
