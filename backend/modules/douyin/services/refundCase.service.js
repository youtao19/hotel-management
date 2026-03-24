const postgreDB = require('../../../database/postgreDB/pg')
const { updateOrderStatus } = require('../../orderModule')
const { DOUYIN_CANCEL_ERROR, DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { LOCAL_ORDER_STATUS } = require('../constants/enums')
const { createDouyinBusinessError } = require('../utils/douyinError')
const { toAmountNumber } = require('./cancelOrder.service')

const REFUND_CASE_TYPE = Object.freeze({
  FORCE: 'force_refund',
  NEGOTIATED: 'negotiated_refund',
  CALENDAR: 'calendar_refund',
})

/**
 * 生成当前本地日期字符串。
 *
 * @returns {string} 当前日期 yyyy-MM-dd。
 */
function getTodayDateString() {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 规范化退款 case 请求。
 *
 * @param {Object} payload 原始请求体。
 * @returns {Object} 规范化结果。
 */
function buildRefundCasePayload(payload = {}) {
  return {
    otaOrderId: String(payload.order_id || '').trim(),
    orderOutId: String(payload.order_out_id || '').trim(),
    cancelId: String(payload.cancel_id || '').trim(),
    refundCaseType: String(payload.refund_case_type || payload.case_type || '').trim().toLowerCase(),
    refundStatus: String(payload.refund_status || payload.status || 'processing').trim().toLowerCase(),
    refundAmount: toAmountNumber(payload.refund_amount),
    userRefundAmount: toAmountNumber(payload.user_refund_amount),
    reason: String(payload.reason || payload.cancel_reason || '').trim(),
    rawPayload: payload,
  }
}

/**
 * 查找退款 case 对应的抖音订单和本地订单。
 *
 * @param {Object} payload 规范化退款 case。
 * @returns {Promise<{douyinOrder:Object, localOrder:Object|null, orderRows:Object[]}>} 退款上下文。
 */
async function findRefundContextOrder(payload) {
  let douyinOrder = null

  if (payload.otaOrderId) {
    const result = await postgreDB.query(
      `SELECT * FROM douyin_orders WHERE ota_order_id = $1 LIMIT 1`,
      [payload.otaOrderId]
    )
    douyinOrder = result.rows[0] || null
  }

  if (!douyinOrder && payload.cancelId) {
    const result = await postgreDB.query(
      `SELECT * FROM douyin_orders WHERE cancel_id = $1 LIMIT 1`,
      [payload.cancelId]
    )
    douyinOrder = result.rows[0] || null
  }

  if (!douyinOrder) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, 'Douyin order not found for refund case')
  }

  const localOrderId = String(payload.orderOutId || douyinOrder.system_order_id || '').trim()
  if (!localOrderId) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, 'Local order not found for refund case')
  }

  const orderRowsResult = await postgreDB.query(
    `SELECT *
     FROM orders
     WHERE order_id = $1
     ORDER BY stay_date ASC`,
    [localOrderId]
  )
  const orderRows = orderRowsResult.rows || []
  const localOrder = orderRows[0] || null

  if (!localOrder) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, 'Local order not found for refund case')
  }

  return {
    douyinOrder,
    localOrder,
    orderRows,
  }
}

/**
 * 计算建议退款金额。
 * 规则：
 * 1. 待入住/已预订订单默认全额建议退款；
 * 2. 已入住或已离店订单仅按今天之后的未入住日期累计；
 * 3. 计算口径基于 orders 的每日拆分行 total_price。
 *
 * @param {Object[]} orderRows 本地订单拆分行。
 * @returns {number} 建议退款金额。
 */
function calculateSuggestedRefundAmount(orderRows = []) {
  if (!orderRows.length) {
    return 0
  }

  const today = getTodayDateString()
  const currentStatus = String(orderRows[0]?.status || '').trim()
  const refundableRows = [LOCAL_ORDER_STATUS.PENDING, LOCAL_ORDER_STATUS.RESERVED, LOCAL_ORDER_STATUS.CANCELLED].includes(currentStatus)
    ? orderRows
    : orderRows.filter((row) => String(row.stay_date || '').trim() > today)

  const totalAmount = refundableRows.reduce((sum, row) => {
    return sum + Number(row?.total_price || 0)
  }, 0)

  return Number(totalAmount.toFixed(2))
}

/**
 * 解析退款 case 处理动作。
 *
 * @param {Object} payload 规范化退款 case。
 * @param {Object} localOrder 本地订单主行。
 * @returns {{refundCaseType:string, refundCaseStatus:string, action:string}} 处理动作。
 */
function resolveRefundAction(payload, localOrder) {
  if (!Object.values(REFUND_CASE_TYPE).includes(payload.refundCaseType)) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.INVALID_REFUND_CASE_TYPE)
  }

  if (payload.refundCaseType === REFUND_CASE_TYPE.FORCE) {
    return {
      refundCaseType: payload.refundCaseType,
      refundCaseStatus: 'processing',
      action: 'force_refund_processing',
    }
  }

  if (payload.refundCaseType === REFUND_CASE_TYPE.NEGOTIATED) {
    return {
      refundCaseType: payload.refundCaseType,
      refundCaseStatus: 'approved',
      action: 'negotiated_refund_approved',
    }
  }

  return {
    refundCaseType: payload.refundCaseType,
    refundCaseStatus: payload.refundStatus === 'success' ? 'completed' : 'processing',
    action: 'calendar_refund_processing',
  }
}

