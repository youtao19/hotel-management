const db = require('../../../database/postgreDB/pg');

async function findLocalProductDetails(id) {
  const result = await db.query(
    `
      SELECT
        rp.*,
        rt.type_name AS room_type_name,
        drm.douyin_room_id,
        drm.douyin_room_name,
        dpr.room_id AS douyin_cached_room_id,
        dpr.account_id AS douyin_account_id,
        dpr.raw_payload AS douyin_room_payload,
        dpr.rate_plan_list AS douyin_rate_plan_list,
        ocm.channel_item_id AS douyin_rate_plan_id
      FROM rate_plans rp
      LEFT JOIN room_types rt ON rp.room_type_code = rt.type_code
      LEFT JOIN douyin_room_type_mapping drm ON drm.local_room_type = rp.room_type_code
      LEFT JOIN douyin_physical_rooms dpr ON dpr.room_id = drm.douyin_room_id
      LEFT JOIN ota_channel_mappings ocm
        ON ocm.local_target_type = 'RATE_PLAN'
       AND ocm.local_target_id = rp.id
       AND ocm.channel_code = 'DOUYIN'
      WHERE rp.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updatePhysicalRoomRatePlanList(roomId, ratePlanList) {
  return db.query(
    `
      UPDATE douyin_physical_rooms
      SET rate_plan_list = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE room_id = $2
    `,
    [JSON.stringify(ratePlanList), roomId]
  );
}

module.exports = {
  findLocalProductDetails,
  updatePhysicalRoomRatePlanList
};
