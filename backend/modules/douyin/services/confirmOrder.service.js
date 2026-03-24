const postgreDB = require('../../../database/postgreDB/pg')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { DOUYIN_CONFIRM_MODE } = require('../constants/enums')
const { DOUYIN_CONFIRM_ERROR } = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')

const DOUYIN_CONFIRM_RESULT_ACCEPT = 1
const DOUYIN_CONFIRM_RESULT_REJECT = 2
const DEFAULT_REJECT_CODE = 1
const DEFAULT_REJECT_REASON = '酒店暂不可接单'

/**
 * 校验确认接单参数。
 *
 * @param {Object} params 入参对象。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {number} params.confirmResult 确认结果。
 * @param {string} [params.confirmNumber] 接单确认号。
 * @returns {void}
 */
function validateConfirmParams({
  otaOrderId,
  confirmResult,
  confirmNumber,
}) {
  if (!String(otaOrderId || '').trim()) {
    throw new Error('otaOrderId is required')
  }

  if (![DOUYIN_CONFIRM_RESULT_ACCEPT, DOUYIN_CONFIRM_RESULT_REJECT].includes(confirmResult)) {
    throw new Error('confirmResult must be 1 or 2')
  }

  if (
    confirmResult === DOUYIN_CONFIRM_RESULT_ACCEPT &&
    !String(confirmNumber || '').trim()
  ) {
    throw new Error('confirmNumber is required when confirmResult is 1')
  }
}

/**
 * 构建抖音确认接单请求体。
 *
 * @param {Object} params 入参对象。
 * @param {number} params.confirmResult 确认结果。
 * @param {string} [params.confirmNumber] 接单确认号。
 * @param {number} [params.rejectCode] 拒单原因码。
 * @param {string} [params.rejectReason] 拒单原因说明。
 * @returns {Object} 抖音 OpenAPI 请求体。
 */
function buildConfirmResultPayload({
  confirmResult,
  confirmNumber,
  rejectCode,
  rejectReason,
}) {
  if (confirmResult === DOUYIN_CONFIRM_RESULT_ACCEPT) {
    return {
      confirm_result: confirmResult,
      confirm_number: String(confirmNumber || '').trim(),
    }
  }

  return {
    confirm_result: confirmResult,
    reject_code: Number.isFinite(rejectCode) ? rejectCode : DEFAULT_REJECT_CODE,
    reject_reason: String(rejectReason || DEFAULT_REJECT_REASON).trim() || DEFAULT_REJECT_REASON,
  }
}

/**
 * 判断抖音确认接单接口是否执行成功。
 *
 * @param {Object} result 抖音接口响应。
 * @returns {boolean} true 表示成功。
 */
function isDouyinConfirmSuccess(result = {}) {
  const errorCode = result?.data?.error_code ?? result?.extra?.error_code ?? null
  return errorCode === 0 || errorCode === null
}

/**
 * 调用抖音确认接单接口。
 *
 * @param {Object} params 入参对象。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {number} params.confirmResult 确认结果。
 * @param {string} [params.confirmNumber] 接单确认号。
 * @param {number} [params.rejectCode] 拒单原因码。
 * @param {string} [params.rejectReason] 拒单原因说明。
 * @returns {Promise<Object>} 抖音 OpenAPI 原始响应。
 */
async function confirmDouyinOrder({
  otaOrderId,
  confirmResult,
  confirmNumber,
  rejectCode,
  rejectReason,
}) {
  validateConfirmParams({
    otaOrderId,
    confirmResult,
    confirmNumber,
  })

  const localOrderResult = await postgreDB.query(
    `
    SELECT confirm_mode
    FROM douyin_orders
    WHERE ota_order_id = $1
    LIMIT 1
    `,
    [otaOrderId]
  )
  const localOrder = localOrderResult.rows[0] || null

  if (Number(localOrder?.confirm_mode) === DOUYIN_CONFIRM_MODE.SYNC) {
    throw createDouyinBusinessError(DOUYIN_CONFIRM_ERROR.SYNC_ORDER_NOT_CONFIRMABLE)
  }

  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/trade/hotel/order/confirm/',
    withAccountId: true,
    data: {
      order_id: String(otaOrderId).trim(),
      confirm_result: buildConfirmResultPayload({
        confirmResult,
        confirmNumber,
        rejectCode,
        rejectReason,
      }),
    },
  })

  return result
}

/**
 * 将接单结果回写到本地抖音订单表。
 *
 * @param {Object} params 入参对象。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {number} params.confirmResult 确认结果。
 * @param {string} [params.confirmNumber] 接单确认号。
 * @param {Object} params.result 抖音接口响应。
 * @returns {Promise<{action:string}>} 本地回写动作。
 */
async function saveConfirmResultToLocalOrder({
  otaOrderId,
  confirmResult,
  confirmNumber,
  result,
}) {
  if (!isDouyinConfirmSuccess(result)) {
    await postgreDB.query(
      `
      UPDATE douyin_orders
      SET confirm_status = 'failed',
          updated_at = NOW()
      WHERE ota_order_id = $1
      `,
      [otaOrderId]
    )

    return { action: 'failed' }
  }

  if (confirmResult === DOUYIN_CONFIRM_RESULT_REJECT) {
    await postgreDB.query(
      `
      UPDATE douyin_orders
      SET confirm_status = 'rejected',
          confirm_number = NULL,
          confirmed_at = NOW(),
          updated_at = NOW()
      WHERE ota_order_id = $1
      `,
      [otaOrderId]
    )

    return { action: 'rejected' }
  }

  await postgreDB.query(
    `
    UPDATE douyin_orders
    SET confirm_status = 'confirmed',
        confirm_number = $2,
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE ota_order_id = $1
    `,
    [otaOrderId, confirmNumber]
  )

  return { action: 'confirmed' }
}

module.exports = {
  DOUYIN_CONFIRM_RESULT_ACCEPT,
  DOUYIN_CONFIRM_RESULT_REJECT,
  confirmDouyinOrder,
  saveConfirmResultToLocalOrder,
}
