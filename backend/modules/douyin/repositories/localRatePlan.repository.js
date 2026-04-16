"use strict";

const postgreDB = require('../../../database/postgreDB/pg')

/**
 * 查询本地套餐及其已绑定的抖音物理房型。
 *
 * 当前项目还没有独立 hotel 表，酒店 ID 只能来自请求参数、
 * 环境变量或已同步物理房型的 raw_payload，因此这里不强行联表酒店。
 *
 * @param {number} localRatePlanId 本地套餐 ID。
 * @returns {Promise<Object|null>} 套餐详情。
 */
async function findLocalRatePlanDetails(localRatePlanId) {
  const sql = `
    SELECT
      rp.id,
      rp.room_id,
      rp.name,
      rp.base_price,
      rp.status,
      r.room_number,
      r.type_code,
      r.is_closed AS room_is_closed,
      rt.type_name,
      rt.is_closed AS room_type_is_closed,
      mapping.douyin_room_id,
      mapping.douyin_room_name,
      physical.account_id,
      physical.room_id AS physical_room_id,
      physical.room_name AS physical_room_name,
      physical.status AS physical_status,
      physical.audit_message,
      physical.rate_plan_list,
      physical.raw_payload,
      physical.raw_payload->>'hotel_id' AS raw_hotel_id,
      physical.raw_payload->>'hotelId' AS raw_hotel_id_camel,
      physical.raw_payload->>'poi_id' AS raw_poi_id,
      physical.raw_payload->>'poiId' AS raw_poi_id_camel
    FROM rate_plans AS rp
    INNER JOIN rooms AS r
      ON r.room_id = rp.room_id
    INNER JOIN room_types AS rt
      ON rt.type_code = r.type_code
    LEFT JOIN douyin_room_type_mapping AS mapping
      ON mapping.local_room_type = r.type_code
    LEFT JOIN douyin_physical_rooms AS physical
      ON physical.room_id = mapping.douyin_room_id
    WHERE rp.id = $1
    LIMIT 1
  `

  const result = await postgreDB.query(sql, [localRatePlanId])
  return result.rows[0] || null
}

module.exports = {
  findLocalRatePlanDetails,
}
