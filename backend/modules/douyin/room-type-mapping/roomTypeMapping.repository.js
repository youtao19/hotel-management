const { query, getClient } = require('../../../database/postgreDB/pg');

async function runQuery(runner, sql, params) {
  if (runner) {
    return runner.query(sql, params);
  }
  return query(sql, params);
}

async function listLocalRoomTypesWithMappings(runner = null) {
  const result = await runQuery(
    runner,
    `
      SELECT
        rt.type_code,
        rt.type_name,
        rt.base_price,
        drm.douyin_room_id,
        drm.douyin_room_name,
        drm.updated_at AS mapping_updated_at,
        dpr.room_id AS cached_room_id,
        dpr.room_name AS cached_room_name,
        dpr.status AS douyin_room_status,
        dpr.raw_payload ->> 'active' AS douyin_room_active
      FROM room_types rt
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.local_room_type = rt.type_code
      LEFT JOIN douyin_physical_rooms dpr
        ON dpr.room_id = drm.douyin_room_id
      ORDER BY rt.type_code
    `
  );
  return result.rows;
}

async function listDouyinRoomsWithBindings(runner = null) {
  const result = await runQuery(
    runner,
    `
      SELECT
        dpr.room_id,
        dpr.room_name,
        dpr.status,
        dpr.raw_payload ->> 'active' AS active,
        dpr.account_id,
        COALESCE(
          dpr.raw_payload ->> 'hotel_id',
          dpr.raw_payload ->> 'poi_id',
          dpr.raw_payload ->> 'hotelId',
          dpr.raw_payload ->> 'poiId',
          dpr.raw_payload -> 'hotel' ->> 'hotel_id'
        ) AS hotel_id,
        drm.local_room_type AS bound_local_room_type,
        rt.type_name AS bound_local_room_type_name,
        to_char(dpr.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM douyin_physical_rooms dpr
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.douyin_room_id = dpr.room_id
      LEFT JOIN room_types rt
        ON rt.type_code = drm.local_room_type
      ORDER BY dpr.room_name NULLS LAST, dpr.room_id
    `
  );
  return result.rows;
}

async function listExistingLocalRoomTypes(localTypes, runner = null) {
  const result = await runQuery(
    runner,
    'SELECT type_code FROM room_types WHERE type_code = ANY($1)',
    [localTypes]
  );
  return result.rows.map((row) => row.type_code);
}

async function listExistingDouyinRoomIds(douyinRoomIds, runner = null) {
  const result = await runQuery(
    runner,
    'SELECT room_id FROM douyin_physical_rooms WHERE room_id = ANY($1)',
    [douyinRoomIds]
  );
  return result.rows.map((row) => row.room_id);
}

async function listMappingsByDouyinRoomIds(douyinRoomIds, runner = null) {
  const result = await runQuery(
    runner,
    'SELECT local_room_type, douyin_room_id FROM douyin_room_type_mapping WHERE douyin_room_id = ANY($1)',
    [douyinRoomIds]
  );
  return result.rows;
}

async function deleteMappingsByLocalRoomTypes(localTypes, runner) {
  return runner.query('DELETE FROM douyin_room_type_mapping WHERE local_room_type = ANY($1)', [localTypes]);
}

async function findDouyinRoomById(douyinRoomId, runner = null) {
  const result = await runQuery(
    runner,
    'SELECT room_name FROM douyin_physical_rooms WHERE room_id = $1',
    [douyinRoomId]
  );
  return result.rows[0] || null;
}

async function insertMapping(mapping, douyinRoomName, runner) {
  return runner.query(
    `
      INSERT INTO douyin_room_type_mapping
        (douyin_room_id, douyin_room_name, local_room_type)
      VALUES ($1, $2, $3)
    `,
    [mapping.douyinRoomId, douyinRoomName, mapping.localRoomType]
  );
}

async function deleteMappingByLocalRoomType(localRoomType) {
  const result = await query(
    'DELETE FROM douyin_room_type_mapping WHERE local_room_type = $1 RETURNING *',
    [localRoomType]
  );
  return result.rows[0] || null;
}

module.exports = {
  deleteMappingByLocalRoomType,
  deleteMappingsByLocalRoomTypes,
  findDouyinRoomById,
  getClient,
  insertMapping,
  listDouyinRoomsWithBindings,
  listExistingDouyinRoomIds,
  listExistingLocalRoomTypes,
  listLocalRoomTypesWithMappings,
  listMappingsByDouyinRoomIds
};