/**
 * 回写退款 case 到抖音订单表。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<void>} 回写完成。
 */
async function applyRefundCaseToDouyinOrder({
  otaOrderId,
  refundCaseType,
  refundCaseStatus,
  refundStatus,
  refundAmount,
  userRefundAmount,
  suggestedRefundAmount,
  payload,
}) {
  await postgreDB.query(
    `UPDATE douyin_orders
     SET refund_case_type = $2,
         refund_case_status = $3,
         refund_status = COALESCE($4, refund_status),
         refund_amount = COALESCE($5, refund_amount),
         user_refund_amount = COALESCE($6, user_refund_amount),
         suggested_refund_amount = $7,
         refund_case_response = $8,
         updated_at = NOW()
     WHERE ota_order_id = $1`,
    [
      otaOrderId,
      refundCaseType,
      refundCaseStatus,
      refundStatus || null,
      refundAmount,
      userRefundAmount,
      suggestedRefundAmount,
      JSON.stringify(payload || {}),
    ]
  )
}

/**
 * 将退款结果同步到本地订单。
 * 说明：
 * 1. 仅在待入住/已预订场景下直接改为 cancelled；
 * 2. 已入住/已离店场景暂不自动改复杂履约状态，只补备注。
 *
 * @param {Object} params 参数对象。
 * @returns {Promise<void>} 同步完成。
 */
async function applyRefundCaseToLocalOrder({
  localOrder,
  refundCaseType,
  refundCaseStatus,
  reason,
}) {
  const localOrderId = String(localOrder?.order_id || '').trim()
  if (!localOrderId) {
    return
  }

  const shouldCancelLocalOrder = [LOCAL_ORDER_STATUS.PENDING, LOCAL_ORDER_STATUS.RESERVED].includes(localOrder.status)
    && ['approved', 'completed'].includes(refundCaseStatus)

  if (shouldCancelLocalOrder) {
    await updateOrderStatus(localOrderId, LOCAL_ORDER_STATUS.CANCELLED)
  }

  // 关键备注写回所有分日行，后续排查可直接看到抖音逆向来源。
  await postgreDB.query(
    `UPDATE orders
     SET remarks = CONCAT(COALESCE(remarks, ''), CASE WHEN COALESCE(remarks, '') = '' THEN '' ELSE '；' END, $2)
     WHERE order_id = $1`,
    [
      localOrderId,
      `抖音退款处理:${refundCaseType}/${refundCaseStatus}${reason ? `，原因:${reason}` : ''}`,
    ]
  )
}

/**
 * 处理抖音退款 case。
 *
 * @param {Object} payload 原始请求体。
 * @param {Object} [options={}] 附加选项。
 * @returns {Promise<{errorCode:number, description:string, action:string, otaOrderId:string, suggestedRefundAmount:number}>} 处理结果。
 */
async function handleDouyinRefundCase(payload = {}, options = {}) {
  const mapped = buildRefundCasePayload(payload)

  if (!mapped.otaOrderId && !mapped.orderOutId && !mapped.cancelId) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.MISSING_ORDER_ID, 'Missing order_id/order_out_id/cancel_id in refund case payload')
  }

  const { douyinOrder, localOrder, orderRows } = await findRefundContextOrder(mapped)
  const refundAction = resolveRefundAction(mapped, localOrder)
  const suggestedRefundAmount = calculateSuggestedRefundAmount(orderRows)

  await applyRefundCaseToDouyinOrder({
    otaOrderId: douyinOrder.ota_order_id,
    refundCaseType: refundAction.refundCaseType,
    refundCaseStatus: refundAction.refundCaseStatus,
    refundStatus: mapped.refundStatus,
    refundAmount: mapped.refundAmount,
    userRefundAmount: mapped.userRefundAmount,
    suggestedRefundAmount,
    payload: mapped.rawPayload,
  })

  await applyRefundCaseToLocalOrder({
    localOrder,
    refundCaseType: refundAction.refundCaseType,
    refundCaseStatus: refundAction.refundCaseStatus,
    reason: mapped.reason,
  })

  return {
    errorCode: DOUYIN_SUCCESS_RESULT.code,
    description: DOUYIN_SUCCESS_RESULT.description,
    action: refundAction.action,
    otaOrderId: douyinOrder.ota_order_id,
    suggestedRefundAmount,
    douyinLogId: String(options.douyinLogId || '').trim(),
  }
}

module.exports = {
  REFUND_CASE_TYPE,
  applyRefundCaseToDouyinOrder,
  applyRefundCaseToLocalOrder,
  buildRefundCasePayload,
  calculateSuggestedRefundAmount,
  findRefundContextOrder,
  handleDouyinRefundCase,
  resolveRefundAction,
}
