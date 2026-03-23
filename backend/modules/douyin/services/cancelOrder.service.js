const postgreDB = require('../../../database/postgreDB/pg')
const { updateOrderStatus } = require('../../orderModule')
const { submitDouyinCancelAuditResult } = require('./cancelAuditResult.service')

/**
 * 将分转换为元。
 *
 * @param {*} value 原始金额。
 * @returns {number|null} 转换后的金额；无效时返回 null。
 */
function toAmountNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return Number((num / 100).toFixed(2))
}

/**
 * 将时间戳秒转换为本地字符串。
 * 说明：
 * 1. 该字段仅用于取消时间记录，不作为 DATE 字段直接参与业务计算；
 * 2. 返回 yyyy-MM-dd HH:mm:ss 字符串，避免对外使用 toISOString。
 *
 * @param {*} unixSeconds 秒级时间戳。
 * @returns {string|null} 格式化后的时间字符串。
 */
function formatUnixSeconds(unixSeconds) {
  if (unixSeconds === undefined || unixSeconds === null || unixSeconds === '') return null
  const timestamp = Number(unixSeconds)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp * 1000)
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 创建抖音取消订单业务异常。
 *
 * @param {number} code 抖音错误码。
 * @param {string} description 错误描述。
 * @param {string} message 内部错误信息。
 * @returns {Error} 带错误码的异常对象。
 */
function createDouyinCancelError(code, description, message) {
  const error = new Error(message || description)
  error.douyinErrorCode = code
  error.douyinDescription = description
  return error
}

/**
 * 从取消通知中提取并规范化字段。
 *
 * @param {Object} payload 抖音取消通知原始请求体。
 * @returns {Object} 规范化后的取消通知对象。
 */
function mapDouyinCancelPayload(payload = {}) {
  return {
    otaOrderId: String(payload.order_id || '').trim(),
    cancelId: String(payload.cancel_id || '').trim(),
    orderOutId: String(payload.order_out_id || '').trim(),
    cancelType: payload.cancel_type === undefined ? null : Number(payload.cancel_type),
    bizType: payload.biz_type === undefined ? null : Number(payload.biz_type),
    needAudit: payload.need_audit === true,
    afterSaleType: payload.after_sale_type === undefined ? null : Number(payload.after_sale_type),
    refundType: payload.refund_type === undefined ? null : Number(payload.refund_type),
    refundAmount: toAmountNumber(payload.refund_amount),
    userRefundAmount: toAmountNumber(payload.user_refund_amount),
    penaltyAmount: toAmountNumber(payload.penalty),
    currency: payload.currency || 'CNY',
    cancelReason: payload.cancel_reason || '',
    cancelOrderTime: formatUnixSeconds(payload.cancel_order_time_unix),
    refundOrderDetail: Array.isArray(payload.refund_order_detail) ? payload.refund_order_detail : [],
    rawPayload: payload,
  }
}

/**
 * 校验抖音取消通知关键字段。
 *
 * @param {Object} payload 规范化后的取消通知。
 * @returns {void}
 * @throws {Error} 参数不合法时抛出业务异常。
 */
function validateDouyinCancelPayload(payload) {
  if (!payload.otaOrderId) {
    throw createDouyinCancelError(13, '缺少抖音订单号', 'Missing order_id in cancel payload')
  }

  if (!payload.cancelId) {
    throw createDouyinCancelError(13, '缺少取消单号', 'Missing cancel_id in cancel payload')
  }

  if (payload.cancelType === null || Number.isNaN(payload.cancelType)) {
    throw createDouyinCancelError(13, '取消类型不合法', 'Missing cancel_type in cancel payload')
  }

  if (payload.bizType === null || Number.isNaN(payload.bizType)) {
    throw createDouyinCancelError(13, '业务类型不合法', 'Missing biz_type in cancel payload')
  }

  if (payload.afterSaleType === null || Number.isNaN(payload.afterSaleType)) {
    throw createDouyinCancelError(13, '售后方式不合法', 'Missing after_sale_type in cancel payload')
  }

  if (payload.refundType === null || Number.isNaN(payload.refundType)) {
    throw createDouyinCancelError(13, '退款类型不合法', 'Missing refund_type in cancel payload')
  }
}

/**
 * 根据抖音订单号或本地订单号查找本地订单主行。
 *
 * @param {Object} payload 规范化后的取消通知。
 * @param {Object} client 数据库客户端。
 * @returns {Promise<Object|null>} 本地订单主行信息。
 */
async function findLocalOrder(payload, client) {
  if (payload.orderOutId) {
    const orderOutIdResult = await client.query(
      `SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date ASC LIMIT 1`,
      [payload.orderOutId]
    )

    if (orderOutIdResult.rows[0]) {
      return orderOutIdResult.rows[0]
    }
  }

  const byDouyinOrderResult = await client.query(
    `SELECT * FROM orders
      WHERE order_source = 'douyin'
        AND id_source = $1
      ORDER BY stay_date ASC
      LIMIT 1`,
    [payload.otaOrderId]
  )

  return byDouyinOrderResult.rows[0] || null
}

