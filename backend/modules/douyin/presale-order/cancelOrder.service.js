"use strict";

const repository = require('./presaleOrder.repository');

/** 创建抖音预售券取消订单业务错误。 */
function createCancelOrderError(message, errorCode = 13) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  return error;
}

/** 校验抖音预售券取消订单请求。 */
function normalizeCancelOrder(payload = {}) {
  const orderId = String(payload.order_id || '').trim();
  const orderOutId = String(payload.order_out_id || '').trim();
  const cancelId = String(payload.cancel_id || '').trim();
  const cancelType = Number(payload.cancel_type);
  const afterSaleType = Number(payload.after_sale_type);
  const bizType = Number(payload.biz_type);

  if (!orderId || !cancelId || bizType !== 2011 || ![1, 2, 3].includes(cancelType) || ![1, 3].includes(afterSaleType)) {
    throw createCancelOrderError('预售券取消订单请求参数不合法');
  }

  return { orderId, orderOutId, cancelId, cancelType, afterSaleType, bizType };
}

/** 处理预售券取消订单，并保持同一 cancel_id 幂等。 */
async function cancelOrder(payload, options = {}) {
  const cancellation = normalizeCancelOrder(payload);
  const byDouyinOrderId = await repository.findByDouyinOrderId(cancellation.orderId);
  const byLocalOrderId = cancellation.orderOutId
    ? await repository.findByLocalOrderId(cancellation.orderOutId)
    : null;

  // 两个订单标识同时存在时，必须定位到同一张预售券订单。
  if (byDouyinOrderId && byLocalOrderId && byDouyinOrderId.id !== byLocalOrderId.id) {
    throw createCancelOrderError('抖音订单号与第三方订单号不匹配');
  }

  const order = byDouyinOrderId || byLocalOrderId;
  if (!order) {
    // 创单失败取消可能没有 order_out_id 和本地订单，无需等待重试。
    if (cancellation.cancelType === 3) {
      return { cancelResult: 1, reason: '', orderFound: false, duplicate: false };
    }
    throw createCancelOrderError('未找到对应的预售券订单', 100);
  }

  if (order.cancel_id === cancellation.cancelId) {
    const accepted = ['CANCELLED', 'REFUND_PENDING'].includes(order.cancel_status);
    return { cancelResult: accepted ? 1 : 2, reason: '', orderFound: true, duplicate: true };
  }

  // 仅退款保留主订单阶段，等待抖音退款完成通知确认资金结果。
  if (cancellation.afterSaleType === 3) {
    await repository.markRefundPending(order.id, cancellation, payload, options.logId);
    return { cancelResult: 1, reason: '', orderFound: true, duplicate: false };
  }

  if (['CREATED', 'PAID', 'CANCELLED'].includes(order.order_stage)) {
    await repository.markCancelled(order.id, cancellation, payload, options.logId);
    return { cancelResult: 1, reason: '', orderFound: true, duplicate: order.order_stage === 'CANCELLED' };
  }

  return { cancelResult: 2, reason: '预售券订单当前状态不能取消', orderFound: true, duplicate: false };
}

module.exports = { cancelOrder, normalizeCancelOrder };
