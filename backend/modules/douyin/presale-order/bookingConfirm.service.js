"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const repository = require('./bookingOrder.repository');

const CONFIRM_ENDPOINT = '/goodlife/v1/trip/trade/hotel/order/confirm/';

/** 从抖音响应中读取排障 logid。 */
function getLogId(response) {
  return response?.extra?.logid || response?.extra?.log_id || null;
}

/** 判断抖音 HTTP 200 响应中是否仍包含业务失败。 */
function getDouyinErrorMessage(response) {
  const code = Number(response?.extra?.error_code ?? response?.data?.error_code ?? 0);
  if (code === 0) return '';
  return response?.extra?.sub_description || response?.extra?.description || response?.data?.description || `抖音确认接单失败，error_code=${code}`;
}

/** 补充确认接单日志所需订单标识和抖音 logid。 */
function createConfirmError(message, booking, logId = null) {
  const error = new Error(message);
  error.douyinLogId = logId;
  error.douyinOrderId = booking.ota_order_id;
  error.confirmNumber = booking.confirm_number;
  return error;
}

/** 组装抖音确认接单或拒单的请求结果。 */
function buildConfirmResult(booking, options) {
  const confirmResult = Number(options.confirmResult ?? 1);
  if (![1, 2].includes(confirmResult)) {
    const error = new Error('确认结果仅支持接单或拒单');
    error.statusCode = 400;
    throw error;
  }
  if (confirmResult === 1) {
    return { confirm_result: 1, confirm_number: booking.confirm_number };
  }
  const rejectReason = String(options.rejectReason || '酒店暂不可接单').trim();
  if (!rejectReason || rejectReason.length > 512) {
    const error = new Error('拒单原因不能为空且不能超过512个字符');
    error.statusCode = 400;
    throw error;
  }
  const rejectCode = options.rejectCode === undefined ? 1 : Number(options.rejectCode);
  if (!Number.isInteger(rejectCode) || rejectCode <= 0) {
    const error = new Error('拒单原因码必须是正整数');
    error.statusCode = 400;
    throw error;
  }
  return {
    confirm_result: 2,
    reject_code: rejectCode,
    reject_reason: rejectReason
  };
}

/** 调用抖音确认接单接口，回传预约订单的接单或拒单结果。 */
async function confirmBooking(localOrderId, options = {}) {
  const booking = await repository.findByLocalOrderId(localOrderId);
  if (!booking) {
    const error = new Error(`预约订单不存在: ${localOrderId}`);
    error.statusCode = 404;
    throw error;
  }
  const confirmResult = buildConfirmResult(booking, options);
  if (booking.confirm_status === 'CONFIRMED') {
    if (confirmResult.confirm_result === 1) {
      return { duplicate: true, logId: booking.confirm_log_id || null };
    }
    const error = createConfirmError('预约订单已接单，不能再拒单', booking, booking.confirm_log_id || null);
    error.statusCode = 409;
    throw error;
  }
  if (booking.confirm_status === 'REJECTED') {
    const error = createConfirmError('预约订单已拒单，不能重复处理', booking, booking.confirm_log_id || null);
    error.statusCode = 409;
    throw error;
  }
  const accountId = douyinConfig.accountId;
  if (!accountId) {
    const errorMessage = '缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID';
    await repository.markConfirmFailed(localOrderId, { errorMessage, logId: null, response: {} });
    throw createConfirmError(errorMessage, booking);
  }

  const payload = {
    order_id: booking.ota_order_id,
    confirm_result: confirmResult
  };
  let response;
  let result;
  try {
    response = await (options.fetchImpl || global.fetch)(`${douyinConfig.openApiBaseUrl}${CONFIRM_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': await douyinTokenService.getToken(),
        'Rpc-Transit-Life-Account': accountId
      },
      body: JSON.stringify(payload)
    });
    result = await response.json();
  } catch (error) {
    await repository.markConfirmFailed(localOrderId, {
      errorMessage: `调用确认接单接口失败: ${error.message}`,
      logId: null,
      response: {},
      rejectCode: confirmResult.reject_code,
      rejectReason: confirmResult.reject_reason
    });
    throw createConfirmError(`调用确认接单接口失败: ${error.message}`, booking);
  }

  const logId = getLogId(result);
  const errorMessage = !response.ok ? `确认接单接口 HTTP ${response.status}` : getDouyinErrorMessage(result);
  if (errorMessage) {
    await repository.markConfirmFailed(localOrderId, {
      errorMessage,
      logId,
      response: result,
      rejectCode: confirmResult.reject_code,
      rejectReason: confirmResult.reject_reason
    });
    throw createConfirmError(errorMessage, booking, logId);
  }

  if (confirmResult.confirm_result === 2) {
    await repository.markConfirmRejected(localOrderId, {
      logId,
      response: result,
      rejectCode: confirmResult.reject_code,
      rejectReason: confirmResult.reject_reason
    });
  } else {
    await repository.markConfirmSucceeded(localOrderId, { logId, response: result });
  }
  console.log(`[Douyin Presale Booking] ${confirmResult.confirm_result === 1 ? '确认接单' : '确认拒单'}成功:`, {
    interface: CONFIRM_ENDPOINT,
    douyinOrderId: booking.ota_order_id,
    localOrderId,
    confirmNumber: confirmResult.confirm_number || null,
    rejectCode: confirmResult.reject_code || null,
    confirmOrderLogId: logId
  });
  return { duplicate: false, logId };
}

/** 在创建预约响应返回后异步确认接单，不阻塞抖音 SPI。 */
function scheduleBookingConfirmation(localOrderId) {
  setImmediate(() => {
    confirmBooking(localOrderId).catch((error) => {
      console.error('[Douyin Presale Booking] 确认接单失败:', {
        interface: CONFIRM_ENDPOINT,
        douyinOrderId: error.douyinOrderId || null,
        localOrderId,
        confirmNumber: error.confirmNumber || null,
        confirmOrderLogId: error.douyinLogId || null,
        error: error.message
      });
    });
  });
}

module.exports = {
  CONFIRM_ENDPOINT,
  confirmBooking,
  createConfirmError,
  buildConfirmResult,
  getDouyinErrorMessage,
  getLogId,
  scheduleBookingConfirmation
};
