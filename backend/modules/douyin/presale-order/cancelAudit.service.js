"use strict";

const { getClient } = require('../../../database/postgreDB/pg');
const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const cancelAuditRepository = require('./cancelAudit.repository');
const presaleRepository = require('./presaleOrder.repository');
const bookingRepository = require('./bookingOrder.repository');

const AUDIT_ENDPOINT = '/goodlife/v1/trip/trade/hotel/cancel/audit/';

/** 创建取消人工审核业务错误。 */
function createCancelAuditError(message, errorCode = 13, statusCode = 400) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  error.statusCode = statusCode;
  return error;
}

/** 校验并规范抖音要求人工审核的取消申请。 */
function normalizeCancelAuditRequest(payload = {}) {
  const cancelId = String(payload.cancel_id || '').trim();
  const douyinOrderId = String(payload.order_id || '').trim();
  const localOrderId = String(payload.order_out_id || '').trim();
  const bizType = Number(payload.biz_type);
  const cancelType = Number(payload.cancel_type);
  const afterSaleType = Number(payload.after_sale_type);
  const refundType = Number(payload.refund_type);

  if (!cancelId || !douyinOrderId || ![2011, 2012].includes(bizType) || ![1, 2, 3].includes(cancelType) || ![1, 2, 3].includes(afterSaleType) || ![11, 12, 21, 22].includes(refundType)) {
    throw createCancelAuditError('人工审核取消订单请求参数不合法');
  }
  if (bizType === 2011 && afterSaleType === 2) {
    throw createCancelAuditError('预售券主订单不支持仅取消预约');
  }

  return { cancelId, douyinOrderId, localOrderId, bizType, cancelType, afterSaleType, refundType };
}

/** 根据双订单标识定位同一业务订单，避免跨订单审核。 */
async function resolveOrder(request, client) {
  const repository = request.bizType === 2011 ? presaleRepository : bookingRepository;
  const byDouyinOrderId = await repository.findByDouyinOrderId(request.douyinOrderId, client);
  const byLocalOrderId = request.localOrderId ? await repository.findByLocalOrderId(request.localOrderId, client) : null;
  if (byDouyinOrderId && byLocalOrderId && byDouyinOrderId.id !== byLocalOrderId.id) {
    throw createCancelAuditError('抖音订单号与第三方订单号不匹配', 100);
  }
  const order = byDouyinOrderId || byLocalOrderId;
  if (!order && request.cancelType !== 3) {
    throw createCancelAuditError('未找到对应订单，等待抖音重试', 100);
  }
  return order;
}

/** 接收需人工审核的取消申请，并以 cancel_id 返回同一待审记录。 */
async function receiveCancelAudit(payload, options = {}) {
  const request = normalizeCancelAuditRequest(payload);
  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');
    const existing = await cancelAuditRepository.findByCancelId(request.cancelId, client);
    if (existing) {
      if (existing.biz_type !== request.bizType || existing.ota_order_id !== request.douyinOrderId || (existing.order_out_id || '') !== request.localOrderId) {
        throw createCancelAuditError('取消编号与已有订单不匹配', 100);
      }
      await client.query('COMMIT');
      return { audit: existing, duplicate: true };
    }

    const order = await resolveOrder(request, client);
    const audit = await cancelAuditRepository.insertPending({
      ...request,
      presaleOrderId: request.bizType === 2011 ? order?.id || null : null,
      bookingOrderId: request.bizType === 2012 ? order?.id || null : null,
      logId: options.logId || null,
      rawPayload: payload
    }, client);
    await client.query('COMMIT');
    return { audit, duplicate: false };
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) client.release();
  }
}

/** 校验后台人工提交的审核结论。 */
function normalizeAuditDecision(payload = {}) {
  const result = Number(payload.cancelResult);
  const reason = String(payload.reason || '').trim();
  if (![1, 2].includes(result)) throw createCancelAuditError('审核结论必须为 1（同意）或 2（拒绝）');
  if (result === 2 && !reason) throw createCancelAuditError('拒绝取消时必须填写原因');
  return { result, reason };
}

/** 从抖音 OpenAPI 响应中提取 logid。 */
function getDouyinLogId(response) {
  return response?.extra?.logid || response?.extra?.log_id || null;
}

/** 判断抖音审核回传是否已被平台成功接收。 */
function getAuditCallbackError(response, httpStatus) {
  const errorCode = Number(response?.extra?.error_code ?? response?.data?.error_code ?? 0);
  if (httpStatus >= 200 && httpStatus < 300 && errorCode === 0) return '';
  return response?.extra?.sub_description || response?.extra?.description || response?.data?.description || `抖音取消审核回传失败，HTTP ${httpStatus}`;
}

