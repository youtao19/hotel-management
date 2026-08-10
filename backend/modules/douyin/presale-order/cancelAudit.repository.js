"use strict";

const { query } = require('../../../database/postgreDB/pg');

/** 查询指定取消编号的人工审核记录。 */
async function findByCancelId(cancelId, client) {
  const queryRunner = client || { query };
  const result = await queryRunner.query(
    `SELECT *
     FROM douyin_presale_cancel_audits
     WHERE cancel_id = $1
     LIMIT 1`,
    [cancelId]
  );
  return result.rows[0] || null;
}

/** 写入待人工审核的取消申请，并以 cancel_id 抵御抖音重试。 */
async function insertPending(audit, client) {
  const result = await client.query(
    `INSERT INTO douyin_presale_cancel_audits (
       cancel_id, biz_type, presale_order_id, booking_order_id, ota_order_id, order_out_id,
       cancel_type, after_sale_type, refund_type, request_log_id, request_payload, audit_status
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11::jsonb, 'PENDING'
     ) ON CONFLICT (cancel_id) DO NOTHING
     RETURNING *`,
    [
      audit.cancelId, audit.bizType, audit.presaleOrderId, audit.bookingOrderId, audit.douyinOrderId, audit.localOrderId || null,
      audit.cancelType, audit.afterSaleType, audit.refundType, audit.logId || null, JSON.stringify(audit.rawPayload)
    ]
  );
  return result.rows[0] || null;
}

/** 返回后台人工审核需要的取消申请列表。 */
async function listAudits(status) {
  const result = await query(
    `SELECT id, cancel_id, biz_type, ota_order_id, order_out_id, cancel_type, after_sale_type, refund_type,
            request_log_id, audit_status, audit_result, audit_reason, reviewer_name, reviewed_at,
            callback_log_id, callback_error, callback_at, created_at, updated_at
     FROM douyin_presale_cancel_audits
     WHERE ($1::text IS NULL OR audit_status = $1)
     ORDER BY created_at DESC`,
    [status || null]
  );
  return result.rows;
}

/** 锁定待审核记录并保存人工结论，防止两个员工重复回传。 */
async function markCallbackPending(cancelId, decision, reviewer, client) {
  const result = await client.query(
    `UPDATE douyin_presale_cancel_audits
     SET audit_status = 'CALLBACK_PENDING',
         audit_result = $2,
         audit_reason = $3,
         reviewer_account_id = $4,
         reviewer_name = $5,
         reviewed_at = CURRENT_TIMESTAMP,
         callback_error = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE cancel_id = $1
       AND audit_status IN ('PENDING', 'CALLBACK_FAILED')
       AND (audit_result IS NULL OR audit_result = $2)
     RETURNING *`,
    [cancelId, decision.result, decision.reason || null, reviewer.id || null, reviewer.name || null]
  );
  return result.rows[0] || null;
}

/** 保存抖音审核回传成功结果。 */
async function markCallbackSucceeded(cancelId, response, logId, client) {
  const result = await client.query(
    `UPDATE douyin_presale_cancel_audits
     SET audit_status = CASE WHEN audit_result = 1 THEN 'APPROVED' ELSE 'REJECTED' END,
         callback_log_id = $2,
         callback_response = $3::jsonb,
         callback_error = NULL,
         callback_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE cancel_id = $1
       AND audit_status = 'CALLBACK_PENDING'
     RETURNING *`,
    [cancelId, logId || null, JSON.stringify(response || {})]
  );
  return result.rows[0] || null;
}

/** 保存抖音审核回传失败原因，允许员工用同一结论重新回传。 */
async function markCallbackFailed(cancelId, errorMessage, logId, response) {
  await query(
    `UPDATE douyin_presale_cancel_audits
     SET audit_status = 'CALLBACK_FAILED',
         callback_log_id = $2,
         callback_response = $3::jsonb,
         callback_error = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE cancel_id = $1
       AND audit_status = 'CALLBACK_PENDING'`,
    [cancelId, logId || null, JSON.stringify(response || {}), errorMessage]
  );
}

module.exports = {
  findByCancelId,
  insertPending,
  listAudits,
  markCallbackPending,
  markCallbackSucceeded,
  markCallbackFailed
};
