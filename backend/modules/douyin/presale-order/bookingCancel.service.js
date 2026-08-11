"use strict";

const { getClient } = require('../../../database/postgreDB/pg');
const repository = require('./bookingOrder.repository');

/** 创建抖音预约取消订单业务错误。 */
function createBookingCancelError(message, errorCode = 13) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  return error;
}

/** 校验并整理抖音预约取消订单请求。 */
function normalizeBookingCancellation(payload = {}) {
  const orderId = String(payload.order_id || '').trim();
  const orderOutId = String(payload.order_out_id || '').trim();
  const cancelId = String(payload.cancel_id || '').trim();
  const cancelType = Number(payload.cancel_type);
  const afterSaleType = Number(payload.after_sale_type);
  const bizType = Number(payload.biz_type);

  if (!orderId || !cancelId || bizType !== 2012 || ![1, 2, 3].includes(cancelType) || ![1, 2, 3].includes(afterSaleType)) {
    throw createBookingCancelError('预约取消订单请求参数不合法');
  }
  return { orderId, orderOutId, cancelId, cancelType, afterSaleType, bizType };
}

/** 处理预约单取消并释放未入住占房，重复 cancel_id 只返回已处理结论。 */
async function cancelBooking(payload, options = {}) {
  const cancellation = normalizeBookingCancellation(payload);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const byDouyinOrderId = await repository.findByDouyinOrderId(cancellation.orderId, client);
    const byLocalOrderId = cancellation.orderOutId
      ? await repository.findByLocalOrderId(cancellation.orderOutId, client)
      : null;

    // 两个订单标识同时存在时，必须定位到同一笔预约单。
    if (byDouyinOrderId && byLocalOrderId && byDouyinOrderId.id !== byLocalOrderId.id) {
      throw createBookingCancelError('抖音订单号与第三方订单号不匹配', 100);
    }

    const booking = byDouyinOrderId || byLocalOrderId;
    if (!booking) {
      if (cancellation.cancelType === 3) {
        await client.query('COMMIT');
        return { cancelResult: 1, reason: '', orderFound: false, duplicate: false };
      }
      throw createBookingCancelError('未找到对应预约订单', 100);
    }

    if (booking.cancel_id === cancellation.cancelId) {
      await client.query('COMMIT');
      return { cancelResult: booking.cancel_status === 'CANCELLED' ? 1 : 2, reason: '', orderFound: true, duplicate: true };
    }

    if (![1, 2].includes(cancellation.afterSaleType)) {
      throw createBookingCancelError('预约单仅退款需等待退款结果通知处理', 13);
    }
    if (!['CREATED', 'CONFIRMED', 'CONFIRM_FAILED', 'CANCELLED'].includes(booking.booking_status)) {
      throw createBookingCancelError('预约订单当前状态不能取消', 13);
    }

    await repository.markCancelled(booking, { cancelId: cancellation.cancelId, logId: options.logId, rawPayload: payload }, client);
    await client.query('COMMIT');
    return { cancelResult: 1, reason: '', orderFound: true, duplicate: booking.booking_status === 'CANCELLED' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { cancelBooking, createBookingCancelError, normalizeBookingCancellation };
