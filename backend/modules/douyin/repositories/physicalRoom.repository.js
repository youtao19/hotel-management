const postgreDB = require('../../../database/postgreDB/pg')

async function upsertPhysicalRoom(room) {
  const sql = `
    INSERT INTO douyin_physical_rooms (
      account_id,
      room_id,
      room_name,
      status,
      audit_message,
      rate_plan_list,
      raw_payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (room_id)
    DO UPDATE SET
      account_id = EXCLUDED.account_id,
      room_name = EXCLUDED.room_name,
      status = EXCLUDED.status,
      audit_message = EXCLUDED.audit_message,
      rate_plan_list = EXCLUDED.rate_plan_list,
      raw_payload = EXCLUDED.raw_payload,
      updated_at = NOW()
    RETURNING *
  `

  const values = [
    room.accountId,
    room.roomId,
    room.roomName,
    room.status,
    room.auditMessage,
    JSON.stringify(room.ratePlanList || []),
    JSON.stringify(room.rawPayload || {}),
  ]

  const result = await postgreDB.query(sql, values)
  return result.rows[0]
}

async function findAllPhysicalRooms() {
  const sql = `
    SELECT *
    FROM douyin_physical_rooms
    ORDER BY updated_at DESC, id DESC
  `
  const result = await postgreDB.query(sql)
  return result.rows
}

/**
 * 根据抖音售卖房型 ID 查询对应物理房型。
 *
 * @param {string} ratePlanId 抖音售卖房型 ID。
 * @returns {Promise<Object|null>} 查询到的物理房型；不存在时返回 null。
 */
async function findPhysicalRoomByRatePlanId(ratePlanId) {
  const sql = `
    SELECT *
    FROM douyin_physical_rooms
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(rate_plan_list, '[]'::jsonb)) AS item
      WHERE item->>'rate_plan_id' = $1
         OR item->>'id' = $1
    )
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `

  const result = await postgreDB.query(sql, [ratePlanId])
  return result.rows[0] || null
}

/**
 * 批量根据抖音售卖房型 ID 查询对应物理房型。
 *
 * @param {string[]} ratePlanIds 抖音售卖房型 ID 列表。
 * @returns {Promise<Object[]>} 物理房型列表。
 */
async function findPhysicalRoomsByRatePlanIds(ratePlanIds = []) {
  const normalizedRatePlanIds = Array.from(
    new Set(
      ratePlanIds
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )

  if (!normalizedRatePlanIds.length) {
    return []
  }

  const sql = `
    SELECT DISTINCT ON (item->>'rate_plan_id', item->>'id')
      room.*,
      item->>'rate_plan_id' AS matched_rate_plan_id,
      item->>'id' AS matched_rate_plan_id_fallback
    FROM douyin_physical_rooms AS room
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(room.rate_plan_list, '[]'::jsonb)) AS item
    WHERE item->>'rate_plan_id' = ANY($1::text[])
       OR item->>'id' = ANY($1::text[])
    ORDER BY item->>'rate_plan_id', item->>'id', room.updated_at DESC, room.id DESC
  `

  const result = await postgreDB.query(sql, [normalizedRatePlanIds])
  return result.rows
}

/**
 * 根据本地房型编码查询已关联的抖音物理房型。
 *
 * @param {string} localRoomType 本地房型编码。
 * @returns {Promise<Object|null>} 物理房型记录。
 */
async function findPhysicalRoomByLocalRoomType(localRoomType) {
  const sql = `
    SELECT room.*
    FROM douyin_physical_rooms AS room
    INNER JOIN douyin_room_type_mapping AS mapping
      ON mapping.douyin_room_id = room.room_id
    WHERE mapping.local_room_type = $1
    ORDER BY room.updated_at DESC, room.id DESC
    LIMIT 1
  `

  const result = await postgreDB.query(sql, [localRoomType])
  return result.rows[0] || null
}

/**
 * 根据抖音物理房型 ID 查询本地已同步记录。
 *
 * @param {string} roomId 抖音物理房型 ID。
 * @returns {Promise<Object|null>} 物理房型记录。
 */
async function findPhysicalRoomByRoomId(roomId) {
  const sql = `
    SELECT *
    FROM douyin_physical_rooms
    WHERE room_id = $1
    LIMIT 1
  `

  const result = await postgreDB.query(sql, [roomId])
  return result.rows[0] || null
}

/**
 * 回写物理房型中的售卖房型列表。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.roomId 抖音物理房型 ID。
 * @param {Object[]} params.ratePlanList 最新售卖房型列表。
 * @param {Object} params.rawPayload 最新原始载荷。
 * @returns {Promise<Object|null>} 更新后的物理房型记录。
 */
async function updatePhysicalRoomRatePlanList({
  roomId,
  ratePlanList,
  rawPayload,
}) {
  const sql = `
    UPDATE douyin_physical_rooms
    SET rate_plan_list = $2,
        raw_payload = $3,
        updated_at = NOW()
    WHERE room_id = $1
    RETURNING *
  `

  const result = await postgreDB.query(sql, [
    roomId,
    JSON.stringify(ratePlanList || []),
    JSON.stringify(rawPayload || {}),
  ])

  return result.rows[0] || null
}

module.exports = {
  upsertPhysicalRoom,
  findAllPhysicalRooms,
  findPhysicalRoomByRatePlanId,
  findPhysicalRoomsByRatePlanIds,
  findPhysicalRoomByLocalRoomType,
  findPhysicalRoomByRoomId,
  updatePhysicalRoomRatePlanList,
}