/**
 * 回写抖音订单取消通知信息。
 *
 * @param {Object} payload 规范化后的取消通知。
 * @param {string} cancelStatus 取消处理状态。
 * @param {Object} client 数据库客户端。
 * @returns {Promise<void>} 更新完成后返回。
 */
async function updateDouyinCancelInfo(payload, cancelStatus, client) {
  await client.query(
    `UPDATE douyin_orders
        SET cancel_id = $2,
            cancel_type = $3,
            need_audit = $4,
            after_sale_type = $5,
            refund_type = $6,
            refund_amount = $7,
            user_refund_amount = $8,
            penalty_amount = $9,
            cancel_reason = $10,
            cancel_order_time = $11,
            refund_order_detail = $12,
            cancel_status = $13,
            updated_at = NOW()
      WHERE ota_order_id = $1`,
    [
      payload.otaOrderId,
      payload.cancelId,
      payload.cancelType,
      payload.needAudit,
      payload.afterSaleType,
      payload.refundType,
      payload.refundAmount,
      payload.userRefundAmount,
      payload.penaltyAmount,
      payload.cancelReason,
      payload.cancelOrderTime,
      JSON.stringify(payload.refundOrderDetail || []),
      cancelStatus,
    ]
  )
}

/**
 * 回写抖音订单审核结果推送信息。
 *
 * @param {Object} params 审核回传信息。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {number} params.cancelAuditResult 审核回传结果。
 * @param {string} params.cancelAuditReason 审核回传原因。
 * @param {string} params.cancelAuditStatus 审核回传状态。
 * @param {Object|null} params.cancelAuditResponse 审核回传原始响应。
 * @param {number} params.cancelAuditRetryCount 审核回传重试次数。
 * @returns {Promise<void>} 更新完成后返回。
 */
async function updateDouyinCancelAuditInfo({
  otaOrderId,
  cancelAuditResult,
  cancelAuditReason,
  cancelAuditStatus,
  cancelAuditResponse,
  cancelAuditRetryCount,
}) {
  await postgreDB.query(
    `UPDATE douyin_orders
        SET cancel_audit_result = $2,
            cancel_audit_reason = $3,
            cancel_audit_status = $4,
            cancel_audit_response = $5,
            cancel_audit_retry_count = $6,
            cancel_audit_sent_at = NOW(),
            updated_at = NOW()
      WHERE ota_order_id = $1`,
    [
      otaOrderId,
      cancelAuditResult,
      cancelAuditReason,
      cancelAuditStatus,
      cancelAuditResponse ? JSON.stringify(cancelAuditResponse) : null,
      cancelAuditRetryCount,
    ]
  )
}

/**
 * 根据本地订单状态生成审核回传决策。
 *
 * @param {Object} params 决策参数。
 * @param {boolean} params.needAudit 是否需要审核。
 * @param {string} params.localOrderStatus 本地订单状态。
 * @param {string} params.cancelReason 取消原因。
 * @returns {{cancelResult:number, reason:string, auditStatus:string}|null} 审核决策；无需回传时返回 null。
 */
function buildCancelAuditDecision({
  needAudit,
  localOrderStatus,
  cancelReason,
}) {
  if (!needAudit) {
    return null
  }

  if (['pending', 'reserved', 'cancelled'].includes(localOrderStatus)) {
    return {
      cancelResult: 1,
      reason: cancelReason || '审核同意取消',
      auditStatus: 'pending_push',
    }
  }

  if (['checked-in', 'occupied', 'checked-out'].includes(localOrderStatus)) {
    return {
      cancelResult: 2,
      reason: cancelReason || `订单当前状态为 ${localOrderStatus}，拒绝取消`,
      auditStatus: 'pending_push',
    }
  }

  return null
}

/**
 * 提交取消审核结果并回写状态。
 *
 * @param {Object} params 审核提交参数。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {string} params.cancelId 取消单号。
 * @param {number} params.cancelType 取消类型。
 * @param {{cancelResult:number, reason:string}} params.auditDecision 审核决策。
 * @param {number} params.currentRetryCount 当前重试次数。
 * @returns {Promise<string>} 最终审核推送状态。
 */
async function pushCancelAuditResult({
  otaOrderId,
  cancelId,
  cancelType,
  auditDecision,
  currentRetryCount,
}) {
  const nextRetryCount = Number(currentRetryCount || 0) + 1

  try {
    const auditResponse = await submitDouyinCancelAuditResult({
      cancelId,
      cancelResult: auditDecision.cancelResult,
      cancelType,
      otaOrderId,
      reason: auditDecision.reason,
    })

    await updateDouyinCancelAuditInfo({
      otaOrderId,
      cancelAuditResult: auditDecision.cancelResult,
      cancelAuditReason: auditDecision.reason,
      cancelAuditStatus: 'sent',
      cancelAuditResponse: auditResponse?.raw || auditResponse,
      cancelAuditRetryCount: nextRetryCount,
    })

    return 'sent'
  } catch (error) {
    await updateDouyinCancelAuditInfo({
      otaOrderId,
      cancelAuditResult: auditDecision.cancelResult,
      cancelAuditReason: auditDecision.reason,
      cancelAuditStatus: 'push_failed',
      cancelAuditResponse: error?.response?.raw || { message: error.message },
      cancelAuditRetryCount: nextRetryCount,
    })

    return 'push_failed'
  }
}

