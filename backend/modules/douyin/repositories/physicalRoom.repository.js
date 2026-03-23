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

module.exports = {
  upsertPhysicalRoom,
  findAllPhysicalRooms,
}
