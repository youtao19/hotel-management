"use strict";

const postgreDB = require('../../../database/postgreDB/pg')

const DOUYIN_CHANNEL_CODE = 'DOUYIN'
const RATE_PLAN_TARGET_TYPE = 'RATE_PLAN'

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

/**
 * 查询本地套餐列表及抖音同步事实。
 *
 * @returns {Promise<Object[]>} 套餐列表行。
 */
async function listLocalRatePlansWithDouyinStatus() {
  const sql = `
    SELECT
      rp.id,
      rp.room_id,
      rp.name,
      rp.base_price,
      rp.status,
      r.room_number,
      r.type_code,
      r.status AS room_status,
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
      channel.channel_item_id AS douyin_rate_plan_id,
      channel.sync_status,
      channel.updated_at AS sync_updated_at,
      (r.room_id IS NOT NULL) AS local_room_exists,
      (rt.type_code IS NOT NULL) AS local_room_type_exists
    FROM rate_plans AS rp
    LEFT JOIN rooms AS r
      ON r.room_id = rp.room_id
    LEFT JOIN room_types AS rt
      ON rt.type_code = r.type_code
    LEFT JOIN douyin_room_type_mapping AS mapping
      ON mapping.local_room_type = r.type_code
    LEFT JOIN douyin_physical_rooms AS physical
      ON physical.room_id = mapping.douyin_room_id
    LEFT JOIN ota_channel_mappings AS channel
      ON channel.local_target_type = $1
     AND channel.local_target_id = rp.id
     AND channel.channel_code = $2
    ORDER BY rp.id ASC
  `

  const result = await postgreDB.query(sql, [
    RATE_PLAN_TARGET_TYPE,
    DOUYIN_CHANNEL_CODE,
  ])
  return result.rows
}

module.exports = {
  findLocalRatePlanDetails,
  listLocalRatePlansWithDouyinStatus,
}