/**
 * 处理抖音取消订单 SPI。
 * 策略：
 * 1. 待入住订单直接本地取消；
 * 2. 已取消订单幂等成功；
 * 3. 已入住/已离店订单返回异步取消模式，等待售后审核结果回传；
 * 4. need_audit=true 时自动异步回传审核结果，但不阻塞本地取消事务提交。
 *
 * @param {Object} payload 抖音取消通知原始请求体。
 * @returns {Promise<Object>} 取消处理结果。
 * @throws {Error} 订单不存在或参数不合法时抛出异常。
 */
async function handleDouyinCancelOrder(payload = {}) {
  const normalizedPayload = mapDouyinCancelPayload(payload)
  validateDouyinCancelPayload(normalizedPayload)

  const client = await postgreDB.getClient()

  /** @type {{cancelResult:number, reason:string, auditStatus:string}|null} 审核决策。 */
  let auditDecision = null
  /** @type {number} 当前审核回传重试次数。 */
  let currentRetryCount = 0
  /** @type {Object} 最终返回结果。 */
  let result

  try {
    await client.query('BEGIN')

    const douyinOrderResult = await client.query(
      `SELECT * FROM douyin_orders WHERE ota_order_id = $1 LIMIT 1 FOR UPDATE`,
      [normalizedPayload.otaOrderId]
    )
    const douyinOrder = douyinOrderResult.rows[0]

    if (!douyinOrder) {
      throw createDouyinCancelError(9, '订单不存在或状态异常', `Douyin order not found: ${normalizedPayload.otaOrderId}`)
    }

    currentRetryCount = Number(douyinOrder.cancel_audit_retry_count || 0)

    const localOrder = await findLocalOrder(normalizedPayload, client)

    if (!localOrder) {
      await updateDouyinCancelInfo(normalizedPayload, 'missing_local_order', client)
      await client.query('COMMIT')

      throw createDouyinCancelError(9, '订单不存在或状态异常', `Local order not found: ${normalizedPayload.otaOrderId}`)
    }

    auditDecision = buildCancelAuditDecision({
      needAudit: normalizedPayload.needAudit,
      localOrderStatus: localOrder.status,
      cancelReason: normalizedPayload.cancelReason,
    })

    if (localOrder.status === 'cancelled') {
      await updateDouyinCancelInfo(normalizedPayload, 'already_cancelled', client)
      await client.query('COMMIT')

      result = {
        action: 'already_cancelled',
        cancelMode: 2,
        cancelResult: null,
        reason: normalizedPayload.cancelReason || '订单已取消',
        localOrderId: localOrder.order_id,
      }
    } else if (normalizedPayload.needAudit && ['checked-in', 'occupied', 'checked-out'].includes(localOrder.status)) {
      await updateDouyinCancelInfo(normalizedPayload, 'pending_audit', client)
      await client.query('COMMIT')

      result = {
        action: 'pending_audit',
        cancelMode: 2,
        cancelResult: null,
        reason: normalizedPayload.cancelReason || `订单当前状态为 ${localOrder.status}，需异步审核`,
        localOrderId: localOrder.order_id,
      }
    } else if (!['pending', 'reserved'].includes(localOrder.status)) {
      await updateDouyinCancelInfo(normalizedPayload, 'invalid_status', client)
      await client.query('COMMIT')

      throw createDouyinCancelError(9, '订单不存在或状态异常', `Local order status invalid for cancel: ${localOrder.status}`)
    } else {
      await updateOrderStatus(localOrder.order_id, 'cancelled', client)
      await updateDouyinCancelInfo(normalizedPayload, normalizedPayload.needAudit ? 'pending_audit' : 'cancelled', client)
      await client.query('COMMIT')

      result = {
        action: 'cancelled',
        cancelMode: 2,
        cancelResult: null,
        reason: normalizedPayload.cancelReason || '取消成功',
        localOrderId: localOrder.order_id,
      }
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  if (auditDecision) {
    const cancelAuditStatus = await pushCancelAuditResult({
      otaOrderId: normalizedPayload.otaOrderId,
      cancelId: normalizedPayload.cancelId,
      cancelType: normalizedPayload.cancelType,
      auditDecision,
      currentRetryCount,
    })

    return {
      ...result,
      cancelAuditStatus,
      cancelAuditResult: auditDecision.cancelResult,
    }
  }

  return result
}

module.exports = {
  handleDouyinCancelOrder,
}