/** 将人工审核结论回传到抖音。 */
async function callbackDouyinAudit(audit, options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  let response;
  let result;
  try {
    response = await fetchImpl(`${douyinConfig.openApiBaseUrl}${AUDIT_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': await (options.tokenService || douyinTokenService).getToken(),
        'Rpc-Transit-Life-Account': douyinConfig.accountId
      },
      body: JSON.stringify({
        cancel_Id: audit.cancel_id,
        cancel_result: audit.audit_result,
        cancel_type: audit.cancel_type,
        order_id: audit.ota_order_id,
        reason: audit.audit_reason || undefined
      })
    });
    result = await response.json();
  } catch (error) {
    const callbackError = createCancelAuditError(`调用抖音取消审核接口失败：${error.message}`, 100, 502);
    callbackError.callbackResponse = result || {};
    throw callbackError;
  }

  const logId = getDouyinLogId(result);
  const errorMessage = getAuditCallbackError(result, response.status);
  if (errorMessage) {
    const callbackError = createCancelAuditError(errorMessage, 100, 502);
    callbackError.douyinLogId = logId;
    callbackError.callbackResponse = result;
    throw callbackError;
  }
  return { logId, response: result };
}

/** 审核同意后推进本地订单状态，拒绝时只保留审核结论。 */
async function applyApprovedCancellation(audit, client) {
  if (audit.audit_result !== 1) return;
  if (audit.biz_type === 2011) {
    const order = await presaleRepository.findByDouyinOrderId(audit.ota_order_id, client);
    if (!order && audit.cancel_type === 3) return;
    if (!order) throw createCancelAuditError('审核回传成功，但本地预售券订单不存在', 100, 409);
    if (audit.after_sale_type === 1) {
      if (!['CREATED', 'PAID', 'CANCELLED'].includes(order.order_stage)) {
        throw createCancelAuditError('预售券订单当前状态不能取消', 100, 409);
      }
      await presaleRepository.markCancelled(order.id, { cancelId: audit.cancel_id }, audit.request_payload, audit.request_log_id, client);
      return;
    }
    await presaleRepository.markRefundPending(order.id, { cancelId: audit.cancel_id }, audit.request_payload, audit.request_log_id, client);
    return;
  }

  const booking = await bookingRepository.findByDouyinOrderId(audit.ota_order_id, client);
  if (!booking && audit.cancel_type === 3) return;
  if (!booking) throw createCancelAuditError('审核回传成功，但本地预约订单不存在', 100, 409);
  if ([1, 2].includes(audit.after_sale_type)) {
    await bookingRepository.markCancelled(booking, client);
  }
}

/** 提交人工审核结论，成功回传抖音后才完成本地状态流转。 */
async function reviewCancelAudit(cancelId, payload, reviewer, options = {}) {
  const decision = normalizeAuditDecision(payload);
  let client;
  let audit;
  try {
    client = await getClient();
    await client.query('BEGIN');
    audit = await cancelAuditRepository.markCallbackPending(cancelId, decision, reviewer || {}, client);
    if (!audit) {
      const existing = await cancelAuditRepository.findByCancelId(cancelId, client);
      if (!existing) throw createCancelAuditError('取消审核申请不存在', 13, 404);
      if (['APPROVED', 'REJECTED'].includes(existing.audit_status)) {
        await client.query('COMMIT');
        return { audit: existing, duplicate: true };
      }
      throw createCancelAuditError('取消审核正在回传抖音，请稍后重试', 100, 409);
    }
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) client.release();
  }

  let callback;
  try {
    callback = await callbackDouyinAudit(audit, options);
  } catch (error) {
    await cancelAuditRepository.markCallbackFailed(cancelId, error.message, error.douyinLogId || null, error.callbackResponse || {});
    throw error;
  }

  try {
    client = await getClient();
    await client.query('BEGIN');
    await applyApprovedCancellation(audit, client);
    const updated = await cancelAuditRepository.markCallbackSucceeded(cancelId, callback.response, callback.logId, client);
    await client.query('COMMIT');
    console.log('[Douyin Presale Cancel Audit] 审核回传成功:', { cancelId, auditResult: audit.audit_result, douyinLogId: callback.logId });
    return { audit: updated, duplicate: false };
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    await cancelAuditRepository.markCallbackFailed(cancelId, error.message, callback.logId || null, callback.response);
    throw error;
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  AUDIT_ENDPOINT,
  callbackDouyinAudit,
  createCancelAuditError,
  getAuditCallbackError,
  getDouyinLogId,
  normalizeAuditDecision,
  normalizeCancelAuditRequest,
  receiveCancelAudit,
  reviewCancelAudit
};
