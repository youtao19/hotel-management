"use strict";

const crypto = require('crypto');
const { getClient } = require('../../../database/postgreDB/pg');
const repository = require('./presaleOrder.repository');

/** 创建预售券退款结果通知业务错误。 */
function createRefundResultError(message) {
  const error = new Error(message);
  error.douyinErrorCode = 13;
  return error;
}

/** 将可选退款金额规范为非负整数分。 */
function normalizeOptionalCents(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) throw createRefundResultError(`${fieldName} 格式错误`);
  return amount;
}

/** 将可选时间戳规范为秒级整数。 */
function normalizeOptionalUnix(value) {
  if (value === undefined || value === null || value === '') return null;
  const timestamp = Number(value);
  if (!Number.isInteger(timestamp) || timestamp < 0) throw createRefundResultError('refund_time_unix 格式错误');
  return timestamp;
}

/** 稳定序列化请求体，避免字段顺序变化破坏通知幂等。 */
function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 校验并整理抖音预售券退款结果通知。 */
function normalizeRefundResult(payload = {}) {
  const bizType = Number(payload.biz_type);
  const refundType = Number(payload.refund_type);
  if (bizType !== 2011 || ![11, 12, 21, 22].includes(refundType)) {
    throw createRefundResultError('预售券退款结果通知参数不合法');
  }

  const refundOrderDetail = payload.refund_order_detail;
  if (refundOrderDetail !== undefined && refundOrderDetail !== null && !Array.isArray(refundOrderDetail)) {
    throw createRefundResultError('refund_order_detail 格式错误');
  }
  const needThirdCancel = payload.need_third_cancel;
  if (needThirdCancel !== undefined && needThirdCancel !== null && typeof needThirdCancel !== 'boolean') {
    throw createRefundResultError('need_third_cancel 格式错误');
  }

  return {
    douyinOrderId: String(payload.order_id || '').trim(),
    localOrderId: String(payload.order_out_id || '').trim(),
    refundTotalAmount: normalizeOptionalCents(payload.refund_total_amount, 'refund_total_amount'),
    refundAmount: normalizeOptionalCents(payload.refund_amount, 'refund_amount'),
    userRefundAmount: normalizeOptionalCents(payload.user_refund_amount, 'user_refund_amount'),
    refundTimeUnix: normalizeOptionalUnix(payload.refund_time_unix),
    currency: String(payload.currency || '').trim() || null,
    refundType,
    auditUserType: payload.audit_user_type === undefined || payload.audit_user_type === null || payload.audit_user_type === '' ? null : Number(payload.audit_user_type),
    applicantType: payload.applicant_type === undefined || payload.applicant_type === null || payload.applicant_type === '' ? null : Number(payload.applicant_type),
    needThirdCancel: needThirdCancel ?? null,
    refundReason: String(payload.refund_reason || '').trim() || null,
    refundOrderDetail: refundOrderDetail || null,
    payloadHash: crypto.createHash('sha256').update(stableSerialize(payload)).digest('hex')
  };
}

/** 接收退款结果并原子更新已匹配预售订单的退款状态。 */
async function recordRefundResult(payload, options = {}) {
  const notice = normalizeRefundResult(payload);
  let client;

  try {
    client = await getClient();
    await client.query('BEGIN');
    const byDouyinOrderId = notice.douyinOrderId ? await repository.findByDouyinOrderId(notice.douyinOrderId, client) : null;
    const byLocalOrderId = notice.localOrderId ? await repository.findByLocalOrderId(notice.localOrderId, client) : null;
    const orderConflict = byDouyinOrderId && byLocalOrderId && byDouyinOrderId.id !== byLocalOrderId.id;
    const order = orderConflict ? null : (byDouyinOrderId || byLocalOrderId);
    const matchStatus = orderConflict ? 'ORDER_CONFLICT' : (order ? 'MATCHED' : 'ORDER_NOT_FOUND');
    const inserted = await repository.insertRefundNotification({
      ...notice,
      logId: options.logId || null,
      rawPayload: payload,
      presaleOrderId: order?.id || null,
      matchStatus
    }, client);

    // 只有首次、且定位无冲突的通知能推进订单退款状态。
    if (inserted && order) await repository.markRefundCompleted(order.id, options.logId || null, client);

    await client.query('COMMIT');
    return { ...notice, orderFound: Boolean(order), orderConflict, duplicate: !inserted, matchStatus };
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) client.release();
  }
}

module.exports = { normalizeRefundResult, recordRefundResult, stableSerialize };
