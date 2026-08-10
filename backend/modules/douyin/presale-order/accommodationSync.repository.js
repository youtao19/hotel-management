"use strict";

const { query } = require('../../../database/postgreDB/pg');

/** 查询本地订单对应的抖音预售券预约单。 */
async function findBookingByLocalOrderId(localOrderId) {
  const result = await query(
    `SELECT id, order_id, ota_order_id, booking_status, confirm_status
     FROM douyin_presale_booking_orders
     WHERE order_id = $1
       AND biz_type = 2012
     LIMIT 1`,
    [localOrderId]
  );
  return result.rows[0] || null;
}

/** 查询预约单某种履约状态的最近同步结果。 */
async function findSyncByBookingOrderId(bookingOrderId, accommodationStatus) {
  const result = await query(
    `SELECT *
     FROM douyin_presale_booking_accommodation_syncs
     WHERE booking_order_id = $1
       AND accommodation_status = $2
     LIMIT 1`,
    [bookingOrderId, accommodationStatus]
  );
  return result.rows[0] || null;
}

/** 创建或重置未成功的履约同步记录。 */
async function startSyncAttempt(bookingOrderId, accommodationStatus) {
  const result = await query(
    `INSERT INTO douyin_presale_booking_accommodation_syncs (
       booking_order_id, accommodation_status, sync_status, attempt_count, last_attempt_at
     ) VALUES ($1, $2, 'PENDING', 1, CURRENT_TIMESTAMP)
     ON CONFLICT (booking_order_id, accommodation_status) DO UPDATE SET
       sync_status = 'PENDING',
       attempt_count = douyin_presale_booking_accommodation_syncs.attempt_count + 1,
       last_attempt_at = CURRENT_TIMESTAMP,
       douyin_log_id = NULL,
       error_code = NULL,
       error_description = NULL,
       response = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE douyin_presale_booking_accommodation_syncs.sync_status <> 'SUCCEEDED'
     RETURNING *`,
    [bookingOrderId, accommodationStatus]
  );
  return result.rows[0] || null;
}

/** 保存抖音确认接收的履约同步结果。 */
async function markSyncSucceeded(syncId, logId, response) {
  const result = await query(
    `UPDATE douyin_presale_booking_accommodation_syncs
     SET sync_status = 'SUCCEEDED',
         synced_at = CURRENT_TIMESTAMP,
         douyin_log_id = $2,
         error_code = NULL,
         error_description = NULL,
         response = $3::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [syncId, logId || null, JSON.stringify(response)]
  );
  return result.rows[0];
}

/** 保存抖音拒绝或网络异常导致的履约同步失败。 */
async function markSyncFailed(syncId, details) {
  const result = await query(
    `UPDATE douyin_presale_booking_accommodation_syncs
     SET sync_status = 'FAILED',
         douyin_log_id = $2,
         error_code = $3,
         error_description = $4,
         response = $5::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      syncId,
      details.logId || null,
      details.errorCode ?? null,
      details.errorDescription || null,
      details.response ? JSON.stringify(details.response) : null
    ]
  );
  return result.rows[0];
}

module.exports = {
  findBookingByLocalOrderId,
  findSyncByBookingOrderId,
  startSyncAttempt,
  markSyncSucceeded,
  markSyncFailed
};
