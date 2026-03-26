const postgreDB = require('../../../database/postgreDB/pg')
const { douyinConfig } = require('../../../appSettings/douyin.config')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const {
  DOUYIN_COMMON_ERROR,
  DOUYIN_PHYSICAL_ROOM_ERROR,
} = require('../constants/errorCodes')
const {
  findPhysicalRoomByLocalRoomType,
  upsertPhysicalRoom,
} = require('../repositories/physicalRoom.repository')
const { upsertRoomTypeMapping } = require('../repositories/roomTypeMapping.repository')
const { queryDouyinPhysicalRoomDetail } = require('./physicalRoom.service')
const {
  createDouyinBusinessError,
} = require('../utils/douyinError')

const DEFAULT_MAX_OCCUPANCY = 2

/**
 * 查询本地房型基础信息。
 *
 * @param {string} localRoomType 本地房型编码。
 * @returns {Promise<Object|null>} 本地房型。
 */
async function findLocalRoomTypeInfo(localRoomType) {
  const result = await postgreDB.query(
    `SELECT type_code, type_name, description, is_closed
     FROM room_types
     WHERE type_code = $1
     LIMIT 1`,
    [localRoomType]
  )

  return result.rows[0] || null
}

/**
 * 统计本地房型下的物理房间数量。
 *
 * @param {string} localRoomType 本地房型编码。
 * @returns {Promise<number>} 房间数量。
 */
async function countLocalRoomsByType(localRoomType) {
  const result = await postgreDB.query(
    `SELECT COUNT(*)::int AS total
     FROM rooms
     WHERE type_code = $1`,
    [localRoomType]
  )

  return Number(result.rows[0]?.total || 0)
}

/**
 * 解析当前应使用的抖音账号 ID。
 *
 * @param {string} [accountId] 外部传入的商家账号 ID。
 * @returns {string} 标准化后的账号 ID。
 */
function resolveAccountId(accountId) {
  return String(accountId || douyinConfig.accountId || '').trim()
}

/**
 * 将本地描述转换成抖音描述数组。
 *
 * @param {string} description 本地描述。
 * @returns {string[]} 描述列表。
 */
function buildDescriptions(description) {
  return String(description || '')
    .split('\n')
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

/**
 * 组装抖音物理房型最小请求体。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.localRoomType 本地房型编码。
 * @param {string} [params.accountId] 抖音商家账号 ID。
 * @param {string} params.poiId 抖音酒店 ID。
 * @param {string} params.categoryId 抖音类目 ID。
 * @param {Array} params.images 房型图片列表。
 * @returns {Promise<Object>} 请求体。
 */
async function buildDouyinPhysicalRoomPayload({
  localRoomType,
  accountId,
  poiId,
  categoryId,
  images,
}) {
  const normalizedLocalRoomType = String(localRoomType || '').trim()
  const normalizedPoiId = String(poiId || '').trim()
  const normalizedAccountId = resolveAccountId(accountId)
  const normalizedCategoryId = String(categoryId || '').trim()

  if (!normalizedAccountId) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.MISSING_ACCOUNT_ID, 'Missing Douyin account_id')
  }

  if (!normalizedPoiId) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.MISSING_POI_ID, 'Missing Douyin poi_id')
  }

  if (!normalizedCategoryId) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.MISSING_CATEGORY_ID, 'Missing Douyin category_id')
  }

  const normalizedImages = buildPhysicalRoomImages(images)

  const localRoomTypeInfo = await findLocalRoomTypeInfo(normalizedLocalRoomType)
  if (!localRoomTypeInfo) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.LOCAL_ROOM_TYPE_NOT_FOUND, `Local room type not found: ${normalizedLocalRoomType}`)
  }

  const localRoomCount = await countLocalRoomsByType(normalizedLocalRoomType)
  if (localRoomCount <= 0) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.NO_LOCAL_ROOMS, `No local rooms found for room type: ${normalizedLocalRoomType}`)
  }

  const descriptions = buildDescriptions(localRoomTypeInfo.description)
  const roomInfo = {
    out_room_id: normalizedLocalRoomType,
    cn_name: String(localRoomTypeInfo.type_name || normalizedLocalRoomType).trim(),
    category_id: normalizedCategoryId,
    images: normalizedImages,
    max_occupancy: DEFAULT_MAX_OCCUPANCY,
    room_num: localRoomCount,
    active: localRoomTypeInfo.is_closed !== true,
  }

  if (descriptions.length > 0) {
    roomInfo.descriptions = descriptions
  }

  return {
    account_id: normalizedAccountId,
    poi_id: normalizedPoiId,
    room_info: roomInfo,
  }
}

/**
 * 组装抖音物理房型图片列表。
 *
 * @param {Array} images 原始图片参数。
 * @returns {Array<{image_url:string}>} 标准化后的图片列表。
 */
function buildPhysicalRoomImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.MISSING_IMAGES, 'Missing physical room images')
  }

  const normalizedImages = images
    .map((item) => {
      const imageUrl = String(
        item?.imageUrl ||
        item?.image_url ||
        ''
      ).trim()

      if (!imageUrl) {
        return null
      }

      return {
        image_url: imageUrl,
      }
    })
    .filter(Boolean)

  if (!normalizedImages.length) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.INVALID_IMAGES, 'Invalid physical room images')
  }

  return normalizedImages
}

/**
 * 校验物理房型保存接口结果，优先透出抖音原始错误描述。
 *
 * @param {Object} saveResult 保存接口响应。
 * @returns {void}
 */
function assertPhysicalRoomSaveResult(saveResult = {}) {
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
  const subDescription = String(saveResult?.extra?.sub_description || '').trim()
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
 * 从抖音保存结果中提取房型 ID。
 *
 * @param {Object} saveResult 保存接口响应。
 * @returns {string} 房型 ID。
 */
function resolveSavedRoomId(saveResult = {}) {
  const roomId = String(
    saveResult?.data?.room_id ||
    saveResult?.data?.duplicate_room_id ||
    ''
  ).trim()

  if (!roomId) {
    throw createDouyinBusinessError(DOUYIN_COMMON_ERROR.OTHER_EXCEPTION, 'Douyin physical room save response missing room_id')
  }

  return roomId
}

/**
 * 从物理房型详情结果中提取单个房型。
 *
 * @param {Object} detailResult 查询详情结果。
 * @param {string} roomId 房型 ID。
 * @returns {Object|null} 房型详情。
 */
function resolvePhysicalRoomDetail(detailResult = {}, roomId) {
  const roomList =
    detailResult?.data?.room_list ||
    detailResult?.data?.data?.room_list ||
    []

  return roomList.find((item) => String(item?.room_id || '').trim() === roomId) || null
}

/**
 * 创建抖音物理房型并同步回本地。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.localRoomType 本地房型编码。
 * @param {string} [params.accountId] 抖音商家账号 ID。
 * @param {string} params.poiId 抖音酒店 ID。
 * @param {string} params.categoryId 抖音类目 ID。
 * @param {Array} params.images 房型图片列表。
 * @returns {Promise<Object>} 创建结果。
 */
async function createDouyinPhysicalRoom({
  localRoomType,
  accountId,
  poiId,
  categoryId,
  images,
}) {
  const normalizedLocalRoomType = String(localRoomType || '').trim()
  const existingPhysicalRoom = await findPhysicalRoomByLocalRoomType(normalizedLocalRoomType)

  if (existingPhysicalRoom) {
    throw createDouyinBusinessError(DOUYIN_PHYSICAL_ROOM_ERROR.DUPLICATE_MAPPING, `Physical room mapping already exists for local room type: ${normalizedLocalRoomType}`)
  }

  const payload = await buildDouyinPhysicalRoomPayload({
    localRoomType: normalizedLocalRoomType,
    accountId,
    poiId,
    categoryId,
    images,
  })

  const saveResult = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/physical_room/save/',
    withAccountId: false,
    data: payload,
  })

  assertPhysicalRoomSaveResult(saveResult)
  const roomId = resolveSavedRoomId(saveResult)
  const detailResult = await queryDouyinPhysicalRoomDetail({
    accountId: payload.account_id,
    roomIds: [roomId],
    needRatePlan: true,
  })

  const detailRoom = resolvePhysicalRoomDetail(detailResult, roomId)
  const rawPayload = detailRoom || {
    room_id: roomId,
    cn_name: payload.room_info.cn_name,
    hotel_id: payload.poi_id,
    out_room_id: payload.room_info.out_room_id,
    room_num: payload.room_info.room_num,
    active: payload.room_info.active,
  }

  const savedRoom = await upsertPhysicalRoom({
    accountId: payload.account_id,
    roomId,
    roomName: String(rawPayload.cn_name || payload.room_info.cn_name || normalizedLocalRoomType).trim(),
    status: rawPayload.status ?? null,
    auditMessage: rawPayload.audit_message || null,
    ratePlanList: rawPayload.rate_plan_list || [],
    rawPayload,
  })

  const savedMapping = await upsertRoomTypeMapping({
    douyinRoomId: roomId,
    douyinRoomName: savedRoom.room_name,
    localRoomType: normalizedLocalRoomType,
  })

  return {
    roomId,
    payload,
    saveResult,
    detailResult,
    savedRoom,
    savedMapping,
    action: 'created',
  }
}

module.exports = {
  DEFAULT_MAX_OCCUPANCY,
  assertPhysicalRoomSaveResult,
  buildDescriptions,
  buildPhysicalRoomImages,
  buildDouyinPhysicalRoomPayload,
  countLocalRoomsByType,
  createDouyinPhysicalRoom,
  findLocalRoomTypeInfo,
  resolveAccountId,
  resolvePhysicalRoomDetail,
  resolveSavedRoomId,
}
