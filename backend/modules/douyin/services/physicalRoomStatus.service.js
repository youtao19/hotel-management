const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { DOUYIN_PHYSICAL_ROOM_ERROR } = require('../constants/errorCodes')
const {
  findPhysicalRoomByRoomId,
  updatePhysicalRoomStatus,
} = require('../repositories/physicalRoom.repository')
const { createDouyinBusinessError } = require('../utils/douyinError')
const {
  DEFAULT_MAX_OCCUPANCY,
  resolveAccountId,
} = require('./physicalRoomCreate.service')

const PHYSICAL_ROOM_STATUS = Object.freeze({
  ACTIVE: 1,
  INACTIVE: 0,
})

/**
 * 构建抖音物理房型上下架更新请求体。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.roomId 抖音物理房型 ID。
 * @param {boolean} params.active 上下架状态。
 * @param {string} [params.accountId] 抖音商家账号 ID。
 * @returns {Promise<Object>} 请求体和上下文。
 */
async function buildDouyinPhysicalRoomStatusPayload({
  roomId,
  active,
  accountId,
}) {
  const normalizedRoomId = String(roomId || '').trim()
  const normalizedAccountId = resolveAccountId(accountId)

  if (!normalizedAccountId) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.MISSING_ACCOUNT_ID, 'Missing Douyin account_id')
  }

  if (!normalizedRoomId) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.MISSING_ROOM_ID, 'Missing Douyin room_id')
  }

  if (typeof active !== 'boolean') {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.INVALID_ACTIVE, 'Invalid active flag')
  }

  const physicalRoom = await findPhysicalRoomByRoomId(normalizedRoomId)
  if (!physicalRoom) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.PHYSICAL_ROOM_NOT_FOUND, `Physical room not found: ${normalizedRoomId}`)
  }

  const rawPayload = physicalRoom.raw_payload || {}
  const roomInfo = {
    room_id: normalizedRoomId,
    out_room_id: String(rawPayload.out_room_id || normalizedRoomId).trim(),
    cn_name: String(rawPayload.cn_name || physicalRoom.room_name || normalizedRoomId).trim(),
    max_occupancy: Number(rawPayload.max_occupancy || DEFAULT_MAX_OCCUPANCY),
    room_num: Number(rawPayload.room_num || 1),
    active,
  }
  const descriptions = Array.isArray(rawPayload.descriptions)
    ? rawPayload.descriptions.filter(Boolean)
    : []

  if (descriptions.length > 0) {
    roomInfo.descriptions = descriptions
  }

  return {
    payload: {
      account_id: normalizedAccountId,
      poi_id: String(
        rawPayload.poi_id ||
        rawPayload.hotel_id ||
        ''
      ).trim(),
      room_info: roomInfo,
    },
    physicalRoom,
  }
}

/**
 * 更新本地物理房型状态。
 *
 * @param {Object} params 参数对象。
 * @param {Object} params.physicalRoom 物理房型记录。
 * @param {boolean} params.active 上下架状态。
 * @returns {Promise<Object|null>} 更新后的记录。
 */
async function savePhysicalRoomStatusToLocal({
  physicalRoom,
  active,
}) {
  const rawPayload = {
    ...(physicalRoom.raw_payload || {}),
    active,
  }

  return updatePhysicalRoomStatus({
    roomId: physicalRoom.room_id,
    status: active ? PHYSICAL_ROOM_STATUS.ACTIVE : PHYSICAL_ROOM_STATUS.INACTIVE,
    rawPayload,
  })
}

/**
 * 更新抖音物理房型上下架状态。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<Object>} 更新结果。
 */
async function toggleDouyinPhysicalRoomActive({
  roomId,
  active,
  accountId,
}) {
  const {
    payload,
    physicalRoom,
  } = await buildDouyinPhysicalRoomStatusPayload({
    roomId,
    active,
    accountId,
  })

  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/physical_room/save/',
    withAccountId: false,
    data: payload,
  })

  const errorCode = result?.data?.error_code ?? result?.extra?.error_code ?? null
  const status = errorCode === 0 || errorCode === null ? 'updated' : 'failed'
  let savedRoom = null

  if (status === 'updated') {
    savedRoom = await savePhysicalRoomStatusToLocal({
      physicalRoom,
      active,
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
  PHYSICAL_ROOM_STATUS,
  buildDouyinPhysicalRoomStatusPayload,
  savePhysicalRoomStatusToLocal,
  toggleDouyinPhysicalRoomActive,
}
