const postgreDB = require('../../../database/postgreDB/pg')
const { DOUYIN_COMMON_ERROR } = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')
const {
  listRoomTypeMappings,
  upsertRoomTypeMapping,
} = require('../repositories/roomTypeMapping.repository')

/**
 * 校验并规范化房型映射列表。
 *
 * @param {Array<Object>} mappings 原始映射数据。
 * @returns {Array<{douyinRoomId:string, douyinRoomName:string, localRoomType:string}>} 规范化映射。
 */
function normalizeRoomTypeMappings(mappings = []) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      'Mappings is empty',
      'mappings 至少需要一条数据'
    )
  }

  const normalizedMappings = mappings.map((item = {}) => {
    return {
      douyinRoomId: String(item.douyinRoomId || '').trim(),
      douyinRoomName: String(item.douyinRoomName || '').trim(),
      localRoomType: String(item.localRoomType || '').trim(),
    }
  })

  const duplicatedRoomIds = new Set()
  const roomIdSet = new Set()

  for (const item of normalizedMappings) {
    if (!item.douyinRoomId) {
      throw createDouyinBusinessError(
        DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
        'Missing douyinRoomId in mapping item',
        'douyinRoomId 不能为空'
      )
    }
    if (!item.localRoomType) {
      throw createDouyinBusinessError(
        DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
        `Missing localRoomType for roomId: ${item.douyinRoomId}`,
        `localRoomType 不能为空: ${item.douyinRoomId}`
      )
    }

    if (roomIdSet.has(item.douyinRoomId)) {
      duplicatedRoomIds.add(item.douyinRoomId)
    }
    roomIdSet.add(item.douyinRoomId)
  }

  if (duplicatedRoomIds.size > 0) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      `Duplicated douyinRoomId: ${Array.from(duplicatedRoomIds).join(',')}`,
      `douyinRoomId 重复: ${Array.from(duplicatedRoomIds).join(',')}`
    )
  }

  return normalizedMappings
}

/**
 * 查询本地房型是否存在。
 *
 * @param {string[]} typeCodes 本地房型编码列表。
 * @returns {Promise<Map<string, string>>} key 为 type_code，value 为 type_name。
 */
async function queryLocalRoomTypeNameMap(typeCodes = []) {
  if (!typeCodes.length) {
    return new Map()
  }

  const sql = `
    SELECT type_code, type_name
    FROM room_types
    WHERE type_code = ANY($1::text[])
  `
  const result = await postgreDB.query(sql, [typeCodes])

  const map = new Map()
  for (const row of result.rows) {
    map.set(row.type_code, row.type_name)
  }
  return map
}

/**
 * 查询抖音房型映射列表。
 *
 * @returns {Promise<Object[]>} 映射列表。
 */
async function listDouyinRoomTypeMappingsService() {
  return listRoomTypeMappings()
}

/**
 * 批量保存抖音房型映射。
 *
 * @param {Object} params 参数。
 * @param {Array<Object>} params.mappings 映射列表。
 * @returns {Promise<Object[]>} 保存后的映射列表。
 */
async function saveDouyinRoomTypeMappingsService({ mappings } = {}) {
  const normalizedMappings = normalizeRoomTypeMappings(mappings)

  const allLocalRoomTypes = Array.from(
    new Set(normalizedMappings.map((item) => item.localRoomType))
  )
  const localRoomTypeMap = await queryLocalRoomTypeNameMap(allLocalRoomTypes)
  const missingRoomTypes = allLocalRoomTypes.filter((typeCode) => !localRoomTypeMap.has(typeCode))

  if (missingRoomTypes.length > 0) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      `Local room type not found: ${missingRoomTypes.join(',')}`,
      `本地房型不存在: ${missingRoomTypes.join(',')}`
    )
  }

  let client = null
  const savedMappings = []
  try {
    client = await postgreDB.getClient()
    await client.query('BEGIN')

    // 逐条 UPSERT，保证同一个 douyinRoomId 可重复调用幂等更新。
    for (const item of normalizedMappings) {
      const saved = await upsertRoomTypeMapping({
        douyinRoomId: item.douyinRoomId,
        douyinRoomName: item.douyinRoomName,
        localRoomType: item.localRoomType,
        client,
      })

      savedMappings.push({
        ...saved,
        local_room_type_name: localRoomTypeMap.get(item.localRoomType) || null,
      })
    }

    await client.query('COMMIT')
    return savedMappings
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }
    throw error
  } finally {
    if (client) {
      client.release()
    }
  }
}

module.exports = {
  listDouyinRoomTypeMappingsService,
  normalizeRoomTypeMappings,
  queryLocalRoomTypeNameMap,
  saveDouyinRoomTypeMappingsService,
}
