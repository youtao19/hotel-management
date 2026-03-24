const postgreDB = require('../../../database/postgreDB/pg')
const { DOUYIN_CANCEL_ERROR } = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')

/**
 * 手动标记抖音订单为未支付超时取消。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {string} [params.reason] 取消原因。
 * @returns {Promise<{action:string, otaOrderId:string, reason:string}>} 处理结果。
 */
async function cancelUnpaidDouyinOrder({
  otaOrderId,
  reason,
}) {
  const normalizedOtaOrderId = String(otaOrderId || '').trim()
  const normalizedReason = String(reason || '用户未支付超时取消').trim() || '用户未支付超时取消'

  if (!normalizedOtaOrderId) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.MISSING_ORDER_ID, 'otaOrderId is required')
  }

  const result = await postgreDB.query(
    `UPDATE douyin_orders
     SET cancel_status = 'timeout_cancelled',
         cancel_reason = $2,
         updated_at = NOW()
     WHERE ota_order_id = $1
     RETURNING ota_order_id`,
    [normalizedOtaOrderId, normalizedReason]
  )

  if (!result.rows[0]) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, `Douyin order not found: ${normalizedOtaOrderId}`)
  }

  return {
    action: 'timeout_cancelled',
    otaOrderId: normalizedOtaOrderId,
    reason: normalizedReason,
  }
}

module.exports = {
  cancelUnpaidDouyinOrder,
}
