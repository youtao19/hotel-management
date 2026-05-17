const db = require('../../../database/postgreDB/pg');

function getHotelIdSql() {
  return `
    COALESCE(
      dpr.raw_payload ->> 'hotel_id',
      dpr.raw_payload ->> 'poi_id',
      dpr.raw_payload ->> 'hotelId',
      dpr.raw_payload ->> 'poiId',
      dpr.raw_payload -> 'hotel' ->> 'hotel_id',
      ocm.channel_config ->> 'hotel_id',
      ocm.channel_config ->> 'poi_id'
    )
  `;
}

function getRatePlanSelectSql() {
  return `
    SELECT
      ocm.channel_item_id AS rate_plan_id,
      rp.id AS local_rate_plan_id,
      rp.room_type_code,
      rp.base_price,
      rp.currency,
      rp.status AS rate_plan_status,
      rt.is_closed AS room_type_closed,
      drm.douyin_room_id,
      dpr.room_id AS cached_douyin_room_id,
      dpr.status AS douyin_room_status,
      ${getHotelIdSql()} AS hotel_id
    FROM ota_channel_mappings ocm
    JOIN rate_plans rp
      ON rp.id = ocm.local_target_id
     AND ocm.local_target_type = 'RATE_PLAN'
    LEFT JOIN room_types rt
      ON rt.type_code = rp.room_type_code
    LEFT JOIN douyin_room_type_mapping drm
      ON drm.local_room_type = rp.room_type_code
    LEFT JOIN douyin_physical_rooms dpr
      ON dpr.room_id = drm.douyin_room_id
    WHERE ocm.channel_code = 'DOUYIN'
  `;
}

async function findRatePlansByDouyinIds(ratePlanIds) {
  if (!ratePlanIds.length) {
    return [];
  }

  const result = await db.query(
    `
      ${getRatePlanSelectSql()}
        AND ocm.channel_item_id = ANY($1)
    `,
    [ratePlanIds]
  );

  return result.rows;
}

async function findRatePlansByHotelIds(hotelIds) {
  if (!hotelIds.length) {
    return [];
  }

  const result = await db.query(
    `
      ${getRatePlanSelectSql()}
        AND ${getHotelIdSql()} = ANY($1)
      ORDER BY ocm.channel_item_id
    `,
    [hotelIds]
  );

  return result.rows;
}

async function findRatePlanByDouyinId(ratePlanId) {
  const result = await db.query(
    `
      ${getRatePlanSelectSql()}
        AND ocm.channel_item_id = $1
      LIMIT 1
    `,
    [ratePlanId]
  );

  return result.rows[0] || null;
}

async function getInventoryRowsByRoomTypes(roomTypeCodes, dates, activeOrderStatuses) {
  const typeCodes = [...new Set(roomTypeCodes.filter(Boolean))];
  if (!typeCodes.length || !dates.length) {
    return [];
  }

  const result = await db.query(
    `
      WITH target_dates AS (
        SELECT unnest($1::date[]) AS stay_date
      ),
      target_types AS (
        SELECT unnest($2::varchar[]) AS room_type_code
      )
      SELECT
        to_char(td.stay_date, 'YYYY-MM-DD') AS stay_date,
        tt.room_type_code,
        COUNT(DISTINCT r.room_number) AS total_rooms,
        COUNT(DISTINCT o.room_number) AS occupied_rooms
      FROM target_dates td
      CROSS JOIN target_types tt
      LEFT JOIN rooms r
        ON r.type_code = tt.room_type_code
       AND r.is_closed = FALSE
       AND r.status != 'repair'
      LEFT JOIN orders o
        ON o.room_number = r.room_number
       AND o.stay_date = td.stay_date
       AND o.status = ANY($3)
      GROUP BY td.stay_date, tt.room_type_code
    `,
    [dates, typeCodes, activeOrderStatuses]
  );

  return result.rows;
}

async function getInventoryRowsByRoomType(roomTypeCode, dates, activeOrderStatuses) {
  if (!roomTypeCode || !dates.length) {
    return [];
  }

  const result = await db.query(
    `
      WITH target_dates AS (
        SELECT unnest($1::date[]) AS stay_date
      )
      SELECT
        to_char(td.stay_date, 'YYYY-MM-DD') AS stay_date,
        COUNT(DISTINCT r.room_number) AS total_rooms,
        COUNT(DISTINCT o.room_number) AS occupied_rooms
      FROM target_dates td
      LEFT JOIN rooms r
        ON r.type_code = $2
       AND r.is_closed = FALSE
       AND r.status != 'repair'
      LEFT JOIN orders o
        ON o.room_number = r.room_number
       AND o.stay_date = td.stay_date
       AND o.status = ANY($3)
      GROUP BY td.stay_date
    `,
    [dates, roomTypeCode, activeOrderStatuses]
  );

  return result.rows;
}

async function findAriNotifyRatePlans(localRatePlanIds) {
  const result = await db.query(
    `
      SELECT
        rp.id AS local_rate_plan_id,
        ocm.channel_item_id AS douyin_rate_plan_id,
        COALESCE(
          ocm.channel_config ->> 'hotel_id',
          ocm.channel_config ->> 'poi_id',
          dpr.raw_payload ->> 'hotel_id',
          dpr.raw_payload ->> 'poi_id',
          dpr.raw_payload ->> 'hotelId',
          dpr.raw_payload ->> 'poiId',
          dpr.raw_payload -> 'hotel' ->> 'hotel_id'
        ) AS hotel_id
      FROM rate_plans rp
      LEFT JOIN ota_channel_mappings ocm
        ON ocm.local_target_type = 'RATE_PLAN'
       AND ocm.local_target_id = rp.id
       AND ocm.channel_code = 'DOUYIN'
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.local_room_type = rp.room_type_code
      LEFT JOIN douyin_physical_rooms dpr
        ON dpr.room_id = drm.douyin_room_id
      WHERE rp.id = ANY($1)
      ORDER BY array_position($1::int[], rp.id)
    `,
    [localRatePlanIds]
  );

  return result.rows;
}

module.exports = {
  findAriNotifyRatePlans,
  findRatePlanByDouyinId,
  findRatePlansByDouyinIds,
  findRatePlansByHotelIds,
  getInventoryRowsByRoomType,
  getInventoryRowsByRoomTypes
};
