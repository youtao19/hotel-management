"use strict";

const { query } = require('../../../database/postgreDB/pg');

/** 查询套餐的日历房规则。 */
async function findRuleByRatePlanId(ratePlanId) {
  const result = await query(`
    SELECT id, rate_plan_id,
      to_char(validity_start, 'YYYY-MM-DD') AS validity_start,
      to_char(validity_end, 'YYYY-MM-DD') AS validity_end,
      cancel_rule, breakfast_number, refund_type, status
    FROM douyin_calendar_room_rules WHERE rate_plan_id = $1
  `, [ratePlanId]);
  return result.rows[0] || null;
}

/** 保存套餐的日历房规则。 */
async function upsertRule(ratePlanId, rule) {
  const result = await query(`
    INSERT INTO douyin_calendar_room_rules
      (rate_plan_id, validity_start, validity_end, cancel_rule, breakfast_number, refund_type, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (rate_plan_id) DO UPDATE SET
      validity_start = EXCLUDED.validity_start,
      validity_end = EXCLUDED.validity_end,
      cancel_rule = EXCLUDED.cancel_rule,
      breakfast_number = EXCLUDED.breakfast_number,
      refund_type = EXCLUDED.refund_type,
      status = EXCLUDED.status,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `, [ratePlanId, rule.validityStart, rule.validityEnd, rule.cancelRule, rule.breakfastNumber, rule.refundType, rule.status]);
  return findRuleByRatePlanId(result.rows[0].rate_plan_id || ratePlanId);
}

/** 查询日历房同步所需数据。 */
async function findSyncContext(ratePlanId) {
  const result = await query(`
    SELECT rp.*, drm.douyin_room_id, dpr.room_id AS cached_room_id,
      dpr.account_id AS room_account_id, dpr.raw_payload AS room_payload,
      ocm.channel_item_id AS douyin_rate_plan_id, ocm.channel_config AS channel_config
    FROM rate_plans rp
    LEFT JOIN douyin_room_type_mapping drm ON drm.local_room_type = rp.room_type_code
    LEFT JOIN douyin_physical_rooms dpr ON dpr.room_id = drm.douyin_room_id
    LEFT JOIN ota_channel_mappings ocm
      ON ocm.local_target_type = 'RATE_PLAN'
      AND ocm.local_target_id = rp.id
      AND ocm.channel_code = 'DOUYIN'
    WHERE rp.id = $1
  `, [ratePlanId]);
  return result.rows[0] || null;
}

/** 保存套餐的按日价格。 */
async function upsertPrices(ratePlanId, prices) {
  const values = [];
  const placeholders = prices.map((price, index) => {
    const offset = index * 4;
    values.push(ratePlanId, price.stayDate, price.originalAmount, price.retailAmount);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  });

  await query(
    `
      INSERT INTO douyin_calendar_room_prices
        (rate_plan_id, stay_date, original_amount, retail_amount)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (rate_plan_id, stay_date) DO UPDATE SET
        original_amount = EXCLUDED.original_amount,
        retail_amount = EXCLUDED.retail_amount,
        updated_at = CURRENT_TIMESTAMP
    `,
    values
  );

  return findPrices(ratePlanId, prices[0].stayDate, prices[prices.length - 1].stayDate);
}

/** 查询套餐指定日期范围内的价格。 */
async function findPrices(ratePlanId, startDate, endDate) {
  const result = await query(
    `
      SELECT
        to_char(stay_date, 'YYYY-MM-DD') AS stay_date,
        original_amount,
        retail_amount,
        to_char(last_synced_at, 'YYYY-MM-DD HH24:MI:SS') AS last_synced_at
      FROM douyin_calendar_room_prices
      WHERE rate_plan_id = $1
        AND stay_date BETWEEN $2::date AND $3::date
      ORDER BY stay_date
    `,
    [ratePlanId, startDate, endDate]
  );
  return result.rows;
}

/** 标记一批日期的价格已同步。 */
async function markPricesSynced(ratePlanId, dates) {
  if (!dates.length) return;
  await query(
    `
      UPDATE douyin_calendar_room_prices
      SET last_synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE rate_plan_id = $1
        AND stay_date = ANY($2::date[])
    `,
    [ratePlanId, dates]
  );
}

module.exports = { findRuleByRatePlanId, upsertRule, findSyncContext, upsertPrices, findPrices, markPricesSynced };
