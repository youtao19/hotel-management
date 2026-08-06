"use strict";

const { query } = require('../../../database/postgreDB/pg');

/** 查询抖音订单号对应的本地预售订单。 */
async function findByDouyinOrderId(douyinOrderId) {
  const result = await query(
    `SELECT id, order_id, ota_order_id, order_stage, douyin_log_id, cancel_id, cancel_status
     FROM douyin_presale_orders
     WHERE ota_order_id = $1
     LIMIT 1`,
    [douyinOrderId]
  );
  return result.rows[0] || null;
}

/** 查询本地订单号对应的抖音预售订单。 */
async function findByLocalOrderId(localOrderId) {
  const result = await query(
    `SELECT id, order_id, ota_order_id, order_stage, douyin_log_id, cancel_id, cancel_status
     FROM douyin_presale_orders
     WHERE order_id = $1
     LIMIT 1`,
    [localOrderId]
  );
  return result.rows[0] || null;
}

/** 查询抖音预售券主订单列表，供后台运营查看未预约券订单。 */
async function listOrders() {
  const result = await query(
    `SELECT
       po.order_id,
       po.ota_order_id,
       po.order_stage,
       po.pre_sale_coupon_id,
       po.voucher_count,
       po.total_amount,
       po.currency,
       po.douyin_log_id,
       to_char(po.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
       to_char(po.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
       pv.name AS voucher_name,
       rp.name AS rate_plan_name
     FROM douyin_presale_orders po
     LEFT JOIN douyin_presale_vouchers pv ON pv.douyin_voucher_id = po.pre_sale_coupon_id
     LEFT JOIN rate_plans rp ON rp.id = pv.rate_plan_id
     ORDER BY po.created_at DESC`
  );
  return result.rows;
}

/** 查询已同步的抖音预售券。 */
async function findVoucherByDouyinId(douyinVoucherId) {
  const result = await query(
    `SELECT id, douyin_voucher_id
     FROM douyin_presale_vouchers
     WHERE douyin_voucher_id = $1
     LIMIT 1`,
    [douyinVoucherId]
  );
  return result.rows[0] || null;
}

/** 写入一笔抖音预售券主订单。 */
async function insertOrder(order) {
  const result = await query(
    `INSERT INTO douyin_presale_orders (
       order_id, ota_order_id, account_id, biz_type, order_stage,
       pre_sale_coupon_id, rate_plan_id, contact_name, contact_mobile,
       voucher_count, each_coupon_amount, total_amount, currency,
       check_in_date, check_out_date, douyin_log_id, raw_payload, mapped_payload
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12, $13,
       $14::date, $15::date, $16, $17::jsonb, $18::jsonb
     ) RETURNING order_id, ota_order_id`,
    [
      order.localOrderId, order.douyinOrderId, order.accountId, order.bizType, 'CREATED',
      order.voucherId, order.ratePlanId, order.contactName, order.contactPhone,
      order.voucherCount, order.eachCouponAmount, order.totalAmount, order.currency,
      order.checkInDate, order.checkOutDate, order.logId, JSON.stringify(order.rawPayload), JSON.stringify(order.mappedPayload)
    ]
  );
  return result.rows[0];
}

/** 记录抖音预售券订单的支付成功通知。 */
async function markPaid(orderId, paymentNotice, rawPayload, logId) {
  const result = await query(
    `UPDATE douyin_presale_orders
     SET order_stage = 'PAID',
         douyin_log_id = $2,
         raw_payload = jsonb_set(raw_payload, '{payment_notice}', $3::jsonb, true),
         mapped_payload = COALESCE(mapped_payload, '{}'::jsonb) || jsonb_build_object(
           'paymentNotice', jsonb_build_object(
             'payTimeUnix', $4,
             'payAmount', $5,
             'currency', $6
           )
         ),
         updated_at = NOW()
     WHERE id = $1
     RETURNING order_id, ota_order_id, order_stage`,
    [orderId, logId || null, JSON.stringify(rawPayload), paymentNotice.payTimeUnix, paymentNotice.payAmount, paymentNotice.currency]
  );
  return result.rows[0] || null;
}

/** 保存预售券取消结果和抖音排障信息。 */
async function markCancelled(orderId, cancellation, rawPayload, logId) {
  const result = await query(
    `UPDATE douyin_presale_orders
     SET order_stage = 'CANCELLED',
         cancel_id = $2,
         cancel_status = 'CANCELLED',
         cancel_log_id = $3,
         cancel_payload = $4::jsonb,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING order_id, ota_order_id, order_stage, cancel_id, cancel_status`,
    [orderId, cancellation.cancelId, logId || null, JSON.stringify(rawPayload)]
  );
  return result.rows[0] || null;
}

/** 保存暂不支持的仅退款请求，避免丢失抖音排障依据。 */
async function markRefundNotSupported(orderId, cancellation, rawPayload, logId) {
  return query(
    `UPDATE douyin_presale_orders
     SET cancel_id = $2,
         cancel_status = 'REFUND_NOT_SUPPORTED',
         cancel_log_id = $3,
         cancel_payload = $4::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [orderId, cancellation.cancelId, logId || null, JSON.stringify(rawPayload)]
  );
}

module.exports = {
  findByDouyinOrderId,
  findByLocalOrderId,
  findVoucherByDouyinId,
  insertOrder,
  listOrders,
  markPaid,
  markCancelled,
  markRefundNotSupported
};
