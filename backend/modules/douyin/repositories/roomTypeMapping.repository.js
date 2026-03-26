const postgreDB = require('../../../database/postgreDB/pg')

async function findLocalRoomTypeByDouyinRoomId(douyinRoomId) {
  const sql = `
    SELECT local_room_type
    FROM douyin_room_type_mapping
    WHERE douyin_room_id = $1
    LIMIT 1
  `
  const result = await postgreDB.query(sql, [douyinRoomId])
  return result.rows[0]?.local_room_type || null
}

/**
 * 查询抖音房型映射列表，并附带本地房型名称。
 *
 * @returns {Promise<Object[]>} 映射列表。
 */
async function listRoomTypeMappings() {
  const sql = `
    SELECT
      mapping.id,
      mapping.douyin_room_id,
      mapping.douyin_room_name,
      mapping.local_room_type,
      rt.type_name AS local_room_type_name,
      room.account_id,
      room.status AS douyin_room_status,
      mapping.created_at,
      mapping.updated_at
    FROM douyin_room_type_mapping AS mapping
    LEFT JOIN room_types AS rt
      ON rt.type_code = mapping.local_room_type
    LEFT JOIN douyin_physical_rooms AS room
      ON room.room_id = mapping.douyin_room_id
    ORDER BY mapping.updated_at DESC, mapping.id DESC
  `

  const result = await postgreDB.query(sql)
  return result.rows
}

async function upsertRoomTypeMapping({
  douyinRoomId,
  douyinRoomName,
  localRoomType,
  client,
}) {
  // 允许复用外层事务 client；未传时默认走全局连接池。
  const queryRunner = client || postgreDB

  const sql = `
    INSERT INTO douyin_room_type_mapping (
      douyin_room_id,
      douyin_room_name,
      local_room_type
    ) VALUES ($1, $2, $3)
    ON CONFLICT (douyin_room_id)
    DO UPDATE SET
      douyin_room_name = EXCLUDED.douyin_room_name,
      local_room_type = EXCLUDED.local_room_type,
      updated_at = NOW()
    RETURNING *
  `

  const result = await queryRunner.query(sql, [
    douyinRoomId,
    douyinRoomName,
    localRoomType,
  ])

  return result.rows[0]
}

module.exports = {
  findLocalRoomTypeByDouyinRoomId,
  listRoomTypeMappings,
  upsertRoomTypeMapping,
}
