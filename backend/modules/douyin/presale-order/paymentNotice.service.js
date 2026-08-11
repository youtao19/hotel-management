"use strict";

const repository = require('./presaleOrder.repository');
const bookingRepository = require('./bookingOrder.repository');
const { query } = require('../../../database/postgreDB/pg');

/** 创建支付通知业务错误。 */
function createPaymentNoticeError(message, errorCode = 13) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  return error;
}

/** 规范可选的分单位金额字段。 */
function normalizeOptionalCents(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw createPaymentNoticeError(`${fieldName} 格式错误`);
  }
  return amount;
}

/** 校验并整理抖音预售券支付通知。 */
function normalizePaymentNotice(payload = {}) {
  const bizType = Number(payload.biz_type);
  if (![2011, 2012].includes(bizType)) {
    throw createPaymentNoticeError('该支付通知不是预售券或预约订单');
  }

  const payTimeUnix = payload.pay_time_unix === undefined || payload.pay_time_unix === null || payload.pay_time_unix === ''
    ? null
    : Number(payload.pay_time_unix);
  if (payTimeUnix !== null && (!Number.isInteger(payTimeUnix) || payTimeUnix < 0)) {
    throw createPaymentNoticeError('pay_time_unix 格式错误');
  }

  return {
    douyinOrderId: String(payload.order_id || '').trim(),
    localOrderId: String(payload.order_out_id || '').trim(),
    bizType,
    payTimeUnix,
    currency: String(payload.currency || 'CNY').trim() || 'CNY',
    originAmount: normalizeOptionalCents(payload.origin_amount, 'origin_amount'),
    addAmount: normalizeOptionalCents(payload.add_amount, 'add_amount'),
    payAmount: normalizeOptionalCents(payload.pay_amount, 'pay_amount'),
    merchantReceivableAmount: normalizeOptionalCents(payload.merchant_receivable_amount, 'merchant_receivable_amount')
  };
}

/** 保存支付成功状态，并允许抖音对同一订单重复通知。 */
async function recordPaymentNotice(payload, options = {}) {
  const notice = normalizePaymentNotice(payload);
  if (notice.bizType === 2012) {
    const byDouyinOrderId = notice.douyinOrderId ? await bookingRepository.findByDouyinOrderId(notice.douyinOrderId, { query }) : null;
    const byLocalOrderId = notice.localOrderId ? await bookingRepository.findByLocalOrderId(notice.localOrderId) : null;
    if (byDouyinOrderId && byLocalOrderId && byDouyinOrderId.id !== byLocalOrderId.id) {
      throw createPaymentNoticeError('抖音订单号与第三方订单号不匹配');
    }
    const booking = byDouyinOrderId || byLocalOrderId;
    if (!booking) return { ...notice, orderFound: false, duplicate: false };
    const updated = await bookingRepository.markPaid(booking.id, notice, payload, options.logId);
    if (!updated) return { ...notice, orderFound: true, duplicate: true };
    return {
      ...notice,
      douyinOrderId: updated.ota_order_id,
      localOrderId: updated.order_id,
      orderFound: true,
      duplicate: booking.payment_status === 'PAID'
    };
  }
  const byDouyinOrderId = notice.douyinOrderId ? await repository.findByDouyinOrderId(notice.douyinOrderId) : null;
  const byLocalOrderId = notice.localOrderId ? await repository.findByLocalOrderId(notice.localOrderId) : null;

  // 两个订单标识同时存在时，必须指向同一笔本地订单。
  if (byDouyinOrderId && byLocalOrderId && byDouyinOrderId.id !== byLocalOrderId.id) {
    throw createPaymentNoticeError('抖音订单号与第三方订单号不匹配');
  }

  const order = byDouyinOrderId || byLocalOrderId;
  if (!order) {
    return { ...notice, orderFound: false, duplicate: false };
  }

  const updated = await repository.markPaid(order.id, notice, payload, options.logId);
  return {
    ...notice,
    douyinOrderId: updated.ota_order_id,
    localOrderId: updated.order_id,
    orderFound: true,
    duplicate: order.order_stage === 'PAID'
  };
}

module.exports = { recordPaymentNotice, normalizePaymentNotice };
