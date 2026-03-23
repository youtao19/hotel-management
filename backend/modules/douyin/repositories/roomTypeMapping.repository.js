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

async function upsertRoomTypeMapping({
  douyinRoomId,
  douyinRoomName,
  localRoomType,
}) {
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

  const result = await postgreDB.query(sql, [
    douyinRoomId,
    douyinRoomName,
    localRoomType,
  ])

  return result.rows[0]
}

module.exports = {
  findLocalRoomTypeByDouyinRoomId,
  upsertRoomTypeMapping,
}
