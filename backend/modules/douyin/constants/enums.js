/**
 * 抖音创单确认模式枚举。
 */
const DOUYIN_CONFIRM_MODE = Object.freeze({
  SYNC: 1,
  ASYNC: 2,
})

/**
 * 抖音取消模式枚举。
 */
const DOUYIN_CANCEL_MODE = Object.freeze({
  ASYNC: 2,
})

/**
 * 抖音审核结果枚举。
 */
const DOUYIN_CANCEL_AUDIT_RESULT = Object.freeze({
  APPROVED: 1,
  REJECTED: 2,
})

/**
 * 抖音取消处理动作枚举。
 */
const DOUYIN_CANCEL_ACTION = Object.freeze({
  CANCELLED: 'cancelled',
  ALREADY_CANCELLED: 'already_cancelled',
  PENDING_AUDIT: 'pending_audit',
})

/**
 * 抖音取消单处理状态枚举。
 */
const DOUYIN_CANCEL_STATUS = Object.freeze({
  CANCELLED: 'cancelled',
  ALREADY_CANCELLED: 'already_cancelled',
  PENDING_AUDIT: 'pending_audit',
  INVALID_STATUS: 'invalid_status',
  MISSING_LOCAL_ORDER: 'missing_local_order',
})

/**
 * 抖音取消审核推送状态枚举。
 */
const DOUYIN_CANCEL_AUDIT_STATUS = Object.freeze({
  PENDING_PUSH: 'pending_push',
  SENT: 'sent',
  PUSH_FAILED: 'push_failed',
})

/**
 * 本地订单状态枚举。
 */
const LOCAL_ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  RESERVED: 'reserved',
  CANCELLED: 'cancelled',
  CHECKED_IN: 'checked-in',
  OCCUPIED: 'occupied',
  CHECKED_OUT: 'checked-out',
})

/**
 * 抖音预售券订单阶段枚举。
 */
const DOUYIN_PRESALE_ORDER_STAGE = Object.freeze({
  PRESALE_CREATED: 'presale_created',
  PRESALE_PAID: 'presale_paid',
  BOOKING_CREATED: 'booking_created',
  CANCELLED: 'cancelled',
  REFUND_PROCESSING: 'refund_processing',
})

module.exports = {
  DOUYIN_CONFIRM_MODE,
  DOUYIN_CANCEL_MODE,
  DOUYIN_CANCEL_AUDIT_RESULT,
  DOUYIN_CANCEL_ACTION,
  DOUYIN_CANCEL_STATUS,
  DOUYIN_CANCEL_AUDIT_STATUS,
  LOCAL_ORDER_STATUS,
  DOUYIN_PRESALE_ORDER_STAGE,
}
