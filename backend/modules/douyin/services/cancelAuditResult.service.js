const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')

/**
 * 向抖音回传取消审核结果。
 *
 * @param {Object} payload 审核回传参数。
 * @param {string} payload.cancelId 取消编号。
 * @param {number} payload.cancelResult 审核结果（1=同意，2=拒绝）。
 * @param {number} payload.cancelType 取消类型。
 * @param {string} payload.otaOrderId 抖音订单号。
 * @param {string} [payload.reason=''] 审核原因。
 * @returns {Promise<Object>} 抖音 OpenAPI 响应。
 * @throws {Error} 抖音返回业务失败或网络异常时抛出异常。
 */
async function submitDouyinCancelAuditResult({
  cancelId,
  cancelResult,
  cancelType,
  otaOrderId,
  reason = '',
}) {
  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/trade/hotel/cancel/audit/',
    data: {
      cancel_Id: cancelId,
      cancel_result: cancelResult,
      cancel_type: cancelType,
      order_id: otaOrderId,
      reason,
    },
  })

  const businessErrorCode = result?.data?.error_code
  if (businessErrorCode && businessErrorCode !== 0) {
    const businessError = new Error(result?.data?.description || 'Douyin cancel audit failed')
    businessError.response = result
    throw businessError
  }

  return result
}

module.exports = {
  submitDouyinCancelAuditResult,
}
