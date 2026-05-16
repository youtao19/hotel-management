const db = require('../../../database/postgreDB/pg');

async function upsertPhysicalRoom(room, context, resolved) {
  return db.query(
    `
      INSERT INTO douyin_physical_rooms
        (account_id, room_id, room_name, status, audit_message, rate_plan_list, raw_payload)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '[]'::jsonb), $7)
      ON CONFLICT (room_id)
      DO UPDATE SET
        account_id = EXCLUDED.account_id,
        room_name = EXCLUDED.room_name,
        status = EXCLUDED.status,
        audit_message = EXCLUDED.audit_message,
        rate_plan_list = COALESCE($6::jsonb, douyin_physical_rooms.rate_plan_list),
        raw_payload = EXCLUDED.raw_payload,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      context.accountId,
      resolved.roomId,
      resolved.roomName,
      resolved.status,
      room.audit_message || room.audit_msg || null,
      resolved.nextRatePlanList,
      JSON.stringify(resolved.rawPayload)
    ]
  );
}

module.exports = {
  upsertPhysicalRoom
};
