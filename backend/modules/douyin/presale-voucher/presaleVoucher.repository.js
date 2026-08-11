"use strict";

const { query } = require('../../../database/postgreDB/pg');

/**
 * 查询预售券时同时带出抖音预定商品 ID，避免同步阶段再按不稳定名称关联。
 */
async function findById(id) {
  const result = await query(
    `
      SELECT
        pv.id, pv.rate_plan_id, pv.name, pv.original_amount, pv.actual_amount, pv.inventory_is_limited,
        pv.inventory_count, pv.each_person_max, pv.each_person_each_order_max, pv.cancel_booking_type,
        to_char(pv.sale_start_at, 'YYYY-MM-DD HH24:MI') AS sale_start_at,
        to_char(pv.sale_end_at, 'YYYY-MM-DD HH24:MI') AS sale_end_at,
        to_char(pv.book_start_date, 'YYYY-MM-DD') AS book_start_date,
        to_char(pv.book_end_date, 'YYYY-MM-DD') AS book_end_date, pv.image_urls, pv.douyin_voucher_id,
        pv.audit_status, pv.audit_message, pv.sync_status, pv.last_sync_log_id,
        pv.product_status, to_char(pv.product_status_updated_at, 'YYYY-MM-DD HH24:MI:SS') AS product_status_updated_at,
        pv.last_product_status_log_id, pv.last_product_status_error,
        to_char(pv.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(pv.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
        rp.name AS rate_plan_name,
        ocm.channel_item_id AS douyin_rate_plan_id
      FROM douyin_presale_vouchers pv
      JOIN rate_plans rp ON rp.id = pv.rate_plan_id
      LEFT JOIN ota_channel_mappings ocm
        ON ocm.local_target_type = 'RATE_PLAN'
       AND ocm.local_target_id = pv.rate_plan_id
       AND ocm.channel_code = 'DOUYIN'
      WHERE pv.id = $1
    `,
    [id]
  );
  return result.rows[0] || null;
}

/** 预售券列表保留审核与同步信息，供运营判断是否需要修改重提。 */
async function list() {
  const result = await query(
    `
      SELECT
        pv.id, pv.rate_plan_id, pv.name, pv.original_amount, pv.actual_amount, pv.inventory_is_limited,
        pv.inventory_count, pv.each_person_max, pv.each_person_each_order_max, pv.cancel_booking_type,
        to_char(pv.sale_start_at, 'YYYY-MM-DD HH24:MI') AS sale_start_at,
        to_char(pv.sale_end_at, 'YYYY-MM-DD HH24:MI') AS sale_end_at,
        to_char(pv.book_start_date, 'YYYY-MM-DD') AS book_start_date,
        to_char(pv.book_end_date, 'YYYY-MM-DD') AS book_end_date, pv.image_urls, pv.douyin_voucher_id,
        pv.audit_status, pv.audit_message, pv.sync_status, pv.last_sync_log_id,
        pv.product_status, to_char(pv.product_status_updated_at, 'YYYY-MM-DD HH24:MI:SS') AS product_status_updated_at,
        pv.last_product_status_log_id, pv.last_product_status_error,
        to_char(pv.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(pv.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
        rp.name AS rate_plan_name,
        ocm.channel_item_id AS douyin_rate_plan_id
      FROM douyin_presale_vouchers pv
      JOIN rate_plans rp ON rp.id = pv.rate_plan_id
      LEFT JOIN ota_channel_mappings ocm
        ON ocm.local_target_type = 'RATE_PLAN'
       AND ocm.local_target_id = pv.rate_plan_id
       AND ocm.channel_code = 'DOUYIN'
      ORDER BY pv.id DESC
    `
  );
  return result.rows;
}

/** 先保存本地草稿生成稳定out_id，再调用远端，避免重试创建多张券。 */
async function create(data) {
  const result = await query(
    `
      INSERT INTO douyin_presale_vouchers
        (rate_plan_id, name, original_amount, actual_amount, inventory_is_limited, inventory_count,
         each_person_max, each_person_each_order_max, cancel_booking_type, sale_start_at, sale_end_at, book_start_date, book_end_date, image_urls)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      RETURNING id
    `,
    [
      data.ratePlanId, data.name, data.originalAmount, data.actualAmount, data.inventoryIsLimited,
      data.inventoryCount, data.eachPersonMax, data.eachPersonEachOrderMax, data.cancelBookingType, data.saleStartAt,
      data.saleEndAt, data.bookStartDate, data.bookEndDate, JSON.stringify(data.imageUrls)
    ]
  );
  return findById(result.rows[0].id);
}

/** 更新本地可编辑字段，绑定套餐由路由层禁止变更以保持抖音关联稳定。 */
async function update(id, data) {
  await query(
    `
      UPDATE douyin_presale_vouchers
      SET name = $1, original_amount = $2, actual_amount = $3, inventory_is_limited = $4,
          inventory_count = $5, each_person_max = $6, each_person_each_order_max = $7,
          cancel_booking_type = $8, sale_start_at = $9, sale_end_at = $10, book_start_date = $11,
          book_end_date = $12, image_urls = $13::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
    `,
    [
      data.name, data.originalAmount, data.actualAmount, data.inventoryIsLimited, data.inventoryCount,
      data.eachPersonMax, data.eachPersonEachOrderMax, data.cancelBookingType, data.saleStartAt,
      data.saleEndAt, data.bookStartDate, data.bookEndDate, JSON.stringify(data.imageUrls), id
    ]
  );
  return findById(id);
}

/** 记录最近一次远端同步结论，失败时也保留logid便于定位。 */
async function markSyncResult(id, { douyinVoucherId, syncStatus, logId, auditStatus, auditMessage }) {
  await query(
    `
      UPDATE douyin_presale_vouchers
      SET douyin_voucher_id = COALESCE($1, douyin_voucher_id), sync_status = $2,
          last_sync_log_id = $3, audit_status = COALESCE($4, audit_status),
          audit_message = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `,
    [douyinVoucherId || null, syncStatus, logId || null, auditStatus || null, auditMessage || null, id]
  );
  return findById(id);
}

/** 保存最近一次商品状态操作结果，失败不覆盖已确认的商品状态。 */
async function markProductStatusResult(id, { productStatus, logId, errorMessage }) {
  await query(
    `
      UPDATE douyin_presale_vouchers
      SET product_status = COALESCE($1, product_status),
          product_status_updated_at = CASE WHEN $1 IS NULL THEN product_status_updated_at ELSE CURRENT_TIMESTAMP END,
          last_product_status_log_id = $2,
          last_product_status_error = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `,
    [productStatus || null, logId || null, errorMessage || null, id]
  );
  return findById(id);
}

/** 抖音审核回调仅信任系统生成的voucher-<id>，不接受任意外部ID更新本地券。 */
async function markAuditResultByOutId(outId, auditStatus, auditMessage) {
  const id = Number(String(outId).replace(/^voucher-/, ''));
  if (!Number.isInteger(id) || id <= 0) return null;
  await query(
    `UPDATE douyin_presale_vouchers
     SET audit_status = $1, audit_message = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [auditStatus, auditMessage || null, id]
  );
  return findById(id);
}

module.exports = { findById, list, create, update, markSyncResult, markProductStatusResult, markAuditResultByOutId };
