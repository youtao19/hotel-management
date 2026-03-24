const postgreDB = require('../../../database/postgreDB/pg')
const { DOUYIN_CANCEL_ERROR, DOUYIN_SUCCESS_RESULT } = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')
const { applyRefundCaseToLocalOrder } = require('./refundCase.service')

/**
 * 将分转换为元。
 *
 * @param {*} value 原始金额。
 * @returns {number|null} 转换后的金额。
 */
function toAmountNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return Number((num / 100).toFixed(2))
}

/**
 * 规范化退款结果通知请求。
 *
 * @param {Object} payload 原始请求体。
 * @returns {Object} 规范化结果。
 */
function mapDouyinRefundResultPayload(payload = {}) {
  return {
    otaOrderId: String(payload.order_id || '').trim(),
    sourceOrderId: String(payload.source_order_id || '').trim(),
    cancelId: String(payload.cancel_id || '').trim(),
    refundStatus: String(payload.refund_status || payload.status || '').trim(),
    refundAmount: toAmountNumber(payload.refund_amount),
    userRefundAmount: toAmountNumber(payload.user_refund_amount),
    cancelFinishTime: String(payload.cancel_finish_time || '').trim() || null,
    rawPayload: payload,
  }
}

/**
 * 反查抖音落地订单。
 *
 * @param {Object} payload 规范化退款结果。
 * @returns {Promise<Object|null>} 抖音落地订单。
 */
async function findDouyinOrderByRefundContext(payload) {
  if (payload.otaOrderId) {
    const byOtaOrderId = await postgreDB.query(
      `SELECT *
       FROM douyin_orders
       WHERE ota_order_id = $1
       LIMIT 1`,
      [payload.otaOrderId]
    )

    if (byOtaOrderId.rows[0]) {
      return byOtaOrderId.rows[0]
    }
  }

  if (payload.sourceOrderId) {
    const bySourceOrderId = await postgreDB.query(
      `SELECT *
       FROM douyin_orders
       WHERE source_order_id = $1
       LIMIT 1`,
      [payload.sourceOrderId]
    )

    if (bySourceOrderId.rows[0]) {
      return bySourceOrderId.rows[0]
    }
  }

  if (payload.cancelId) {
    const byCancelId = await postgreDB.query(
      `SELECT *
       FROM douyin_orders
       WHERE cancel_id = $1
       LIMIT 1`,
      [payload.cancelId]
    )

    if (byCancelId.rows[0]) {
      return byCancelId.rows[0]
    }
  }

  return null
}

/**
 * 回写退款结果到抖音订单表。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {string} params.refundStatus 退款状态。
 * @param {number|null} params.refundAmount 退款金额。
 * @param {number|null} params.userRefundAmount 用户退款金额。
 * @param {string|null} params.cancelFinishTime 退款完成时间。
 * @param {Object} params.payload 原始通知。
 * @returns {Promise<void>} 回写完成。
 */
async function saveRefundResultToDouyinOrder({
  otaOrderId,
  refundStatus,
  refundAmount,
  userRefundAmount,
  cancelFinishTime,
  payload,
}) {
  await postgreDB.query(
    `UPDATE douyin_orders
     SET refund_status = $2,
         refund_amount = COALESCE($3, refund_amount),
         user_refund_amount = COALESCE($4, user_refund_amount),
         cancel_finish_time = $5,
         refund_result_response = $6,
         refund_result_received_at = NOW(),
         updated_at = NOW()
     WHERE ota_order_id = $1`,
    [
      otaOrderId,
      refundStatus,
      refundAmount,
      userRefundAmount,
      cancelFinishTime,
      JSON.stringify(payload || {}),
    ]
  )
}

/**
 * 处理抖音退款结果通知。
 *
 * @param {Object} payload 原始请求体。
 * @param {Object} [options={}] 附加选项。
 * @returns {Promise<{errorCode:number, description:string, refundStatus:string, otaOrderId:string}>} 处理结果。
 */
async function handleDouyinRefundResult(payload = {}, options = {}) {
  const mapped = mapDouyinRefundResultPayload(payload)

  if (!mapped.otaOrderId && !mapped.sourceOrderId && !mapped.cancelId) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.MISSING_ORDER_ID, 'Missing order_id/source_order_id/cancel_id in refund result payload')
  }

  if (!mapped.refundStatus) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.INVALID_REFUND_STATUS, 'Missing refund_status in refund result payload')
  }

  const douyinOrder = await findDouyinOrderByRefundContext(mapped)
  if (!douyinOrder) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, 'Douyin order not found for refund result payload')
  }

  await saveRefundResultToDouyinOrder({
    otaOrderId: douyinOrder.ota_order_id,
    refundStatus: mapped.refundStatus,
    refundAmount: mapped.refundAmount,
    userRefundAmount: mapped.userRefundAmount,
    cancelFinishTime: mapped.cancelFinishTime,
    payload: mapped.rawPayload,
  })

  if (mapped.refundStatus === 'success' && douyinOrder.system_order_id) {
    await applyRefundCaseToLocalOrder({
      localOrder: {
        order_id: douyinOrder.system_order_id,
        status: douyinOrder.order_status || '',
      },
      refundCaseType: douyinOrder.refund_case_type || 'refund_result',
      refundCaseStatus: 'completed',
      reason: '抖音退款结果通知成功',
    })
  }

  return {
    errorCode: DOUYIN_SUCCESS_RESULT.code,
    description: DOUYIN_SUCCESS_RESULT.description,
    refundStatus: mapped.refundStatus,
    otaOrderId: douyinOrder.ota_order_id,
    douyinLogId: String(options.douyinLogId || '').trim(),
  }
}

module.exports = {
  findDouyinOrderByRefundContext,
  handleDouyinRefundResult,
  mapDouyinRefundResultPayload,
  saveRefundResultToDouyinOrder,
}
